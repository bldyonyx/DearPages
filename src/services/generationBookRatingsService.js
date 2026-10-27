import { getAuth } from 'firebase/auth'
import { ref, runTransaction, serverTimestamp, update } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { captureBookContext, contractRecord } from '../utils/generationOperationUtils.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import { bookLibraryPath, bookRatingsPath, bookRatingsLegacyPath } from '../utils/bookGenerationPaths.js'
import { compareBookRatings } from '../utils/bookRatingsOrder.js'
import {
  createRatingConcurrencyToken, createRatingCreateOperation, createRatingUpdateOperation,
  createRatingDeleteOperation, createRatingSourceToken, createRatingConversionOperation,
} from '../utils/generationRatingContracts.js'

const failure = code => Object.assign(new Error(`generation-ratings/${code}`), { code: `generation-ratings/${code}` })
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const wire = payload => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null))

/** Isolated local-demo repository. Retain the initial envelope and stable ID for
 * explicit retries/reconciliation. No application singleton or generation lookup.
 */
export function createGenerationBookRatingsService(database) {
  const lifecycle = createBookLifecycleService(database)
  function owner(context) {
    createBookLifecycleService(database)
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== context.uid) throw failure('owner-mismatch')
    return auth
  }
  function capture(input) {
    const context = captureBookContext(input)
    owner(context)
    return context
  }
  async function readServer(context, path) {
    const token = await owner(context).currentUser.getIdToken()
    owner(context)
    const url = new URL(`http://${emulator.host}:${emulator.database}/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (response.status === 401 || response.status === 403) throw failure('permission-denied')
      if (!response.ok) throw failure('server-error')
      return await response.json()
    } catch (error) {
      if (error.code?.startsWith('generation-ratings/')) throw error
      throw failure('network-error')
    }
  }
  async function active(context) {
    const state = await lifecycle.readLifecycle(context)
    if (state?.generation !== context.generation) throw failure('stale-generation')
    if (state.state !== 'active') throw failure('not-active')
  }
  function display(context, id, raw) {
    if (!raw || raw.deleted === true) return null
    const token = createRatingConcurrencyToken({ context, entryId: id, revision: raw.revision, createdAt: raw.createdAt, date: raw.date })
    return Object.freeze({ ...raw, id, token })
  }
  async function finished(context) {
    const book = await readServer(context, bookLibraryPath(context))
    if (!book) throw failure('book-not-found')
    if (book.status !== 'finished') throw failure('status-conflict')
  }
  async function getRating(input, entryId) {
    const context = capture(input), id = validateRtdbPathSegment(entryId)
    await active(context)
    const raw = await readServer(context, bookRatingsPath(context, id))
    await active(context)
    return display(context, id, raw)
  }
  async function getRatings(input) {
    const context = capture(input)
    await active(context)
    const raw = await readServer(context, bookRatingsPath(context)) || {}
    await active(context)
    return Object.freeze(Object.entries(raw).map(([id, value]) => display(context, id, value)).filter(Boolean).sort(compareBookRatings))
  }
  function validateOperation(input) {
    const value = contractRecord(input, ['context', 'type', 'entryId', 'payload', 'expected'], ['initialRevision', 'nextRevision'])
    const base = { context: value.context, entryId: value.entryId }
    let rebuilt
    if (value.type === 'rating.create' || value.type === 'rating.update') {
      const payload = contractRecord(value.payload, ['value', 'date'], ['impression'])
      // Null is the existing pure builder's normalized empty-impression output,
      // not an accepted raw business input to the convenience methods.
      if (Object.hasOwn(payload, 'impression') && payload.impression === null) payload.impression = ''
      if (value.type === 'rating.create') {
        if (value.expected !== null) throw new TypeError('Unexpected creation token.')
        rebuilt = createRatingCreateOperation({ ...base, payload })
      } else rebuilt = createRatingUpdateOperation({ ...base, payload, expected: value.expected })
    } else if (value.type === 'rating.delete') {
      if (contractRecord(value.payload, ['deleted']).deleted !== true) throw new TypeError('Invalid deletion.')
      rebuilt = createRatingDeleteOperation({ ...base, expected: value.expected })
    } else if (value.type === 'rating.convert') {
      const payload = contractRecord(value.payload, ['value', 'date'])
      rebuilt = createRatingConversionOperation({ context: value.context, expected: value.expected })
      if (value.entryId !== rebuilt.entryId || payload.value !== rebuilt.payload.value || payload.date !== '') throw new TypeError('Invalid conversion.')
    } else throw new TypeError('Unsupported rating operation.')
    if (!equal(Object.keys(value).sort(), Object.keys(rebuilt).sort())) throw new TypeError('Invalid envelope fields.')
    if (value.initialRevision !== rebuilt.initialRevision || value.nextRevision !== rebuilt.nextRevision) throw new TypeError('Invalid revision.')
    // All nested DTOs were descriptor-validated above, before serialization.
    if (!equal(value, rebuilt)) throw new TypeError('Non-canonical rating envelope.')
    return rebuilt
  }
  function matches(operation, raw) {
    if (!raw) return false
    if (operation.type === 'rating.delete') return raw.deleted === true && raw.createdAt === operation.expected.createdAt && raw.revision === operation.nextRevision
    if (raw.deleted) return false
    if (operation.type === 'rating.create') return raw.revision === 1 && raw.value === operation.payload.value && raw.date === operation.payload.date &&
      (raw.impression ?? '') === (operation.payload.impression ?? '')
    if (operation.type === 'rating.update') return raw.createdAt === operation.expected.createdAt && raw.revision === operation.nextRevision &&
      raw.value === operation.payload.value && raw.date === operation.payload.date &&
      (!Object.hasOwn(operation.payload, 'impression') || (raw.impression ?? '') === (operation.payload.impression ?? ''))
    return false
  }
  async function result(operation) {
    const context = operation.context
    await active(context)
    const raw = await readServer(context, bookRatingsPath(context, operation.entryId))
    await active(context)
    return { raw, value: Object.freeze({ context, rating: display(context, operation.entryId, raw), deleted: raw?.deleted === true }) }
  }
  async function reconcile(input) {
    const operation = validateOperation(input)
    capture(operation.context)
    if (operation.type === 'rating.convert') return confirmConversion(operation)
    const observed = await result(operation)
    if (!matches(operation, observed.raw)) throw failure('unconfirmed')
    return observed.value
  }
  async function execute(input) {
    const operation = validateOperation(input), context = capture(operation.context)
    if (operation.type === 'rating.convert') return convert(operation)
    await active(context)
    // Preserve existing status semantics even for explicit create/update retries.
    if (operation.type !== 'rating.delete') await finished(context)
    const path = bookRatingsPath(context, operation.entryId), baseline = await readServer(context, path)
    if (operation.type !== 'rating.update' && matches(operation, baseline)) return reconcile(operation)
    function propose(current) {
      if (operation.type === 'rating.create') {
        if (current !== null) throw failure('creation-conflict')
        return { ...wire(operation.payload), revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      }
      if (!current) throw failure('not-found')
      if (current.deleted) throw failure('deleted')
      if (current.createdAt !== operation.expected.createdAt || current.revision !== operation.expected.revision) throw failure('revision-conflict')
      if (operation.type === 'rating.delete') return { deleted: true, revision: operation.nextRevision,
        createdAt: current.createdAt, updatedAt: serverTimestamp() }
      // Explicit null clears an impression; omission preserves it.
      return wire({ ...current, ...operation.payload, revision: operation.nextRevision, updatedAt: serverTimestamp() })
    }
    propose(baseline)
    let callbackError, writeError
    try {
      owner(context)
      await runTransaction(ref(database, path), current => {
        callbackError = undefined
        try { return propose(current ?? baseline) } catch (error) { callbackError = error; return undefined }
      }, { applyLocally: false })
    } catch (error) { writeError = error }
    const observed = await result(operation)
    if (!matches(operation, observed.raw)) throw callbackError || writeError || failure('conflict')
    return observed.value
  }
  async function getLegacySource(input) {
    const context = capture(input)
    await active(context)
    const book = await readServer(context, bookLibraryPath(context))
    const marker = await readServer(context, bookRatingsLegacyPath(context))
    await active(context)
    if (marker) return Object.freeze({ status: 'processed' })
    if (book?.rating == null) return Object.freeze({ status: 'empty' })
    try { return Object.freeze({ status: 'unprocessed', token: createRatingSourceToken({ context, sourceValue: book.rating }) }) }
    catch { throw failure('invalid-source') }
  }
  async function confirmConversion(operation) {
    const context = operation.context
    await active(context)
    const marker = await readServer(context, bookRatingsLegacyPath(context))
    await active(context)
    if (marker?.version !== 1 || marker.sourceValue !== operation.expected.sourceValue) throw failure('conversion-conflict')
    return Object.freeze({ context, processed: true })
  }
  async function convert(operation) {
    const context = operation.context
    await active(context)
    await finished(context)
    const previous = await readServer(context, bookRatingsLegacyPath(context))
    if (previous) return confirmConversion(operation)
    const book = await readServer(context, bookLibraryPath(context))
    if (book?.rating !== operation.expected.sourceValue) throw failure('source-conflict')
    let writeError
    try {
      owner(context)
      await update(ref(database), {
        [bookRatingsLegacyPath(context)]: { version: 1, sourceValue: operation.expected.sourceValue, processedAt: serverTimestamp() },
        [bookRatingsPath(context, operation.entryId)]: { value: operation.payload.value, date: '', revision: 1,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      })
    } catch (error) { writeError = error }
    try { return await confirmConversion(operation) } catch (error) {
      if (error.code === 'generation-ratings/conversion-conflict' && writeError) throw writeError
      throw error
    }
  }
  return Object.freeze({ getRating, getRatings, execute, reconcile, getLegacySource,
    createRating: async (context, entryId, payload) => execute(createRatingCreateOperation({ context, entryId, payload })),
    updateRating: async (context, entryId, payload, expected) => execute(createRatingUpdateOperation({ context, entryId, payload, expected })),
    deleteRating: async (context, entryId, expected) => execute(createRatingDeleteOperation({ context, entryId, expected })),
    convertLegacy: input => execute(input),
  })
}
