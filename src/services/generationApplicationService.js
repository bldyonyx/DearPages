import { hasHistoricalFinalization } from '../utils/historicalFinalizationRecord.js'
import { getAuth } from 'firebase/auth'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { createGenerationLibraryService } from './generationLibraryService.js'
import { createGenerationBookNotesService } from './generationBookNotesService.js'
import { createGenerationBookRatingsService } from './generationBookRatingsService.js'
import { createGenerationCollectionCatalogService } from './generationCollectionCatalogService.js'
import { createGenerationCollectionMembershipService } from './generationCollectionMembershipService.js'
import { createGenerationMembershipBatchService } from './generationMembershipBatchService.js'
import { createGenerationRecoveryService } from './generationRecoveryService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { captureBookContext, contractRecord } from '../utils/generationOperationUtils.js'
import { captureCatalogContext } from '../utils/generationCollectionCatalogModel.js'
import { createAccountControl, createLifecycleSnapshot } from '../utils/generationRecoveryContracts.js'
import { contractData, frozenContract, sameContract } from '../utils/generationContractData.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'

const failure = code => Object.assign(new Error(`generation-app/${code}`), { code: `generation-app/${code}` })
const legacyBranches = ['library', 'collections', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy']

/** Owner-bound, Emulator-only facade using generation-feasibility rules.
 * Database is injected; fetch controls facade pre/postflight + batch/recovery
 * observations, update controls only batch/recovery commits. Other services keep
 * their existing transports. No Firebase singleton, Auth mutation, account or
 * protocol bootstrap, migration, automatic retry or implicit generation refresh.
 *
 * All calls check ready + active account before AND after delegation. Multi-read
 * preflights are not atomic authorization: rules remain authoritative at commit.
 * Native service results/tokens/errors are preserved; facade failures throw
 * generation-app/* (network-error, permission-denied, protocol-required,
 * legacy-unmigrated, protocol-migrating, invalid-protocol, account-terminal, ...).
 * A postflight failure is NOT proof that an earlier write did not commit.
 * Batch/recovery retain uncertain/indeterminate results; reconcile explicitly.
 *
 * Contexts, expected tokens, operations, selections and retry envelopes must be
 * frozen, as in their services. Mutable payloads/options are copied before awaits.
 * Discover contexts explicitly; every mutation requires the captured scope.
 * Initial creation is explicit initializeGeneration -> initializeLibrary ->
 * activateGeneration; readd starts with beginNextGeneration(deletedPredecessor).
 * Creating states are never automatically completed after an interruption.
 * Membership mutations use batches ONLY, since this rule profile requires receipts.
 */
export function createGenerationApplicationService(database, { uid, fetch: request = globalThis.fetch, update } = {}) {
  const lifecycle = createBookLifecycleService(database) // Fail closed before any SDK ref/network access.
  validateRtdbPathSegment(uid)
  const auth = getAuth(database.app)
  const library = createGenerationLibraryService(database)
  const notes = createGenerationBookNotesService(database)
  const ratings = createGenerationBookRatingsService(database)
  const collections = createGenerationCollectionCatalogService(database)
  const memberships = createGenerationCollectionMembershipService(database)
  const batches = createGenerationMembershipBatchService(database, { fetch: request, update })
  const recovery = createGenerationRecoveryService(database, { fetch: request, update })
  function owner() {
    createBookLifecycleService(database)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
  }
  owner()
  async function read(path) {
    owner()
    let token
    try { token = await auth.currentUser.getIdToken() } catch { throw failure('authentication-unavailable') }
    owner()
    const url = new URL(`http://${emulator.host}:${emulator.database}/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', emulator.projectId); url.searchParams.set('auth', token)
    let response
    try { response = await request(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) }) }
    catch { throw failure('network-error') }
    owner()
    if (response.status === 401 || response.status === 403) throw failure('permission-denied')
    if (!response.ok) throw failure('server-error')
    let value
    try { value = contractData(await response.json()) } catch { throw failure('invalid-observation') }
    owner()
    return value
  }
  async function requireReady() {
    owner()
    const before = await read(`accountControl/${uid}`)
    const state = await read(`users/${uid}`)
    const after = await read(`accountControl/${uid}`)
    let account, previous
    try {
      account = after === null ? null : createAccountControl(after)
      previous = before === null ? null : createAccountControl(before)
    } catch { throw failure('invalid-account') }
    if ((account !== null && account.state !== 'active') || (previous !== null && previous.state !== 'active')) throw failure('account-terminal')
    if (!sameContract(before, after)) throw failure('account-changed')
    if (state !== null && (typeof state !== 'object' || Array.isArray(state))) throw failure('invalid-observation')
    const legacy = legacyBranches.some(branch => state?.[branch] != null)
    if (state?.bookProtocol == null) throw failure(legacy ? 'legacy-unmigrated' : 'protocol-required')
    let protocol
    try { protocol = contractRecord(state.bookProtocol, ['version', 'state']) } catch { throw failure('invalid-protocol') }
    if (protocol.version !== 2 || !['ready', 'migrating'].includes(protocol.state)) throw failure('invalid-protocol')
    if (protocol.state === 'migrating') throw failure('protocol-migrating')
    if (legacy && !hasHistoricalFinalization(state, uid)) throw failure('legacy-unmigrated')
    if (!account) throw failure('account-uninitialized')
    if (!account.legacyClosed) throw failure('protocol-not-ready')
  }
  function bookScope(context) {
    const captured = captureBookContext(context)
    if (captured.uid !== uid) throw failure('owner-mismatch')
  }
  function catalogScope(context) {
    const captured = captureCatalogContext(context)
    if (captured.uid !== uid) throw failure('owner-mismatch')
  }
  // Keep underlying payload/validation semantics. Do not expose raw service
  // instances or unguarded lifecycle/library deletion shortcuts.
  function delegate(service, method, scope, immutable = [0]) {
    return async (...input) => {
      owner()
      for (const index of immutable) if (input[index] !== undefined && input[index] !== null) frozenContract(input[index])
      // Preserve frozen envelopes byte-for-byte, including the insertion order
      // checked by existing service validators. Copy only mutable payloads/options.
      const args = input.map((value, index) => value === undefined || immutable.includes(index) ? value : contractData(value))
      scope?.(args)
      await requireReady()
      owner()
      const result = await service[method](...args)
      owner()
      await requireReady()
      owner()
      return result
    }
  }
  const book = (service, method, immutable = [0]) => delegate(service, method, args => bookScope(args[0]), immutable)
  const catalog = (method, immutable = [0]) => delegate(collections, method, args => catalogScope(args[0]), immutable)
  const operation = (service, method) => delegate(service, method, args => bookScope(args[0].context))
  const ownedList = (service, method) => delegate({ [method]: () => service[method](uid) }, method, null, [])
  const api = {
    books: Object.freeze({
      getContext: delegate({ getContext: async bookId => {
        validateRtdbPathSegment(bookId)
        const life = createLifecycleSnapshot(await lifecycle.readLifecycle(createBookMutationContext({ uid, bookId, generation: 1 })))
        return life === null ? null : Object.freeze({ context: createBookMutationContext({ uid, bookId, generation: life.generation }), state: life.state })
      } }, 'getContext', args => validateRtdbPathSegment(args[0]), []),
      initializeGeneration: book(lifecycle, 'initializeGeneration'),
      beginNextGeneration: book(lifecycle, 'beginNextGeneration'),
      activateGeneration: book(lifecycle, 'activateGeneration'),
      lockDeletion: book(lifecycle, 'lockDeletion'),
      deleteGeneration: book(batches, 'deleteGeneration'),
    }),
    library: Object.freeze({
      initializeLibrary: book(library, 'initializeLibrary'),
      getActiveBook: book(library, 'getActiveBook'),
      getActiveBooks: ownedList(library, 'getActiveBooks'),
      updateBookStatus: book(library, 'updateBookStatus'),
      updateLibraryFields: book(library, 'updateLibraryFields'),
      updateBookStartedAt: book(library, 'updateBookStartedAt'),
      updateBookFinishedAt: book(library, 'updateBookFinishedAt'),
      updateBookAbandonedAt: book(library, 'updateBookAbandonedAt'),
      updateBookRating: book(library, 'updateBookRating'),
    }),
    notes: Object.freeze({
      getNote: book(notes, 'getNote'), getNotes: book(notes, 'getNotes'),
      createNote: book(notes, 'createNote'), patchNote: book(notes, 'patchNote', [0, 3]),
      saveNote: book(notes, 'saveNote', [0, 3]), setPinned: book(notes, 'setPinned', [0, 3]),
      deleteNote: book(notes, 'deleteNote', [0, 2]),
      execute: operation(notes, 'execute'), getLegacySource: book(notes, 'getLegacySource'),
      convertLegacy: operation(notes, 'convertLegacy'),
    }),
    ratings: Object.freeze({
      getRating: book(ratings, 'getRating'), getRatings: book(ratings, 'getRatings'),
      createRating: book(ratings, 'createRating'), updateRating: book(ratings, 'updateRating', [0, 3]),
      deleteRating: book(ratings, 'deleteRating', [0, 2]), execute: operation(ratings, 'execute'),
      reconcile: operation(ratings, 'reconcile'), getLegacySource: book(ratings, 'getLegacySource'),
      convertLegacy: operation(ratings, 'convertLegacy'),
    }),
    collections: Object.freeze({
      getCollection: catalog('getCollection'), getCatalog: ownedList(collections, 'getCatalog'),
      createCollection: catalog('createCollection'), updateMetadata: catalog('updateMetadata', [0, 2]),
      setPinned: catalog('setPinned', [0, 2]), clearCollection: catalog('clearCollection', [0, 2]),
      deleteCollection: catalog('deleteCollection', [0, 1]),
      execute: delegate(collections, 'execute', args => catalogScope(args[0].context)),
      reconcile: delegate(collections, 'reconcile', args => catalogScope(args[0].context)),
    }),
    memberships: Object.freeze({
      getRawMembership: delegate(memberships, 'getRawMembership', args => { bookScope(args[0]); catalogScope(args[1]) }, [0, 1]),
      getMembership: delegate(memberships, 'getMembership', args => { bookScope(args[0]); catalogScope(args[1]) }, [0, 1]),
      getBookMemberships: book(memberships, 'getBookMemberships'),
      verifySelection: delegate(memberships, 'verifySelection', args => {
        catalogScope(args[0].collection)
        for (const entry of args[0].entries) bookScope(entry.context)
      }),
    }),
    batches: Object.freeze({
      getHead: ownedList(batches, 'getHead'),
      execute: delegate(batches, 'execute', args => { if (args[0].uid !== uid) throw failure('owner-mismatch') }),
      reconcile: delegate(batches, 'reconcile', args => { if (args[0].uid !== uid) throw failure('owner-mismatch') }),
    }),
    recovery: Object.freeze({
      discover: ownedList(recovery, 'discover'),
      reconcile: operation(recovery, 'reconcile'), resumeDeletion: operation(recovery, 'resumeDeletion'),
    }),
  }
  return Object.freeze(api)
}
