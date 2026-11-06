import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { captureBookContext } from '../utils/generationOperationUtils.js'
import { createGenerationLibraryBook, validateGenerationLibraryRecord } from '../utils/generationLibraryModel.js'
import { contractData, sameContract } from '../utils/generationContractData.js'
import { getBookRouteId } from '../utils/bookPageUtils.js'

const failure = status => Object.assign(new Error(`generation-ui/${status}`), { code: `generation-ui/${status}` })
/** React-shaped projections only. Every read/write goes through the injected facade.
 * Addition plans survive uncertain acknowledgements in the owning hook. No clock,
 * record, generation or predecessor is replaced on an explicit retry.
 */
export function createGenerationLibraryGateway(facade, uid) {
  const view = value => ({ ...value.book, generationContext: value.context })
  async function read(bookId) {
    const life = await facade.books.getContext(bookId)
    if (!life || life.state === 'deleted') return { book: null, lifecycle: life }
    if (life.state !== 'active') throw failure('recovery-required')
    return { book: view(await facade.library.getActiveBook(life.context)), lifecycle: life }
  }
  function captureAddition(book, status, lifecycle) {
    if (lifecycle && lifecycle.state !== 'deleted') throw failure('recovery-required')
    const bookId = getBookRouteId(book)
    if (lifecycle && lifecycle.context.bookId !== bookId) throw failure('identity-conflict')
    const context = createBookMutationContext({ uid, bookId, generation: lifecycle ? lifecycle.context.generation + 1 : 1 })
    const record = validateGenerationLibraryRecord(context, createGenerationLibraryBook(book, status))
    return contractData({ context, record, predecessor: lifecycle?.context ?? null })
  }
  async function add(plan) {
    const life = await facade.books.getContext(plan.context.bookId)
    if (life?.state === 'active' && sameContract(life.context, plan.context)) {
      const stored = await facade.library.getActiveBook(plan.context)
      if (!sameContract(stored.book, plan.record)) throw failure('initialization-conflict')
      return { book: view(stored), lifecycle: life }
    }
    // Native transitions check this captured predecessor/target; no lookup can
    // retarget the plan to a later generation or overwrite another initializer.
    if (plan.predecessor) await facade.books.beginNextGeneration(plan.predecessor)
    else await facade.books.initializeGeneration(plan.context)
    await facade.library.initializeLibrary(plan.context, plan.record)
    await facade.books.activateGeneration(plan.context)
    return { book: view(await facade.library.getActiveBook(plan.context)), lifecycle: { context: plan.context, state: 'active' } }
  }
  async function status(context, previous, desired) {
    captureBookContext(context)
    const stored = await facade.library.getActiveBook(context)
    if (stored.book.status === desired) return view(stored) // Server reconciliation, no second write.
    const updated = await facade.library.updateBookStatus(context, desired, { expected: { status: previous } })
    return view(updated)
  }
  async function remove(context) {
    captureBookContext(context)
    const result = await facade.books.deleteGeneration(context)
    if (result.status !== 'confirmed') throw failure(result.status)
    return { book: null, lifecycle: { context, state: 'deleted' } }
  }
  return Object.freeze({ read, captureAddition, add, status, remove,
    list: async () => (await facade.library.getActiveBooks()).map(view),
  })
}
