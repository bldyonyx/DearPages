import { getAuth } from 'firebase/auth'
import { ref, runTransaction, serverTimestamp } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import { collectionCatalogPath } from '../utils/bookGenerationPaths.js'
import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { contractRecord } from '../utils/generationOperationUtils.js'
import { captureCatalogContext, createCatalogToken, createCatalogOperation, compareCatalogEntries, CATALOG_FIELDS, CATALOG_LAST_LIVE_REVISION, nextCatalogCounter } from '../utils/generationCollectionCatalogModel.js'

const failure = code => Object.assign(new Error(`collection-catalog/${code}`), { code: `collection-catalog/${code}` })
const digest = async payload => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload))))].map(byte => byte.toString(16).padStart(2, '0')).join('')
const counters = () => Object.fromEntries(CATALOG_FIELDS.map(key => [key, 1]))

/** Isolated local-demo catalog. No book discovery, memberships, UI imports or
 * automatic epoch resolution. Use explicit captured envelopes for retries.
 */
export function createGenerationCollectionCatalogService(database) {
  createBookLifecycleService(database) // Reuse its connection guard only, not book lifecycle operations.
  function owner(uid) {
    createBookLifecycleService(database)
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
    return auth
  }
  function capture(input) {
    const context = captureCatalogContext(input)
    owner(context.uid)
    return context
  }
  async function readServer(uid, path) {
    const token = await owner(uid).currentUser.getIdToken()
    owner(uid)
    const url = new URL(`http://${emulator.host}:${emulator.database}/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (response.status === 401 || response.status === 403) throw failure('permission-denied')
      if (!response.ok) throw failure('server-error')
      return await response.json()
    } catch (error) {
      if (error.code?.startsWith('collection-catalog/')) throw error
      throw failure('network-error')
    }
  }
  async function ready(uid) {
    const protocol = await readServer(uid, `users/${uid}/bookProtocol`)
    if (protocol?.version !== 2 || protocol.state !== 'ready' || Object.keys(protocol).length !== 2) throw failure('protocol-not-ready')
  }
  function view(context, raw) {
    if (!raw || raw.deleted === true) return null
    if (raw.membershipEpoch !== context.epoch) throw failure('stale-epoch')
    const token = createCatalogToken({ context, createdAt: raw.createdAt, revision: raw.revision, fieldRevisions: raw.fieldRevisions })
    return Object.freeze({ ...raw, fieldRevisions: Object.freeze({ ...raw.fieldRevisions }), id: context.collectionId, context, token })
  }
  async function getCollection(input) {
    const context = capture(input)
    await ready(context.uid)
    return view(context, await readServer(context.uid, collectionCatalogPath(context.uid, context.collectionId)))
  }
  async function getCatalog(uid) {
    validateRtdbPathSegment(uid); owner(uid); await ready(uid)
    const records = await readServer(uid, collectionCatalogPath(uid)) || {}
    return Object.freeze(Object.entries(records).filter(([, raw]) => raw.deleted !== true).map(([collectionId, raw]) =>
      view(createCollectionContext({ uid, collectionId, epoch: raw.membershipEpoch }), raw)).sort(compareCatalogEntries))
  }
  function validate(input) {
    const value = contractRecord(input, ['type', 'context', 'payload'], ['expected', 'operationId', 'nextEpoch'])
    const args = { type: value.type, context: value.context, payload: value.payload }
    if (Object.hasOwn(value, 'expected')) args.expected = value.expected
    if (Object.hasOwn(value, 'operationId')) args.operationId = value.operationId
    const rebuilt = createCatalogOperation(args)
    if (value.nextEpoch !== rebuilt.nextEpoch || JSON.stringify(value) !== JSON.stringify(rebuilt)) throw new TypeError('Non-canonical catalog operation.')
    return rebuilt
  }
  function matches(operation, raw, creation) {
    if (!raw) return false
    const { context, expected } = operation
    if (operation.type === 'catalog.create') return !raw.deleted && raw.membershipEpoch === 1 && raw.creation === creation
    if (raw.createdAt !== expected.createdAt) return false
    if (operation.type === 'catalog.delete') return raw.deleted === true && raw.membershipEpoch === context.epoch && raw.revision === expected.revision + 1
    if (raw.deleted) return false
    if (operation.type === 'catalog.clear') return raw.membershipEpoch === operation.nextEpoch && raw.lastClearFrom === context.epoch && raw.lastClearId === operation.operationId
    return raw.membershipEpoch === context.epoch && raw.revision >= expected.revision + 1 &&
      Object.entries(operation.payload).every(([key, value]) => raw[key] === value && raw.fieldRevisions[key] === expected.fieldRevisions[key] + 1)
  }
  async function confirm(operation, creation) {
    const { context } = operation
    await ready(context.uid)
    const raw = await readServer(context.uid, collectionCatalogPath(context.uid, context.collectionId))
    if (!matches(operation, raw, creation)) throw failure('unconfirmed')
    const resultContext = operation.type === 'catalog.clear' ? createCollectionContext({ ...context, epoch: operation.nextEpoch }) : context
    return Object.freeze({ context: resultContext, collection: view(resultContext, raw), deleted: raw.deleted === true })
  }
  async function reconcile(input) {
    const operation = validate(input)
    capture(operation.context)
    return confirm(operation, operation.type === 'catalog.create' ? await digest(operation.payload) : null)
  }
  async function execute(input) {
    const operation = validate(input), context = capture(operation.context)
    await ready(context.uid)
    const creation = operation.type === 'catalog.create' ? await digest(operation.payload) : null
    const path = collectionCatalogPath(context.uid, context.collectionId), baseline = await readServer(context.uid, path)
    if (['catalog.create', 'catalog.clear', 'catalog.delete'].includes(operation.type) && matches(operation, baseline, creation)) return confirm(operation, creation)
    function propose(current) {
      if (operation.type === 'catalog.create') {
        if (current !== null) throw failure('creation-conflict')
        return { ...operation.payload, pinned: false, membershipEpoch: 1, revision: 1,
          fieldRevisions: counters(), creation, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      }
      if (!current) throw failure('not-found')
      if (current.deleted) throw failure('deleted')
      if (current.membershipEpoch !== context.epoch) throw failure('stale-epoch')
      if (current.createdAt !== operation.expected.createdAt || current.revision < operation.expected.revision) throw failure('identity-conflict')
      if (operation.type === 'catalog.delete') {
        if (current.revision !== operation.expected.revision) throw failure('revision-conflict')
        return { deleted: true, createdAt: current.createdAt, membershipEpoch: current.membershipEpoch, revision: nextCatalogCounter(current.revision) }
      }
      const revision = nextCatalogCounter(current.revision)
      if (revision > CATALOG_LAST_LIVE_REVISION) throw new RangeError('Final revision reserved for deletion.')
      if (operation.type === 'catalog.clear') return { ...current, membershipEpoch: operation.nextEpoch,
        lastClearFrom: context.epoch, lastClearId: operation.operationId, revision, updatedAt: current.updatedAt }
      const fieldRevisions = { ...current.fieldRevisions }
      for (const field of Object.keys(operation.payload)) {
        if (fieldRevisions[field] !== operation.expected.fieldRevisions[field]) throw failure('field-conflict')
        fieldRevisions[field] = nextCatalogCounter(fieldRevisions[field])
      }
      return { ...current, ...operation.payload, fieldRevisions, revision, updatedAt: serverTimestamp() }
    }
    propose(baseline)
    let callbackError, writeError
    try {
      owner(context.uid)
      await runTransaction(ref(database, path), current => {
        callbackError = undefined
        try { return propose(current ?? baseline) } catch (error) { callbackError = error; return undefined }
      }, { applyLocally: false })
    } catch (error) { writeError = error }
    try { return await confirm(operation, creation) } catch (error) {
      if (error.code === 'collection-catalog/unconfirmed') throw callbackError || writeError || failure('conflict')
      throw error
    }
  }
  return Object.freeze({ getCollection, getCatalog, execute, reconcile,
    createCollection: async (context, payload) => execute(createCatalogOperation({ type: 'catalog.create', context, payload })),
    updateMetadata: async (context, payload, expected) => execute(createCatalogOperation({ type: 'catalog.patch', context, payload, expected })),
    setPinned: async (context, pinned, expected) => execute(createCatalogOperation({ type: 'catalog.pin', context, payload: { pinned }, expected })),
    clearCollection: async (context, operationId, expected) => execute(createCatalogOperation({ type: 'catalog.clear', context, payload: {}, expected, operationId })),
    deleteCollection: async (context, expected) => execute(createCatalogOperation({ type: 'catalog.delete', context, payload: {}, expected })),
  })
}
