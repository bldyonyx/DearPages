import { beforeEach, expect, it, vi } from 'vitest'
import { get, ref, runTransaction, update } from 'firebase/database'
import * as service from '../services/bookRatingsService.js'
import { compareBookRatings } from '../utils/bookRatingsOrder.js'
const config = vi.hoisted(() => ({ enabled: true }))
vi.mock('../services/firebase.js', () => ({ database: {}, get isFirebaseEmulator() { return config.enabled } }))
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db, path) => path), get: vi.fn(), push: vi.fn(() => ({ key: '-1234567890123456789' })),
  runTransaction: vi.fn(), update: vi.fn(), serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
}))
const snapshot = value => ({ exists: () => value !== null, val: () => value, hasChild: key => value?.[key] !== undefined })
beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(snapshot({ status: 'finished', rating: 4 }))
})
it('orders known dates before unknown, and uses immutable creation/ID ties', () => {
  const rating = (id, date, createdAt) => ({ id, date, createdAt })
  expect([rating('u','',99), rating('b','2024-01-01',2), rating('a','2024-01-01',2), rating('new','2026-01-01',1)].sort(compareBookRatings).map(r => r.id)).toEqual(['new', 'a', 'b', 'u'])
})
it.each([0, 6, 1.5, '4', null])('rejects invalid value %s before reads or writes', async value => {
  await expect(service.createBookRating('u','b','-1234567890123456789',{ value, date:'2024-01-01' })).rejects.toMatchObject({ code:'book-ratings/invalid-argument' })
  expect(get).not.toHaveBeenCalled(); expect(runTransaction).not.toHaveBeenCalled()
})
it.each(['bad/id', '', ' a', 'x'.repeat(129)])('rejects unsafe user IDs %s', async uid => {
  await expect(service.getBookRatingsForDisplay(uid,'b')).rejects.toThrow()
  expect(ref).not.toHaveBeenCalled()
})
it('loads without conversion, with markers last and tombstones hidden', async () => {
  get.mockResolvedValueOnce(snapshot({ status:'finished', rating:4 }))
    .mockResolvedValueOnce(snapshot({ deleted: { deleted:true, revision:2 }, old: {value:3,date:'',createdAt:1} }))
    .mockResolvedValueOnce(snapshot({ version:1, sourceValue:4 }))
  expect(await service.getBookRatingsForDisplay('u','b')).toEqual({ ratings:[{id:'old',value:3,date:'',createdAt:1}],legacy:{status:'processed'} })
  expect(get.mock.calls.map(([path]) => path)).toEqual(['users/u/library/b','users/u/bookRatings/b','users/u/bookRatingsLegacy/b'])
  expect(update).not.toHaveBeenCalled(); expect(runTransaction).not.toHaveBeenCalled()
})
it('fails closed on a marker read error', async () => {
  get.mockResolvedValueOnce(snapshot({rating:4})).mockResolvedValueOnce(snapshot(null)).mockRejectedValueOnce(new Error('offline'))
  await expect(service.getBookRatingsForDisplay('u','b')).rejects.toThrow('offline')
})
it('inserts with a transaction only at its stable ID, and reports network errors', async () => {
  runTransaction.mockImplementationOnce(async (path, callback, options) => {
    expect(path).toBe('users/u/bookRatings/b/-1234567890123456789')
    expect(options).toEqual({applyLocally:false})
    expect(callback({value:4})).toBeUndefined()
    const data=callback(null)
    expect(data).toEqual({value:3,date:'2024-01-01',revision:1,createdAt:{'.sv':'timestamp'},updatedAt:{'.sv':'timestamp'}})
    return {committed:true,snapshot:snapshot({...data,createdAt:1,updatedAt:1})}
  })
  get.mockResolvedValueOnce(snapshot({status:'finished'})).mockResolvedValueOnce(snapshot({value:3,date:'2024-01-01',createdAt:1,updatedAt:1,revision:1}))
  expect(await service.createBookRating('u','b','-1234567890123456789',{value:3,date:'2024-01-01'})).toMatchObject({id:'-1234567890123456789',revision:1})
  runTransaction.mockRejectedValueOnce(new Error('offline'))
  await expect(service.createBookRating('u','b','-1234567890123456789',{value:3,date:'2024-01-01'})).rejects.toThrow('offline')
})
it('guards the new services in production without accessing Firebase', async () => {
  // The capability is captured at module initialization, as in the real isolated SDK.
  vi.resetModules(); config.enabled=false
  const production = await import('../services/bookRatingsService.js')
  await expect(production.getBookRatingsForDisplay('u','b')).rejects.toMatchObject({code:'book-ratings/emulator-only'})
  await expect(production.migrateLegacyBookRating('u','b',4)).rejects.toThrow('emulator-only')
  expect(get).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled()
  config.enabled=true
})
it.each([null, 42, true, {}, [], undefined, 'a'.repeat(161), '🙂'.repeat(81), 'ligne\nligne', 'tab\tfin', '\u0000', '\u007f'])('rejects invalid impressions before Firebase reads/writes: %#',async impression=>{
  await expect(service.createBookRating('u','b','-1234567890123456789',{value:3,date:'2024-01-01',impression})).rejects.toMatchObject({code:'book-ratings/invalid-argument'})
  expect(get).not.toHaveBeenCalled();expect(runTransaction).not.toHaveBeenCalled()
})
it('includes impression in the collision check for an uncertain creation',async()=>{
  runTransaction.mockResolvedValueOnce({committed:false,snapshot:snapshot({value:3,date:'2024-01-01',revision:1,impression:'Originale'})})
  await expect(service.createBookRating('u','b','-1234567890123456789',{value:3,date:'2024-01-01',impression:'Différente'})).rejects.toMatchObject({code:'book-ratings/conflict'})
})
