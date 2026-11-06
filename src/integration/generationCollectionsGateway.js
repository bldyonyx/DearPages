import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { createCatalogOperation } from '../utils/generationCollectionCatalogModel.js'
import { captureBookContext } from '../utils/generationOperationUtils.js'
import { contractData, sameContract } from '../utils/generationContractData.js'
import { captureMembershipBatch, nextMembershipSequence, MEMBERSHIP_BATCH_LIMITS } from '../utils/generationMembershipBatchContracts.js'

const alphabet = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
const allocate = () => '-' + [...crypto.getRandomValues(new Uint8Array(19))].map(byte => alphabet[byte & 63]).join('')
const failure = status => Object.assign(new Error(`collection-ui/${status}`), { code: `collection-ui/${status}` })
export function collectionErrorMessage(error, t, fallback) {
  const code = String(error?.code || '').toLowerCase()
  if (/^batch (bounds|bytes)$/.test(error?.message || '') || /bounds/.test(code)) return t('collectionsPage.generation.bounds')
  if (/indeterminate/.test(code)) return t('collectionsPage.generation.indeterminate')
  if (/conflict|stale|deleted|rejected|refused/.test(code)) return t('collectionsPage.generation.conflict')
  if (error instanceof TypeError || error instanceof RangeError) return t(fallback)
  return t('collectionsPage.generation.uncertain')
}
/** UI projection and captured intentions only; no new storage or legacy paths.
 * Selection sessions preserve every declared tuple, including absent/no-op rows.
 * More than 32 guards are refused, never silently chunked or omitted.
 */
export function createGenerationCollectionsGateway(facade, library, uid) {
  const pending = new WeakMap()
  async function load() {
    const metadata = await facade.collections.getCatalog()
    const books = await library.list()
    const rows = new Map()
    for (const book of books) {
      const observed = await facade.memberships.getBookMemberships(book.generationContext)
      if (observed.reason) throw failure(observed.reason)
      rows.set(book.id, observed)
    }
    const collections = metadata.map(meta => ({ ...meta,
      books: Object.fromEntries(books.filter(book => rows.get(book.id).effective.some(item => item.collection.collectionId === meta.id && item.collection.epoch === meta.context.epoch)).map(book => [book.id, true])),
      membershipRows: contractData(Object.fromEntries(books.map(book => {
        const raw = rows.get(book.id).memberships.find(item => item.collection.collectionId === meta.id)?.raw ?? null
        return [book.id, { bookId: book.id, generation: book.generationContext.generation, collectionId: meta.id, epoch: meta.context.epoch,
          catalogCreatedAt: meta.createdAt, before: raw === null ? { exists: false } : { exists: true, ...raw },
          desired: raw?.epoch === meta.context.epoch && raw?.present === true }]
      }))),
    }))
    return { collections, books }
  }
  function catalogOperation(type, collection, payload = {}) {
    if (type === 'catalog.create') return createCatalogOperation({ type, context: createCollectionContext({ uid, collectionId: allocate(), epoch: 1 }), payload })
    return createCatalogOperation({ type, context: collection.context, expected: collection.token, payload,
      ...(type === 'catalog.clear' ? { operationId: allocate() } : {}) })
  }
  async function executeCatalog(operation) {
    // Read-only reconciliation first: a post-commit lost response must not turn
    // metadata/pin retries into an extra revision. Only known unconfirmed state
    // falls through to ONE explicit send of the original operation.
    try { return await facade.collections.reconcile(operation) }
    catch (error) { if (!/\/unconfirmed$/.test(error.code || '')) throw error }
    return facade.collections.execute(operation)
  }
  async function row(context, collection) {
    const observed = await facade.memberships.getMembership(context, collection.context)
    if (observed.reason) throw failure(observed.reason)
    return { bookId: context.bookId, generation: context.generation, collectionId: collection.id,
      epoch: collection.context.epoch, catalogCreatedAt: collection.createdAt,
      before: observed.raw === null ? { exists: false } : { exists: true, ...observed.raw }, desired: observed.effective }
  }
  function session(kind, rows, books, collections) {
    return Object.freeze({ kind, rows: contractData(rows), books, collections,
      initialIds: Object.freeze(rows.filter(item => item.desired).map(item => kind === 'book' ? item.collectionId : item.bookId)) })
  }
  async function bookSelection(input) {
    const context = captureBookContext(input)
    const collections = await facade.collections.getCatalog(), rows = []
    for (const collection of collections) rows.push(await row(context, collection))
    return session('book', rows, [], collections)
  }
  async function collectionSelection(collection) {
    const books = await library.list(), rows = []
    for (const book of books) rows.push(await row(book.generationContext, collection))
    return session('collection', rows, books, [collection])
  }
  async function removeSelection(collection, book) {
    const captured = collection.membershipRows?.[book.id]
    if (!captured || captured.generation !== book.generationContext.generation || !captured.desired) throw failure('membership-conflict')
    return session('collection', [captured], [book], [collection])
  }
  async function saveSelection(selection, inputIds) {
    const ids = [...new Set(inputIds)].sort()
    const known = new Set(selection.rows.map(item => selection.kind === 'book' ? item.collectionId : item.bookId))
    if (ids.some(id => !known.has(id))) throw failure('selection-conflict')
    if (!selection.rows.length || selection.rows.length > MEMBERSHIP_BATCH_LIMITS.rows) throw failure('bounds')
    let captured = pending.get(selection)
    if (captured && !sameContract(captured.ids, ids)) throw failure('uncertain')
    if (!captured) {
      const rows = selection.rows.map(item => ({ ...item, desired: ids.includes(selection.kind === 'book' ? item.collectionId : item.bookId) }))
      const head = await facade.batches.getHead()
      captured = { ids, batch: captureMembershipBatch(uid, allocate(), nextMembershipSequence(head?.sequence ?? 0), rows) }
      pending.set(selection, captured)
    }
    const result = await facade.batches.execute(captured.batch)
    if (result.status !== 'confirmed') throw failure(result.status)
    return result
  }
  return Object.freeze({ load, catalogOperation, executeCatalog, bookSelection, collectionSelection, removeSelection, saveSelection,
    bookCount: async context => {
      const observed = await facade.memberships.getBookMemberships(context)
      if (observed.reason) throw failure(observed.reason)
      return observed.effective.length
    },
  })
}
