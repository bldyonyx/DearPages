// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, runTransaction, serverTimestamp, goOffline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

vi.mock('../../src/services/firebase.js', () => ({ database: clients[0].database, isFirebaseEmulator: true }))
vi.mock('firebase/database', async original => {
  const sdk = await original()
  return { ...sdk, update: vi.fn(sdk.update), runTransaction: vi.fn(sdk.runTransaction) }
})
const clients = []
let service, uid, bookId
const original = { title: 'Livre', status: 'finished', rating: 4, finishedAt: 1717243200000, abandonedAt: 1693569600000, note: '<b>Note</b>', review: 'Avis', metadata: { kept: true }, updatedAt: 17 }
const bookRef = (index = 1) => ref(clients[index].database, `users/${uid}/library/${bookId}`)
const ratingRef = (id, index = 1) => ref(clients[index].database, `users/${uid}/bookRatings/${bookId}/${id}`)
const markerRef = () => ref(clients[1].database, `users/${uid}/bookRatingsLegacy/${bookId}`)
const raw = () => ({ value: 3, date: '2024-02-29', revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const denied = promise => expect(promise).rejects.toThrow(/permission[ _]denied/i)
const create = async (value = 3, date = '2024-02-29') => service.createBookRating(uid, bookId, service.newBookRatingId(uid, bookId), { value, date })
beforeAll(async () => {
  await assertEmulatorProject(); await assertEmulatorsReady()
  const email = `ratings-${Date.now()}@example.test`
  for (let index = 0; index < 4; index++) {
    const app = initializeApp({ apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, projectId: emulator.projectId, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `ratings-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
    const database = getDatabase(app); connectDatabaseEmulator(database, emulator.host, emulator.database)
    clients.push({ app, database })
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, 'emulator-password')).user.uid
    if (index === 1) await signInWithEmailAndPassword(auth, email, 'emulator-password')
    if (index === 2) await createUserWithEmailAndPassword(auth, `ratings-intruder-${Date.now()}@example.test`, 'emulator-password')
  }
  service = await import('../../src/services/bookRatingsService.js')
})
beforeEach(async () => {
  bookId = `rating-book-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await set(bookRef(), original)
})
afterAll(async () => { for (const client of clients) { goOffline(client.database); await deleteApp(client.app) } })

describe('ratings CRUD and rules', () => {
  it('creates, edits, sorts and deletes without changing the book, reading dates or pinned notes', async () => {
    const notes = ref(clients[1].database, `users/${uid}/bookNotes/${bookId}/written`)
    await set(notes, { title: 'Note', contentHtml: '<b>Kept</b>', date: '2024-01-01', isPinned: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    const beforeNote = (await get(notes)).val()
    const a = await create(), b = await create(5, '2025-01-01')
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ value: 3, revision: 1, createdAt: expect.any(Number) })
    expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings.map(r => r.id)).toEqual([b.id, a.id])
    const edited = await service.updateBookRatingEntry(uid, bookId, a, { value: 1, date: '2026-01-01' })
    expect(edited).toMatchObject({ value: 1, revision: 2, createdAt: a.createdAt })
    expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings[0].id).toBe(a.id)
    await service.deleteBookRatingEntry(uid, bookId, edited)
    expect((await get(ratingRef(a.id))).val()).toEqual({ deleted: true, revision: 3, createdAt: a.createdAt, updatedAt: expect.any(Number) })
    expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings.map(r => r.id)).toEqual([b.id])
    expect((await get(bookRef())).val()).toEqual(original)
    expect((await get(notes)).val()).toEqual(beforeNote)
  })
  it.each([0, 6, 2.5, '3', null])('rejects invalid value %s through SDK and rules', async value => {
    await expect(create(value)).rejects.toMatchObject({ code: 'book-ratings/invalid-argument' })
    await denied(set(ratingRef(service.newBookRatingId(uid, bookId)), { ...raw(), value }))
  })
  it.each(['', '2025-02-29', '1900-02-29', '0000-01-01', '2024-04-31', '2024-1-01'])('rejects invalid new date %s', async date => {
    await expect(create(3, date)).rejects.toMatchObject({ code: 'book-ratings/invalid-argument' })
    await denied(set(ratingRef(service.newBookRatingId(uid, bookId)), { ...raw(), date }))
  })
  it.each(['0001-01-01', '2000-02-29', '9999-12-31'])('accepts civil date %s', async date => {
    expect(await create(3, date)).toMatchObject({ date })
  })
  it.each([2, 3])('isolates client %s', async index => {
    const rating = await create()
    await denied(get(ratingRef(rating.id, index)))
    await denied(set(ratingRef(service.newBookRatingId(uid, bookId), index), raw()))
    await denied(update(ratingRef(rating.id, index), { value: 1, revision: 2, updatedAt: serverTimestamp() }))
    await denied(set(ratingRef(rating.id, index), null))
  })
  it('rejects unknown fields, timestamps, revisions, ancestor writes and physical deletion', async () => {
    const rating = await create()
    for (const patch of [{ extra: true }, { revision: 1 }, { revision: 3 }, { createdAt: 1 }, { updatedAt: 1 }, { date: '' }]) {
      await denied(update(ratingRef(rating.id), { value: 2, revision: 2, updatedAt: serverTimestamp(), ...patch }))
    }
    await denied(set(ratingRef(rating.id), null))
    await denied(set(ref(clients[1].database, `users/${uid}/bookRatings/${bookId}`), {}))
    await denied(set(ref(clients[1].database, `users/${uid}/bookRatings`), {}))
  })
  it('accepts one concurrent editor and rejects stale edits/deletes without lost data', async () => {
    const rating = await create()
    const results = await Promise.allSettled([
      service.updateBookRatingEntry(uid, bookId, rating, { value: 1, date: '2024-01-01' }),
      service.updateBookRatingEntry(uid, bookId, rating, { value: 5, date: '2025-01-01' }),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected').reason.code).toBe('book-ratings/conflict')
    await expect(service.deleteBookRatingEntry(uid, bookId, rating)).rejects.toMatchObject({ code: 'book-ratings/conflict' })
    expect((await get(ratingRef(rating.id))).val().revision).toBe(2)
  })
  it('rejects stale update/create after deletion, including a deletion between preflight and transaction', async () => {
    const rating = await create()
    runTransaction.mockImplementationOnce(async (...args) => {
      await service.deleteBookRatingEntry(uid, bookId, rating)
      const sdk = await vi.importActual('firebase/database')
      return sdk.runTransaction(...args)
    })
    await expect(service.updateBookRatingEntry(uid, bookId, rating, { value: 1, date: '2026-01-01' })).rejects.toMatchObject({ code: 'book-ratings/conflict' })
    await expect(service.createBookRating(uid, bookId, rating.id, { value: 3, date: '2024-02-29' })).rejects.toMatchObject({ code: 'book-ratings/conflict' })
    await denied(set(ratingRef(rating.id), raw()))
    expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings).toEqual([])
  })
  it('retries an acknowledged creation at the same ID without duplicates or collisions', async () => {
    const rating = await create()
    expect(await service.createBookRating(uid, bookId, rating.id, { value: rating.value, date: rating.date })).toEqual(rating)
    await expect(service.createBookRating(uid, bookId, rating.id, { value: 5, date: rating.date })).rejects.toMatchObject({ code: 'book-ratings/conflict' })
    expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings).toHaveLength(1)
  })
  it.each(['reading', 'abandoned', 'to-read'])('does not enable creation for status %s', async status => {
    await update(bookRef(), { status })
    await expect(create()).rejects.toMatchObject({ code: 'book-ratings/status-conflict' })
    await denied(set(ratingRef(service.newBookRatingId(uid, bookId)), raw()))
    expect((await get(bookRef())).val()).toEqual({ ...original, status })
  })
  it('rejects writes if the book is deleted between preflight and commit', async () => {
    const rating = await create()
    runTransaction.mockImplementationOnce(async (...args) => {
      await set(bookRef(), null)
      return (await vi.importActual('firebase/database')).runTransaction(...args)
    })
    await denied(service.updateBookRatingEntry(uid, bookId, rating, { value: 1, date: '2026-01-01' }))
    expect((await get(bookRef())).exists()).toBe(false)
  })
})

describe('explicit rating conversion', () => {
  it('does not auto-convert, copies once with unknown date and preserves the source after edits/deletion', async () => {
    expect((await service.getBookRatingsForDisplay(uid, bookId)).legacy).toEqual({ status: 'unprocessed', value: 4 })
    expect((await get(markerRef())).exists()).toBe(false)
    await Promise.all([service.migrateLegacyBookRating(uid, bookId, 4), service.migrateLegacyBookRating(uid, bookId, 4)])
    let display = await service.getBookRatingsForDisplay(uid, bookId)
    expect(display.ratings).toHaveLength(1)
    const copy = display.ratings[0]
    expect(copy).toMatchObject({ id: 'legacy-rating-v1', value: 4, date: '', revision: 1 })
    const marker = (await get(markerRef())).val()
    const edited = await service.updateBookRatingEntry(uid, bookId, copy, { value: 2, date: '2000-02-29' })
    await service.deleteBookRatingEntry(uid, bookId, edited)
    await service.migrateLegacyBookRating(uid, bookId, 4)
    display = await service.getBookRatingsForDisplay(uid, bookId)
    expect(display).toEqual({ ratings: [], legacy: { status: 'processed' } })
    expect((await get(markerRef())).val()).toEqual(marker)
    expect((await get(bookRef())).val()).toEqual(original)
    await denied(set(ratingRef('legacy-rating-v1'), raw()))
    await denied(set(markerRef(), null))
  })
  it('rejects changed sources before conversion and at commit without a partial marker', async () => {
    await expect(service.migrateLegacyBookRating(uid, bookId, 3)).rejects.toMatchObject({ code: 'book-ratings/source-changed' })
    update.mockImplementationOnce(async (...args) => {
      await update(bookRef(), { rating: 2 })
      return (await vi.importActual('firebase/database')).update(...args)
    })
    await expect(service.migrateLegacyBookRating(uid, bookId, 4)).rejects.toMatchObject({ code: 'book-ratings/conflict' })
    expect((await get(markerRef())).exists()).toBe(false)
    expect((await get(ratingRef('legacy-rating-v1'))).exists()).toBe(false)
  })
  it('supports assigning a date later and editing stars while the historical date remains unknown', async () => {
    await service.migrateLegacyBookRating(uid, bookId, 4)
    const copy = (await service.getBookRatingsForDisplay(uid, bookId)).ratings[0]
    const changed = await service.updateBookRatingEntry(uid, bookId, copy, { value: 2, date: '' })
    expect(changed.date).toBe('')
    const dated = await service.updateBookRatingEntry(uid, bookId, changed, { value: 2, date: '2020-01-01' })
    await denied(update(ratingRef(dated.id), { date: '', revision: 4, updatedAt: serverTimestamp() }))
  })
  it('rejects marker-only, copy-only and combined library alteration conversions', async () => {
    await denied(set(markerRef(), { version: 1, sourceValue: 4, processedAt: serverTimestamp() }))
    await denied(set(ratingRef('legacy-rating-v1'), { ...raw(), value: 4, date: '' }))
    const writes = {
      [`bookRatingsLegacy/${bookId}`]: { version: 1, sourceValue: 4, processedAt: serverTimestamp() },
      [`bookRatings/${bookId}/legacy-rating-v1`]: { ...raw(), value: 4, date: '' },
      [`library/${bookId}/rating`]: 1,
    }
    await denied(update(ref(clients[1].database, `users/${uid}`), writes))
  })
})

it('retains the abandoned reading date when deleting a previously created rating', async () => {
  const rating = await create()
  await update(bookRef(), { status: 'abandoned' })
  await service.deleteBookRatingEntry(uid, bookId, rating)
  expect((await get(bookRef())).val()).toEqual({ ...original, status: 'abandoned' })
})
it('requires a complete minimal tombstone and rejects all resurrection paths', async () => {
  const rating = await create()
  await denied(set(ratingRef(rating.id), { deleted: true }))
  await service.deleteBookRatingEntry(uid, bookId, rating)
  await denied(update(ratingRef(rating.id), { deleted: null, ...raw() }))
  await denied(set(ratingRef(rating.id), null))
})
it('accepts an independent-client conversion winner without rewriting it', async () => {
  let winner
  update.mockImplementationOnce(async (...args) => {
    const sdk = await vi.importActual('firebase/database')
    await sdk.update(ref(clients[1].database, `users/${uid}`), args[1])
    winner = (await get(markerRef())).val()
    return sdk.update(...args)
  })
  expect(await service.migrateLegacyBookRating(uid, bookId, 4)).toEqual(winner)
  expect((await service.getBookRatingsForDisplay(uid, bookId)).ratings).toHaveLength(1)
})
it.each([2, 3])('denies conversion marker access to client %s', async index => {
  const marker = ref(clients[index].database, `users/${uid}/bookRatingsLegacy/${bookId}`)
  await denied(get(marker))
  await denied(set(marker, { version: 1, sourceValue: 4, processedAt: serverTimestamp() }))
})

describe('optional short impressions',()=>{
  const createWith = impression => service.createBookRating(uid,bookId,service.newBookRatingId(uid,bookId),{value:4,date:'2024-01-01',impression})
  it('creates, preserves across star/date edits, changes, clears and deletes an impression without touching historical book data',async()=>{
    const rating=await createWith('Une lecture lumineuse.')
    expect(rating.impression).toBe('Une lecture lumineuse.')
    const stars=await service.updateBookRatingEntry(uid,bookId,rating,{value:5,date:rating.date})
    expect(stars.impression).toBe(rating.impression)
    const dated=await service.updateBookRatingEntry(uid,bookId,stars,{value:5,date:'2025-01-01'})
    expect(dated.impression).toBe(rating.impression)
    const changed=await service.updateBookRatingEntry(uid,bookId,dated,{value:5,date:dated.date,impression:'Une impression différente.'})
    expect(changed.impression).toBe('Une impression différente.')
    const cleared=await service.updateBookRatingEntry(uid,bookId,changed,{value:5,date:changed.date,impression:''})
    expect(cleared).not.toHaveProperty('impression')
    const again=await service.updateBookRatingEntry(uid,bookId,cleared,{value:5,date:cleared.date,impression:'À supprimer'})
    await service.deleteBookRatingEntry(uid,bookId,again)
    const tombstone=(await get(ratingRef(rating.id))).val()
    expect(tombstone).not.toHaveProperty('impression')
    await denied(update(ratingRef(rating.id),{impression:'Ne pas rétablir'}))
    await expect(service.createBookRating(uid,bookId,rating.id,{value:4,date:'2024-01-01',impression:rating.impression})).rejects.toMatchObject({code:'book-ratings/conflict'})
    expect((await get(bookRef())).val()).toEqual(original)
  })
  it.each(['x'.repeat(160),'🙂'.repeat(80),'Du texte simple, même <3 ou <b>littéral</b>.',''])('accepts the 160 UTF-16 unit boundary and plain text: %#',async impression=>{
    const rating=await createWith(impression)
    if(impression) expect(rating.impression).toBe(impression)
    else expect(rating).not.toHaveProperty('impression')
    await set(ratingRef(service.newBookRatingId(uid,bookId)),{...raw(),impression})
  })
  it.each([null,42,true,{},[], 'x'.repeat(161),'🙂'.repeat(81),'deux\nlignes','tab\tici','\u0000','\u007f'])('rejects invalid impressions via service and bypassing client: %#',async impression=>{
    await expect(createWith(impression)).rejects.toMatchObject({code:'book-ratings/invalid-argument'})
    // RTDB null deletes an optional field; it is valid as a low-level removal.
    // Empty objects/arrays also normalize to absence in RTDB, so test actual types below.
    if(impression!==null && typeof impression!=='object') await denied(set(ratingRef(service.newBookRatingId(uid,bookId)),{...raw(),impression}))
  })
  it('denies structured impressions and invalid edits without changing the stored phrase',async()=>{
    const rating=await createWith('À conserver')
    for(const impression of [{text:'Object'},['Texte'],'x'.repeat(161),23]){
      await denied(update(ratingRef(rating.id),{impression,revision:2,updatedAt:serverTimestamp()}))
    }
    expect((await get(ratingRef(rating.id))).val().impression).toBe('À conserver')
  })
  it('does not invent impressions for old or converted ratings; allows adding one after conversion',async()=>{
    const old=await create()
    expect(old).not.toHaveProperty('impression')
    await service.migrateLegacyBookRating(uid,bookId,4)
    const copy=(await service.getBookRatingsForDisplay(uid,bookId)).ratings.find(r=>r.id==='legacy-rating-v1')
    expect(copy).not.toHaveProperty('impression')
    expect(copy.date).toBe('')
    const enriched=await service.updateBookRatingEntry(uid,bookId,copy,{value:4,date:'',impression:'Souvenir de lecture'})
    expect(enriched.impression).toBe('Souvenir de lecture')
    expect(enriched.date).toBe('')
    expect((await get(bookRef())).val()).toEqual(original)
  })
  it('rejects a conversion which tries to prefill the impression from legacy text',async()=>{
    await denied(update(ref(clients[1].database,`users/${uid}`),{
      [`bookRatingsLegacy/${bookId}`]:{version:1,sourceValue:4,processedAt:serverTimestamp()},
      [`bookRatings/${bookId}/legacy-rating-v1`]:{...raw(),value:4,date:'',impression:original.review},
    }))
    expect((await get(markerRef())).exists()).toBe(false)
  })
  it('preserves concurrent-write protection for impressions and other fields',async()=>{
    const rating=await createWith('Avant')
    const results=await Promise.allSettled([
      service.updateBookRatingEntry(uid,bookId,rating,{value:4,date:rating.date,impression:'Après'}),
      service.updateBookRatingEntry(uid,bookId,rating,{value:5,date:rating.date}),
    ])
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(results.find(r=>r.status==='rejected').reason.code).toBe('book-ratings/conflict')
    expect((await get(ratingRef(rating.id))).val().impression).toBe(results[0].status==='fulfilled'?'Après':'Avant')
  })
  it('retries creation only with the same impression',async()=>{
    const rating=await createWith('Identique')
    expect(await service.createBookRating(uid,bookId,rating.id,{value:4,date:rating.date,impression:'Identique'})).toEqual(rating)
    await expect(service.createBookRating(uid,bookId,rating.id,{value:4,date:rating.date,impression:'Autre'})).rejects.toMatchObject({code:'book-ratings/conflict'})
  })
})
