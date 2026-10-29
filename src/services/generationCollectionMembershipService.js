import { getAuth } from 'firebase/auth'
import { ref, runTransaction } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { captureBookContext, contractRecord } from '../utils/generationOperationUtils.js'
import { captureCatalogContext, CATALOG_MAX_COUNTER } from '../utils/generationCollectionCatalogModel.js'
import { bookCollectionMembershipsPath, bookLibraryPath, bookProtocolPath, collectionCatalogPath } from '../utils/bookGenerationPaths.js'
import {
  createCollectionContext, createCollectionMembership, createMembershipConcurrencyToken,
  createMembershipOperation, createCollectionSelection, assertCollectionSelectionCurrent,
} from '../utils/generationCollectionContracts.js'

const failure = code => Object.assign(new Error(`collection-memberships/${code}`), { code: `collection-memberships/${code}` })
const same = (a, b) => a === null || b === null ? a === b : a.epoch === b.epoch && a.present === b.present && a.revision === b.revision
const boundedMembership = raw => {
  if (raw === null) return null
  const membership = createCollectionMembership(raw)
  if (membership.epoch > CATALOG_MAX_COUNTER || membership.revision > CATALOG_MAX_COUNTER) throw new RangeError('Membership counter outside catalog profile.')
  return membership
}

/** Demo-only injected repository. No singleton/UI, implicit generation/epoch
 * resolution, membership migration, catalog activity write or bulk mutation.
 */
export function createGenerationCollectionMembershipService(database) {
  const lifecycle = createBookLifecycleService(database)
  function owner(uid) {
    createBookLifecycleService(database)
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
    return auth
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
      if (error.code?.startsWith('collection-memberships/')) throw error
      throw failure('network-error')
    }
  }
  function capture(context, collection) {
    const book = captureBookContext(context), catalog = captureCatalogContext(collection)
    if (book.uid !== catalog.uid) throw new TypeError('Cross-owner membership scope.')
    owner(book.uid)
    return { context: book, collection: catalog }
  }
  function validate(input) {
    const value = contractRecord(input, ['context', 'type', 'entryId', 'payload', 'expected', 'collection', 'intent', 'changes'])
    const rebuilt = createMembershipOperation({ context: value.context, collection: value.collection, intent: value.intent, expected: value.expected })
    captureCatalogContext(rebuilt.collection)
    boundedMembership(value.payload); boundedMembership(rebuilt.payload)
    if (value.type !== rebuilt.type || value.entryId !== rebuilt.entryId || value.changes !== rebuilt.changes || JSON.stringify(value) !== JSON.stringify(rebuilt)) {
      throw new TypeError('Non-canonical membership operation.')
    }
    return rebuilt
  }
  function bookReason(context, before, after, library, protocolBefore, protocolAfter) {
    for (const protocol of [protocolBefore, protocolAfter]) {
      if (protocol?.version !== 2 || protocol.state !== 'ready' || Object.keys(protocol).length !== 2) return 'protocol-not-ready'
    }
    if (!before || !after) return 'book-not-found'
    if (before.generation !== context.generation || after.generation !== context.generation) return 'stale-generation'
    if (before.state !== 'active' || after.state !== 'active') return 'book-not-active'
    if (!library || typeof library !== 'object' || Array.isArray(library)) return 'library-missing'
    return null
  }
  function collectionReason(collection, before, after) {
    if (!before || !after) return 'collection-not-found'
    if (before.deleted === true || after.deleted === true) return 'collection-deleted'
    if (before.membershipEpoch !== collection.epoch || after.membershipEpoch !== collection.epoch) return 'stale-epoch'
    if (before.createdAt !== after.createdAt) return 'collection-identity-conflict'
    return null
  }
  function effectiveView(context, collection, rawInput, reason) {
    const raw = boundedMembership(rawInput)
    if (raw && raw.epoch > collection.epoch && !reason) throw failure('contradictory-membership')
    const current = !reason && raw?.epoch === collection.epoch
    const token = current ? createMembershipConcurrencyToken({ context, collection, membership: raw }) : null
    return Object.freeze({ context, collection, raw, token, effective: Boolean(current && raw.present), reason })
  }
  async function observe(context, collection) {
    const protocolBefore = await readServer(context.uid, bookProtocolPath(context))
    const lifeBefore = await lifecycle.readLifecycle(context)
    const ready = protocolBefore?.version === 2 && protocolBefore.state === 'ready'
    const before = ready ? await readServer(context.uid, collectionCatalogPath(context.uid, collection.collectionId)) : null
    const library = await readServer(context.uid, bookLibraryPath(context))
    const raw = await readServer(context.uid, bookCollectionMembershipsPath(context, collection.collectionId))
    const after = ready ? await readServer(context.uid, collectionCatalogPath(context.uid, collection.collectionId)) : null
    const lifeAfter = await lifecycle.readLifecycle(context)
    const protocolAfter = await readServer(context.uid, bookProtocolPath(context))
    const reason = bookReason(context, lifeBefore, lifeAfter, library, protocolBefore, protocolAfter) || collectionReason(collection, before, after)
    return effectiveView(context, collection, raw, reason)
  }
  async function getRawMembership(input, catalogInput) {
    const { context, collection } = capture(input, catalogInput)
    return boundedMembership(await readServer(context.uid, bookCollectionMembershipsPath(context, collection.collectionId)))
  }
  async function getMembership(input, catalogInput) {
    const { context, collection } = capture(input, catalogInput)
    return observe(context, collection)
  }
  async function getBookMemberships(input) {
    const context = captureBookContext(input); owner(context.uid)
    const protocolBefore = await readServer(context.uid, bookProtocolPath(context)), before = await lifecycle.readLifecycle(context)
    const ready = protocolBefore?.version === 2 && protocolBefore.state === 'ready'
    const catalogsBefore = ready ? await readServer(context.uid, collectionCatalogPath(context.uid)) || {} : {}
    const library = await readServer(context.uid, bookLibraryPath(context))
    const rows = await readServer(context.uid, bookCollectionMembershipsPath(context)) || {}
    const catalogsAfter = ready ? await readServer(context.uid, collectionCatalogPath(context.uid)) || {} : {}
    const after = await lifecycle.readLifecycle(context), protocolAfter = await readServer(context.uid, bookProtocolPath(context))
    const reason = bookReason(context, before, after, library, protocolBefore, protocolAfter)
    const memberships = Object.freeze(Object.entries(rows).map(([collectionId, value]) => {
      const raw = boundedMembership(value)
      const collection = captureCatalogContext(createCollectionContext({ uid: context.uid, collectionId, epoch: raw.epoch }))
      return effectiveView(context, collection, raw, reason || collectionReason(collection, catalogsBefore[collectionId], catalogsAfter[collectionId]))
    }))
    return Object.freeze({ context, reason, memberships, effective: Object.freeze(memberships.filter(row => row.effective)) })
  }
  async function reconcile(input) {
    const operation = validate(input)
    const observed = await getMembership(operation.context, operation.collection)
    if (observed.reason) throw failure(observed.reason)
    if (!same(observed.raw, operation.payload)) throw failure('unconfirmed')
    return observed
  }
  async function execute(input) {
    const operation = validate(input), { context, collection } = capture(operation.context, operation.collection)
    const baseline = await observe(context, collection)
    if (baseline.reason) throw failure(baseline.reason)
    if (same(baseline.raw, operation.payload)) return reconcile(operation)
    function propose(value) {
      const raw = boundedMembership(value)
      if (raw && raw.epoch > collection.epoch) throw failure('stale-epoch')
      const current = raw?.epoch === collection.epoch ? raw : null
      if (operation.expected === null) {
        if (current !== null) throw failure('membership-conflict')
      } else if (!same(current, operation.expected.membership)) throw failure('revision-conflict')
      return operation.payload
    }
    propose(baseline.raw)
    let callbackError, writeError
    try {
      owner(context.uid)
      await runTransaction(ref(database, bookCollectionMembershipsPath(context, collection.collectionId)), value => {
        callbackError = undefined
        try { return propose(value ?? baseline.raw) } catch (error) { callbackError = error; return undefined }
      }, { applyLocally: false })
    } catch (error) { writeError = error }
    const observed = await observe(context, collection)
    if (observed.reason) throw failure(observed.reason)
    if (!same(observed.raw, operation.payload)) throw callbackError || writeError || failure('conflict')
    return observed
  }
  /** Observational check only, never bulk authorization or atomic multi-book snapshot. */
  async function verifySelection(input) {
    const captured = createCollectionSelection(input)
    if (!Object.isFrozen(input)) throw new TypeError('Expected frozen selection.')
    captureCatalogContext(captured.collection)
    const entries = []
    for (const entry of captured.entries) {
      const observed = await getMembership(entry.context, captured.collection)
      if (observed.reason) throw failure(observed.reason)
      entries.push({ context: entry.context, expected: observed.token })
    }
    // Empty selections still need authoritative catalog/protocol evidence.
    owner(captured.collection.uid)
    const protocol = await readServer(captured.collection.uid, `users/${captured.collection.uid}/bookProtocol`)
    if (protocol?.version !== 2 || protocol.state !== 'ready') throw failure('protocol-not-ready')
    const latest = await readServer(captured.collection.uid, collectionCatalogPath(captured.collection.uid, captured.collection.collectionId))
    const reason = collectionReason(captured.collection, latest, latest)
    if (reason) throw failure(reason)
    const observed = createCollectionSelection({ collection: captured.collection, entries })
    assertCollectionSelectionCurrent(captured, observed)
    return captured
  }
  return Object.freeze({ getRawMembership, getMembership, getBookMemberships, verifySelection, execute, reconcile,
    addBook: async (context, collection, expected = null) => execute(createMembershipOperation({ context, collection, intent: 'add', expected })),
    removeBook: async (context, collection, expected) => execute(createMembershipOperation({ context, collection, intent: 'remove', expected })),
  })
}
