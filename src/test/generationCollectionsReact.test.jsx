import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import useGenerationCollections from '../hooks/useGenerationCollections.js'
import { createGenerationCollectionsGateway } from '../integration/generationCollectionsGateway.js'

let gateway
const user = { uid: 'owner' }
const delayed = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  gateway = { load: vi.fn(async () => ({ collections: [], books: [] })), catalogOperation: vi.fn(() => Object.freeze({ type: 'catalog.create', context: Object.freeze({ uid: 'owner', collectionId: 'c', epoch: 1 }), payload: Object.freeze({ name: 'Name', description: '', icon: 'library' }) })), executeCatalog: vi.fn() }
})
it('loading or blocked mode never calls a gateway or starts a mutation', async () => {
  const { result, rerender } = renderHook(({ mode }) => useGenerationCollections({ mode, collectionsGateway: gateway }, user), { initialProps: { mode: 'loading' } })
  await act(async () => result.current.handleCreateCollection({ name: 'Name' }))
  rerender({ mode: 'blocked' })
  expect(gateway.load).not.toHaveBeenCalled(); expect(gateway.executeCatalog).not.toHaveBeenCalled()
})
it('late Collection results for a previous account cannot appear for the new one', async () => {
  const pending = delayed(); gateway.load.mockReturnValueOnce(pending.promise).mockResolvedValue({ collections: [], books: [] })
  const backend = { mode: 'generation', collectionsGateway: gateway }
  const { result, rerender } = renderHook(({ uid }) => useGenerationCollections(backend, { uid }), { initialProps: { uid: 'owner' } })
  rerender({ uid: 'other' }); await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => pending.resolve({ collections: [{ id: 'private', books: {} }], books: [] }))
  expect(result.current.collections).toEqual([])
})
it('duplicate create submissions share one captured operation while a request is pending', async () => {
  const pending = delayed(); gateway.executeCatalog.mockReturnValue(pending.promise)
  const { result } = renderHook(() => useGenerationCollections({ mode: 'generation', collectionsGateway: gateway }, user))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  let first
  act(() => { first = result.current.handleCreateCollection({ name: 'Name' }); result.current.handleCreateCollection({ name: 'Name' }) })
  expect(gateway.executeCatalog).toHaveBeenCalledTimes(1); expect(gateway.catalogOperation).toHaveBeenCalledTimes(1)
  await act(async () => { pending.resolve({}); await first })
})
it('unknown create confirmation preserves the original operation instead of allocating a new ID', async () => {
  gateway.executeCatalog.mockRejectedValueOnce(new Error('network')).mockResolvedValue({})
  const { result } = renderHook(() => useGenerationCollections({ mode: 'generation', collectionsGateway: gateway }, user))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => result.current.handleCreateCollection({ name: 'Name' }))
  await act(async () => result.current.handleCreateCollection({ name: 'Name' }))
  expect(gateway.catalogOperation).toHaveBeenCalledTimes(1)
  expect(gateway.executeCatalog.mock.calls[0][0]).toBe(gateway.executeCatalog.mock.calls[1][0])
})
it('a changed draft cannot rewrite an unresolved catalog operation', async () => {
  gateway.executeCatalog.mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useGenerationCollections({ mode: 'generation', collectionsGateway: gateway }, user))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => result.current.handleCreateCollection({ name: 'Name' }))
  await act(async () => result.current.handleCreateCollection({ name: 'Different' }))
  expect(gateway.executeCatalog).toHaveBeenCalledTimes(1)
})
it('an in-flight creation cannot update the UI after the account scope changes', async () => {
  const pending = delayed(); gateway.executeCatalog.mockReturnValue(pending.promise)
  const backend = { mode: 'generation', collectionsGateway: gateway }
  const { result, rerender } = renderHook(({ uid }) => useGenerationCollections(backend, { uid }), { initialProps: { uid: 'owner' } })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  let first; act(() => { first = result.current.handleCreateCollection({ name: 'Name' }) })
  rerender({ uid: 'other' }); await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => { pending.resolve({}); expect(await first).toBe(false) })
  expect(result.current.collections).toEqual([])
})
it('batch counter exhaustion is refused without a write or reset', async () => {
  const facade = { batches: { getHead: vi.fn(async () => ({ sequence: 2147483647 })), execute: vi.fn() } }
  const worker = createGenerationCollectionsGateway(facade, {}, 'owner')
  const selection = { kind: 'collection', rows: [{ bookId: 'book', collectionId: 'c', generation: 1, epoch: 1, catalogCreatedAt: 1, before: { exists: false }, desired: false }] }
  await expect(worker.saveSelection(selection, ['book'])).rejects.toThrow()
  expect(facade.batches.execute).not.toHaveBeenCalled()
})

it('a callback retained from the previous account cannot start an operation in the next scope', async () => {
  const backend = { mode: 'generation', collectionsGateway: gateway }
  const { result, rerender } = renderHook(({ uid }) => useGenerationCollections(backend, { uid }), { initialProps: { uid: 'owner' } })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  const old = result.current.handleCreateCollection
  rerender({ uid: 'other' }); await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => old({ name: 'Name' }))
  expect(gateway.executeCatalog).not.toHaveBeenCalled()
})
