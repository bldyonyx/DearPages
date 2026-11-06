import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useBookLibraryState } from '../hooks/useBookLibraryState.js'
import useLibraryBooks from '../hooks/useLibraryBooks.js'
import { generationLibraryRequested, resolveCurrentLibraryBackend } from '../integration/libraryBackend.js'
import * as legacy from '../services/libraryService.js'

vi.mock('../integration/libraryBackend.js', async importOriginal => ({ ...(await importOriginal()), resolveCurrentLibraryBackend: vi.fn() }))
vi.mock('../services/libraryService.js', () => ({
  BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' },
  getUserLibrary: vi.fn(async () => []), getLibraryBook: vi.fn(async () => null), addBookToLibrary: vi.fn(),
  updateBookStatus: vi.fn(), removeBookFromLibrary: vi.fn(), updateBookFinishedAt: vi.fn(), updateBookAbandonedAt: vi.fn(),
}))
const book = { id: 'book', title: 'Book', authors: [] }
const context = Object.freeze({ uid: 'owner', bookId: 'book', generation: 1 })
let gateway
const options = userId => ({ userId, bookId: 'book', book, routeKey: 'route' })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('MODE', 'emulator'); vi.stubEnv('VITE_GENERATION_LIBRARY', 'true')
  gateway = { read: vi.fn(async () => ({ book: null, lifecycle: null })), list: vi.fn(async () => []),
    captureAddition: vi.fn(() => Object.freeze({ context, record: Object.freeze({ status: 'to-read' }) })),
    add: vi.fn(), status: vi.fn(), remove: vi.fn() }
  resolveCurrentLibraryBackend.mockResolvedValue({ mode: 'generation', gateway })
})
afterEach(() => vi.unstubAllEnvs())
const ready = result => waitFor(() => expect(result.current.isLibraryLoading).toBe(false))
it.each([{ MODE: 'production', VITE_GENERATION_LIBRARY: 'true' }, { MODE: 'test', VITE_GENERATION_LIBRARY: 'true' }, { MODE: 'emulator' }])('requires explicit opt-in AND emulator mode: %j', env => {
  expect(generationLibraryRequested(env)).toBe(false)
})
it('without opt-in the historical hook runs unchanged and never resolves a generation backend', async () => {
  vi.stubEnv('VITE_GENERATION_LIBRARY', '')
  const { result } = renderHook(() => useBookLibraryState(options('owner'))); await ready(result)
  expect(result.current.libraryMode).toBe('legacy')
  expect(legacy.getLibraryBook).toHaveBeenCalledWith('owner', 'book')
  expect(resolveCurrentLibraryBackend).not.toHaveBeenCalled()
})
it('a blocked backend never invokes historical reads or mutations', async () => {
  resolveCurrentLibraryBackend.mockResolvedValue({ mode: 'blocked' })
  const { result } = renderHook(() => useBookLibraryState(options('owner')))
  await waitFor(() => expect(result.current.libraryMode).toBe('blocked'))
  await act(async () => { await result.current.handleAddToLibrary(); await result.current.handleStatusChange('reading') })
  expect(legacy.getLibraryBook).not.toHaveBeenCalled(); expect(legacy.addBookToLibrary).not.toHaveBeenCalled()
})
it('late backend selection for an old user cannot activate the new user', async () => {
  const pending = deferred()
  resolveCurrentLibraryBackend.mockImplementation(uid => uid === 'owner' ? pending.promise : Promise.resolve({ mode: 'blocked' }))
  const { result, rerender } = renderHook(({ uid }) => useBookLibraryState(options(uid)), { initialProps: { uid: 'owner' } })
  rerender({ uid: 'other' })
  await waitFor(() => expect(result.current.libraryMode).toBe('blocked'))
  await act(async () => pending.resolve({ mode: 'generation', gateway }))
  expect(result.current.libraryMode).toBe('blocked'); expect(gateway.read).not.toHaveBeenCalled()
})
it('an in-flight add cannot update the next user and double clicks issue one attempt', async () => {
  const pending = deferred(); gateway.add.mockReturnValue(pending.promise)
  const { result, rerender } = renderHook(({ uid }) => useBookLibraryState(options(uid)), { initialProps: { uid: 'owner' } })
  await ready(result)
  let first
  act(() => { first = result.current.handleAddToLibrary(); result.current.handleAddToLibrary() })
  expect(gateway.add).toHaveBeenCalledTimes(1)
  rerender({ uid: 'other' }); await ready(result)
  await act(async () => { pending.resolve({ book: { ...book, generationContext: context }, lifecycle: { context, state: 'active' } }); await first })
  expect(result.current.libraryBook).toBeNull(); expect(legacy.addBookToLibrary).not.toHaveBeenCalled()
})
it('an uncertain addition is retried only explicitly with the identical captured plan', async () => {
  gateway.add.mockRejectedValueOnce(new Error('uncertain')).mockResolvedValueOnce({ book: { ...book, generationContext: context }, lifecycle: { context, state: 'active' } })
  const { result } = renderHook(() => useBookLibraryState(options('owner'))); await ready(result)
  await act(async () => result.current.handleAddToLibrary())
  expect(result.current.libraryBook).toBeNull(); expect(result.current.libraryError).not.toBe('')
  await act(async () => result.current.handleAddToLibrary())
  expect(gateway.captureAddition).toHaveBeenCalledTimes(1)
  expect(gateway.add.mock.calls[0][0]).toBe(gateway.add.mock.calls[1][0])
  expect(result.current.libraryBook.generationContext).toEqual(context)
})
it('uncertain removal retains the book and retries the same generation, without legacy writes', async () => {
  gateway.read.mockResolvedValue({ book: { ...book, status: 'reading', generationContext: context }, lifecycle: { context, state: 'active' } })
  gateway.remove.mockRejectedValueOnce(new Error('uncertain')).mockResolvedValueOnce({ book: null, lifecycle: { context, state: 'deleted' } })
  const { result } = renderHook(() => useBookLibraryState(options('owner'))); await ready(result)
  act(() => result.current.handleOpenRemoveModal())
  await act(async () => result.current.handleConfirmRemove())
  expect(result.current.libraryBook).not.toBeNull(); expect(result.current.libraryError).not.toBe('')
  await act(async () => result.current.handleConfirmRemove())
  expect(gateway.remove.mock.calls.map(args => args[0])).toEqual([context, context])
  expect(result.current.libraryBook).toBeNull(); expect(legacy.removeBookFromLibrary).not.toHaveBeenCalled()
})
it('old library list responses cannot expose books after the user changes', async () => {
  const pending = deferred(); gateway.list.mockReturnValueOnce(pending.promise).mockResolvedValue([])
  const { result, rerender } = renderHook(({ uid }) => useLibraryBooks(uid), { initialProps: { uid: 'owner' } })
  await waitFor(() => expect(gateway.list).toHaveBeenCalledTimes(1))
  rerender({ uid: 'other' }); await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => pending.resolve([book]))
  expect(result.current.books).toEqual([]); expect(legacy.getUserLibrary).not.toHaveBeenCalled()
})
