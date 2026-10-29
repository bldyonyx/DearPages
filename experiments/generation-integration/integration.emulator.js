import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, goOffline, goOnline, serverTimestamp } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext, createMembershipOperation } from '../../src/utils/generationCollectionContracts.js'
import { createNoteCreateOperation, createNoteConversionOperation, createNotePatchOperation, createNotePinOperation } from '../../src/utils/generationNoteContracts.js'
import { createRatingCreateOperation, createRatingConversionOperation, createRatingUpdateOperation } from '../../src/utils/generationRatingContracts.js'
import { createGenerationLibraryBook } from '../../src/utils/generationLibraryModel.js'
import { bookDataPath, bookLifecyclePath, bookLibraryPath, collectionCatalogPath, bookNotesPath, bookRatingsPath, bookCollectionMembershipsPath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationLibraryService } from '../../src/services/generationLibraryService.js'
import { createGenerationBookNotesService } from '../../src/services/generationBookNotesService.js'
import { createGenerationBookRatingsService } from '../../src/services/generationBookRatingsService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { createGenerationCollectionMembershipService } from '../../src/services/generationCollectionMembershipService.js'
import { verifyComposition } from './composeRules.mjs'

const clients = []
let uid, bookId, sequence = 0
const ctx = (generation = 1, id = bookId) => createBookMutationContext({ uid, bookId: id, generation })
const collection = (id, epoch = 1) => createCollectionContext({ uid, collectionId: `${bookId}-${id}`, epoch })
const observed = async path => (await get(ref(clients[1].database, path))).val()
const notePayload = title => ({ title, contentHtml: `Personal ${title}`, date: '2024-02-29' })
const ratingPayload = value => ({ value, date: '2024-02-29', impression: `Personal rating ${value}` })
const ratingA = '-1234567890123456789', ratingB = '-2234567890123456789', ratingLate = '-3234567890123456789'
function initial(context, sources = true) {
  const record = createGenerationLibraryBook({ id: context.bookId, title: 'Fictional integration book', authors: ['Author'], description: 'Private library description' }, 'to-read')
  return sources ? { ...record, note: 'Historical personal note', review: 'Historical personal review', rating: 4 } : record
}
async function activate(context = ctx(), sources = true) {
  const s = clients[0]
  await s.life.initializeProtocol(context)
  await s.life.initializeGeneration(context)
  await s.library.initializeLibrary(context, initial(context, sources))
  await s.life.activateGeneration(context)
  return context
}
beforeAll(async () => {
  await verifyComposition(); await assertEmulatorProject(); await assertEmulatorsReady()
  const email = `integration-${Date.now()}@example.test`, password = 'fictional-emulator-password'
  for (let index = 0; index < 3; index++) {
    const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `generation-integration-${index}`)
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const database = getDatabase(app); connectDatabaseEmulator(database, '127.0.0.1', 9000)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    else if (index === 1) await signInWithEmailAndPassword(auth, email, password)
    else await createUserWithEmailAndPassword(auth, `other-${email}`, password)
    clients.push({ app, database, life: createBookLifecycleService(database), library: createGenerationLibraryService(database),
      notes: createGenerationBookNotesService(database), ratings: createGenerationBookRatingsService(database),
      catalog: createGenerationCollectionCatalogService(database), memberships: createGenerationCollectionMembershipService(database) })
  }
})
beforeEach(() => { bookId = `integration-book-${++sequence}` })
afterEach(() => { for (const c of clients) goOnline(c.database) })
afterAll(async () => { for (const c of clients) { goOffline(c.database); await deleteApp(c.app) } })

it('runs all six real services from creation through conversions, clear/delete, complete purge and readd', async () => {
  const s = clients[0], context = await activate()
  await s.library.updateBookStatus(context, 'reading')
  expect(await s.notes.getNotes(context)).toEqual([]); expect(await s.ratings.getRatings(context)).toEqual([])
  expect(Object.keys(await observed(bookDataPath(context)))).toEqual(['library'])
  await s.notes.createNote(context, 'a', notePayload('A'))
  await s.notes.createNote(context, 'b', notePayload('B'))
  const a = await s.notes.getNote(context, 'a')
  await s.notes.patchNote(context, 'a', { title: 'Edited A' }, a.token)
  await s.notes.setPinned(context, 'a', true, a.token)
  expect(await s.notes.getNote(context, 'a')).toMatchObject({ title: 'Edited A', isPinned: true })
  await s.library.updateBookStatus(context, 'finished')
  await s.ratings.createRating(context, ratingA, ratingPayload(4)); await s.ratings.createRating(context, ratingB, ratingPayload(3))
  const rating = await s.ratings.getRating(context, ratingA)
  await s.ratings.updateRating(context, ratingA, ratingPayload(5), rating.token)
  const noteConversion = createNoteConversionOperation({ context, expected: (await s.notes.getLegacySource(context, 'note')).token, date: '2024-01-01' })
  const reviewConversion = createNoteConversionOperation({ context, expected: (await s.notes.getLegacySource(context, 'review')).token, date: '2024-01-01' })
  const ratingConversion = createRatingConversionOperation({ context, expected: (await s.ratings.getLegacySource(context)).token })
  for (const op of [noteConversion, reviewConversion]) { await s.notes.convertLegacy(op); await clients[1].notes.convertLegacy(op) }
  await s.ratings.convertLegacy(ratingConversion); await clients[1].ratings.convertLegacy(ratingConversion)
  expect((await s.notes.getNotes(context)).map(n => n.id).sort()).toEqual(['a', 'b', 'legacy-note-v1', 'legacy-review-v1'])
  expect((await s.ratings.getRating(context, 'legacy-rating-v1')).date).toBe('')
  const converted = await observed(bookDataPath(context))
  const legacyNote = await s.notes.getNote(context, 'legacy-note-v1')
  await s.notes.deleteNote(context, legacyNote.id, legacyNote.token); await s.notes.convertLegacy(noteConversion)
  expect(await s.notes.getNote(context, legacyNote.id)).toBeNull()
  const legacyRating = await s.ratings.getRating(context, 'legacy-rating-v1')
  await s.ratings.deleteRating(context, legacyRating.id, legacyRating.token); await s.ratings.convertLegacy(ratingConversion)
  expect(await s.ratings.getRating(context, legacyRating.id)).toBeNull()
  const afterConversionRetries = await observed(bookDataPath(context))
  for (const marker of ['bookNotesLegacy', 'bookReviewsLegacy', 'bookRatingsLegacy']) expect(afterConversionRetries[marker]).toEqual(converted[marker])
  expect(afterConversionRetries.library).toEqual(converted.library)
  const c1 = collection('clear'), c2 = collection('deleted'), c3 = collection('shared')
  for (const c of [c1, c2, c3]) { await s.catalog.createCollection(c, { name: c.collectionId, description: 'Collection metadata', icon: 'heart' }); await s.memberships.addBook(context, c) }
  const first = await s.memberships.getMembership(context, c1)
  const oldRemove = createMembershipOperation({ context, collection: c1, intent: 'remove', expected: first.token })
  await s.memberships.execute(oldRemove)
  await s.memberships.addBook(context, c1, (await s.memberships.getMembership(context, c1)).token)
  await expect(s.memberships.execute(oldRemove)).rejects.toThrow('revision-conflict')
  const clearMeta = await s.catalog.getCollection(c1)
  const cleared = await s.catalog.clearCollection(c1, '-1234567890123456789', clearMeta.token)
  expect((await s.memberships.getMembership(context, c1)).effective).toBe(false)
  expect((await s.memberships.getRawMembership(context, c1)).present).toBe(true)
  await expect(s.memberships.addBook(context, c1)).rejects.toThrow('stale-epoch')
  await s.memberships.addBook(context, cleared.context)
  const deleteMeta = await s.catalog.getCollection(c2); await s.catalog.deleteCollection(c2, deleteMeta.token)
  expect((await s.memberships.getMembership(context, c2)).effective).toBe(false)
  expect((await s.memberships.getRawMembership(context, c2)).present).toBe(true)
  await expect(s.memberships.addBook(context, c2)).rejects.toThrow('collection-deleted')
  const other = ctx(1, `${bookId}-kept`); await activate(other, false); await s.memberships.addBook(other, c3)
  const otherBefore = await observed(bookDataPath(other)), catalogBefore = await observed(collectionCatalogPath(uid))
  const lateNote = createNoteCreateOperation({ context, entryId: 'late', payload: notePayload('Late') })
  const lateRating = createRatingCreateOperation({ context, entryId: ratingLate, payload: ratingPayload(2) })
  const lateMember = createMembershipOperation({ context, collection: c3, intent: 'remove', expected: (await s.memberships.getMembership(context, c3)).token })
  const before = await observed(bookDataPath(context))
  expect(Object.keys(before).sort()).toEqual(['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collectionMemberships'].sort())
  expect(before.bookNotes['legacy-note-v1']).toEqual({ deleted: true, createdAt: legacyNote.createdAt })
  expect(before.bookRatings['legacy-rating-v1'].deleted).toBe(true)
  for (const source of ['note', 'review', 'rating']) expect(before.library).toHaveProperty(source)
  await s.life.lockDeletion(context)
  const refused = await Promise.allSettled([s.notes.execute(lateNote), s.ratings.execute(lateRating), s.memberships.execute(lateMember), s.library.updateBookStatus(context, 'reading')])
  expect(refused.every(r => r.status === 'rejected')).toBe(true); expect(await observed(bookDataPath(context))).toEqual(before)
  await s.life.purgeGeneration(context)
  expect(await observed(bookDataPath(context))).toBeNull()
  expect(await observed(`users/${uid}/bookData/${context.bookId}`)).toBeNull()
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'deleted' })
  expect(await observed(bookDataPath(other))).toEqual(otherBefore); expect(await observed(collectionCatalogPath(uid))).toEqual(catalogBefore)
  const next = await s.life.beginNextGeneration(context)
  await s.library.initializeLibrary(next, initial(next, false)); await s.life.activateGeneration(next)
  expect(next.generation).toBe(2); expect(context.generation).toBe(1)
  expect(await s.notes.getNotes(next)).toEqual([]); expect(await s.ratings.getRatings(next)).toEqual([])
  expect((await s.memberships.getBookMemberships(next)).effective).toEqual([])
  expect((await s.ratings.getLegacySource(next)).status).toBe('empty')
  expect((await s.notes.getLegacySource(next, 'note')).contentHtml).toBe('')
  const stale = await Promise.allSettled([s.notes.execute(lateNote), s.ratings.execute(lateRating), s.memberships.execute(lateMember), s.notes.convertLegacy(noteConversion), s.ratings.convertLegacy(ratingConversion)])
  expect(stale.every(r => r.status === 'rejected')).toBe(true)
  expect(Object.keys(await observed(bookDataPath(next)))).toEqual(['library'])
  expect(await observed(bookDataPath(context))).toBeNull()
}, 30000)

it.each([['updateBookNote', 'note'], ['updateBookReview', 'review']])('audits advertised library API %s against the immutable historical-source policy', async (method, field) => {
  const context = await activate(), s = clients[0]
  // All normal guards hold; a different legitimate library field remains writable.
  await s.library.updateBookStartedAt(context, 1700000000000)
  await s.notes.createNote(context, 'control', notePayload('Control'))
  const before = await observed(bookLibraryPath(context))
  await expect(s.library[method](context, 'Changed historical source'))
    .rejects.toMatchObject({ code: 'generation-library/historical-source-readonly' })
  await expect(s.library.updateLibraryFields(context, { startedAt: 123, [field]: 'Changed historical source' }))
    .rejects.toMatchObject({ code: 'generation-library/historical-source-readonly' })
  await expect(s.library.initializeLibrary(context, { ...before, [field]: 'Changed historical source' }))
    .rejects.toMatchObject({ code: 'generation-library/not-active' })
  expect(await observed(bookLibraryPath(context))).toEqual(before)
})


// Every independent observer uses a separate authenticated connection. Queue tests
// attach rejection handlers immediately; timeouts bound failures, never order races.
const location = (path, client = 0) => path ? ref(clients[client].database, path) : ref(clients[client].database)
const permissionDenied = promise => expect(promise).rejects.toThrow(/permission[ _-]?denied/i)
// Parent reads are intentionally denied; snapshot only individually readable branches.
const userSnapshot = async () => Object.fromEntries(await Promise.all(['bookProtocol', 'bookLifecycle', 'bookData', 'collectionCatalog'].map(async branch => [branch, await observed(`users/${uid}/${branch}`)])))
async function bounded(promise) {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SDK acknowledgement timeout')), 8000) })]) }
  finally { clearTimeout(timer) }
}
function queued(write) {
  let outcome = 'pending'
  const settled = write.then(() => { outcome = 'accepted'; return { outcome } }, error => { outcome = 'refused'; return { outcome, error } })
  return { settled, state: () => outcome }
}
async function readd(context) {
  const next = await clients[1].life.beginNextGeneration(context)
  await clients[1].library.initializeLibrary(next, initial(next, false))
  await clients[1].life.activateGeneration(next)
  return next
}
async function fixture() {
  const context = await activate(), s = clients[0], c = collection('matrix')
  await s.library.updateBookStatus(context, 'finished')
  await s.notes.createNote(context, 'existing', notePayload('Original'))
  await s.ratings.createRating(context, ratingA, ratingPayload(4))
  await s.catalog.createCollection(c, { name: 'Matrix', description: 'Personal collection' })
  await s.memberships.addBook(context, c)
  return { context, c, note: await s.notes.getNote(context, 'existing'), rating: await s.ratings.getRating(context, ratingA), member: await s.memberships.getMembership(context, c) }
}
async function capturedMutation(kind, f) {
  const { context, c, note, rating, member } = f
  const s = clients[0]
  if (kind === 'note.create') { const op = createNoteCreateOperation({ context, entryId: 'race', payload: notePayload('Race') }); return { run: () => s.notes.execute(op), op } }
  if (kind === 'note.patch') { const op = createNotePatchOperation({ context, entryId: 'existing', payload: { title: 'Race' }, expected: note.token }); return { run: () => s.notes.execute(op), op } }
  if (kind === 'note.pin') { const op = createNotePinOperation({ context, entryId: 'existing', isPinned: true, expected: note.token }); return { run: () => s.notes.execute(op), op } }
  if (kind === 'rating.create') { const op = createRatingCreateOperation({ context, entryId: ratingB, payload: ratingPayload(3) }); return { run: () => s.ratings.execute(op), op } }
  if (kind === 'rating.update') { const op = createRatingUpdateOperation({ context, entryId: ratingA, payload: ratingPayload(2), expected: rating.token }); return { run: () => s.ratings.execute(op), op } }
  if (kind === 'status') return { run: () => s.library.updateBookStatus(context, 'reading'), op: { context } }
  if (kind === 'membership.add') {
    await s.memberships.removeBook(context, c, member.token)
    const expected = (await s.memberships.getMembership(context, c)).token
    const op = createMembershipOperation({ context, collection: c, intent: 'add', expected })
    return { run: () => s.memberships.execute(op), op }
  }
  const op = createMembershipOperation({ context, collection: c, intent: 'remove', expected: member.token })
  return { run: () => s.memberships.execute(op), op }
}
const mutationKinds = ['note.create', 'note.patch', 'note.pin', 'rating.create', 'rating.update', 'status', 'membership.add', 'membership.remove']
it.each(mutationKinds)('races book deletion with %s and proves no resurrection after readd', async kind => {
  const f = await fixture(), intent = await capturedMutation(kind, f), other = await activate(ctx(1, `${bookId}-untouched`), false)
  const otherBefore = await observed(bookDataPath(other)), catalogBefore = await observed(collectionCatalogPath(uid))
  const [mutation, deletion] = await Promise.allSettled([intent.run(), clients[1].life.deleteGeneration(f.context)])
  console.info('BOOK_RACE', kind, mutation.status, mutation.reason?.code || '', deletion.status)
  expect(deletion.status).toBe('fulfilled')
  if (mutation.status === 'rejected') expect(String(mutation.reason.code || mutation.reason.message)).toMatch(/permission|active|generation|found|conflict|unconfirmed/i)
  expect(await observed(bookDataPath(f.context))).toBeNull()
  expect(await observed(bookLifecyclePath(f.context))).toEqual({ generation: 1, state: 'deleted' })
  const next = await readd(f.context), nextBefore = await observed(bookDataPath(next))
  await expect(intent.run()).rejects.toThrow()
  expect(intent.op.context.generation).toBe(1)
  if (intent.op.collection) expect(intent.op.collection.epoch).toBe(1)
  expect(await observed(bookDataPath(f.context))).toBeNull()
  expect(await observed(bookDataPath(next))).toEqual(nextBefore)
  expect(await observed(bookDataPath(other))).toEqual(otherBefore)
  expect(await observed(collectionCatalogPath(uid))).toEqual(catalogBefore)
})

it.each(['clear', 'delete'])('races Collection %s against add with explicit epoch outcome', async action => {
  const context = await activate(), c = collection('race'), s = clients[0]
  await s.catalog.createCollection(c, { name: 'Race' })
  const token = (await s.catalog.getCollection(c)).token
  const op = createMembershipOperation({ context, collection: c, intent: 'add', expected: null })
  const [addition, change] = await Promise.allSettled([s.memberships.execute(op), action === 'clear'
    ? clients[1].catalog.clearCollection(c, ratingA, token) : clients[1].catalog.deleteCollection(c, token)])
  expect(change.status).toBe('fulfilled')
  if (addition.status === 'rejected') expect(String(addition.reason.code || addition.reason.message)).toMatch(/epoch|deleted|permission|conflict/i)
  const view = await s.memberships.getMembership(context, c), raw = await s.memberships.getRawMembership(context, c)
  expect(view.effective).toBe(false)
  expect(raw === null || JSON.stringify(raw) === JSON.stringify(op.payload)).toBe(true)
  console.info('COLLECTION_RACE', action, addition.status, raw === null ? 'absent' : 'residual-epoch-1')
  const before = await observed(bookDataPath(context))
  await expect(s.memberships.execute(op)).rejects.toThrow(action === 'clear' ? 'stale-epoch' : 'collection-deleted')
  expect(op.collection.epoch).toBe(1); expect(await observed(bookDataPath(context))).toEqual(before)
  if (action === 'clear') {
    await clients[1].catalog.clearCollection(c, ratingA, token) // same clear intent: never increments twice
    expect((await observed(collectionCatalogPath(uid, c.collectionId))).membershipEpoch).toBe(2)
    await s.memberships.addBook(context, change.value.context)
    expect((await s.memberships.getMembership(context, change.value.context)).effective).toBe(true)
  }
})

it('rejects competing stale membership removals after explicit remove/readd', async () => {
  const { context, c, member } = await fixture(), s = clients[0]
  const old = createMembershipOperation({ context, collection: c, intent: 'remove', expected: member.token })
  await Promise.all([s.memberships.execute(old), clients[1].memberships.execute(old)])
  const removed = await s.memberships.getMembership(context, c)
  expect(removed.raw).toMatchObject({ present: false, revision: 2 })
  await s.memberships.addBook(context, c, removed.token)
  const before = await observed(bookDataPath(context))
  await expect(s.memberships.execute(old)).rejects.toThrow('revision-conflict')
  expect((await s.memberships.getMembership(context, c)).raw).toMatchObject({ present: true, revision: 3 })
  expect(await observed(bookDataPath(context))).toEqual(before)
})

it('serializes competing delete/readd attempts without double generation increment', async () => {
  const context = await activate(), s = clients[0]
  await Promise.all([s.life.deleteGeneration(context), clients[1].life.deleteGeneration(context)])
  const results = await Promise.allSettled([s.life.beginNextGeneration(context), clients[1].life.beginNextGeneration(context)])
  expect(results.some(r => r.status === 'fulfilled')).toBe(true)
  for (const r of results) if (r.status === 'fulfilled') expect(r.value.generation).toBe(2)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 2, state: 'creating' })
  expect(await observed(bookDataPath(context))).toBeNull()
  const next = ctx(2); await s.library.initializeLibrary(next, initial(next, false)); await s.life.activateGeneration(next)
  await expect(s.life.beginNextGeneration(context)).rejects.toThrow()
  expect(await observed(bookLifecyclePath(next))).toEqual({ generation: 2, state: 'active' })
  expect(Object.keys(await observed(bookDataPath(next)))).toEqual(['library'])
})

// Raw valid payloads are captured from real service-created records. These queues
// exercise the server independently of service preflights/REST availability.
it.each(['locked', 'purged', 'readded'].flatMap(state => ['note', 'rating', 'status'].map(kind => [state, kind])))('refuses a real offline %s book queue for %s', async (state, kind) => {
  const { context } = await fixture(), base = bookDataPath(context)
  // Positive online controls prove the queued payload category is otherwise legal.
  if (kind === 'note') await update(location(bookNotesPath(context, 'existing')), { title: 'Control', 'fieldRevisions/title': 2, updatedAt: serverTimestamp() })
  else if (kind === 'rating') await update(location(bookRatingsPath(context, ratingA)), { value: 3, revision: 2, updatedAt: serverTimestamp() })
  else { await update(location(bookLibraryPath(context)), { status: 'reading', finishedAt: null, updatedAt: serverTimestamp() }); await clients[0].library.updateBookStatus(context, 'finished') }
  const before = await observed(base)
  goOffline(clients[0].database)
  const pending = queued(kind === 'note' ? update(location(bookNotesPath(context, 'existing')), {
    title: 'Offline', 'fieldRevisions/title': 3, updatedAt: serverTimestamp(),
  }) : kind === 'rating' ? update(location(bookRatingsPath(context, ratingA)), {
    value: 1, revision: 3, updatedAt: serverTimestamp(),
  }) : update(location(bookLibraryPath(context)), { status: 'reading', finishedAt: null, updatedAt: serverTimestamp() }))
  await clients[1].life.lockDeletion(context)
  expect(pending.state()).toBe('pending') // server barrier, no arbitrary sleep
  expect(await observed(base)).toEqual(before)
  let next, nextBefore
  if (state !== 'locked') { await clients[1].life.purgeGeneration(context); expect(await observed(base)).toBeNull() }
  if (state === 'readded') { next = await readd(context); nextBefore = await observed(bookDataPath(next)) }
  goOnline(clients[0].database)
  const result = await bounded(pending.settled)
  console.info('OFFLINE_RESULT', result.outcome, result.error?.code)
  expect(result.outcome).toBe('refused'); expect(String(result.error.code)).toMatch(/permission.denied/i)
  expect(await observed(base)).toEqual(state === 'locked' ? before : null)
  if (next) expect(await observed(bookDataPath(next))).toEqual(nextBefore)
  if (state === 'locked') { await clients[1].life.purgeGeneration(context); expect(await observed(base)).toBeNull() }
})

it.each(['clear', 'delete', 'remove-readd'])('refuses an offline membership intent after %s', async action => {
  const { context, c, member } = await fixture(), s = clients[1], path = bookCollectionMembershipsPath(context, c.collectionId)
  if (action !== 'remove-readd') await s.memberships.removeBook(context, c, member.token)
  goOffline(clients[0].database)
  const pending = queued(set(location(path), action === 'remove-readd' ? { epoch: 1, present: false, revision: 2 } : { epoch: 1, present: true, revision: 3 }))
  if (action === 'clear') await s.catalog.clearCollection(c, ratingA, (await s.catalog.getCollection(c)).token)
  else if (action === 'delete') await s.catalog.deleteCollection(c, (await s.catalog.getCollection(c)).token)
  else {
    await s.memberships.removeBook(context, c, member.token)
    await s.memberships.addBook(context, c, (await s.memberships.getMembership(context, c)).token)
  }
  const before = await observed(path)
  expect(pending.state()).toBe('pending')
  goOnline(clients[0].database)
  const result = await bounded(pending.settled)
  console.info('OFFLINE_RESULT', result.outcome, result.error?.code)
  expect(result.outcome).toBe('refused'); expect(String(result.error.code)).toMatch(/permission.denied/i)
  expect(await observed(path)).toEqual(before)
  expect(before.revision).toBe(action === 'remove-readd' ? 3 : 2)
  expect((await s.memberships.getMembership(context, c)).effective).toBe(action === 'remove-readd')
})

it('distinguishes an accepted SDK write before lock from an offline pending acknowledgement', async () => {
  const { context } = await fixture(), path = bookNotesPath(context, 'existing')
  await update(location(path), { title: 'Accepted before lock', 'fieldRevisions/title': 2, updatedAt: serverTimestamp() })
  const committed = await observed(path)
  expect(committed.title).toBe('Accepted before lock')
  goOffline(clients[0].database)
  await clients[1].life.lockDeletion(context)
  expect(await observed(path)).toEqual(committed)
  await clients[1].life.purgeGeneration(context)
  expect(await observed(bookDataPath(context))).toBeNull()
})

it.each(['note', 'rating'])('reconciles a %s commit with a discarded caller confirmation, without duplicate data', async kind => {
  const context = await activate(), s = clients[0]
  await s.library.updateBookStatus(context, 'finished')
  const op = kind === 'note' ? createNoteCreateOperation({ context, entryId: 'uncertain', payload: notePayload('Uncertain') })
    : createRatingCreateOperation({ context, entryId: ratingA, payload: ratingPayload(4) })
  const service = kind === 'note' ? s.notes : s.ratings
  // Caller-boundary fault after a REAL SDK commit, not simulated TCP ack loss.
  await expect((async () => { await service.execute(op); throw new Error('discarded-confirmation') })()).rejects.toThrow('discarded-confirmation')
  const before = await observed(bookDataPath(context))
  await (kind === 'note' ? clients[1].notes : clients[1].ratings).execute(op)
  expect(await observed(bookDataPath(context))).toEqual(before)
  expect(Object.keys(before[kind === 'note' ? 'bookNotes' : 'bookRatings'])).toHaveLength(1)
})

it.each(['note', 'review', 'rating'])('races %s conversion against lock and purges source, marker and destination', async kind => {
  const context = await activate(), s = clients[0]
  await s.library.updateBookStatus(context, 'finished')
  const op = kind === 'rating' ? createRatingConversionOperation({ context, expected: (await s.ratings.getLegacySource(context)).token })
    : createNoteConversionOperation({ context, expected: (await s.notes.getLegacySource(context, kind)).token, date: '2024-01-01' })
  const convert = () => kind === 'rating' ? s.ratings.convertLegacy(op) : s.notes.convertLegacy(op)
  const [conversion, lock] = await Promise.allSettled([convert(), clients[1].life.lockDeletion(context)])
  expect(lock.status).toBe('fulfilled')
  if (conversion.status === 'rejected') expect(String(conversion.reason.code || conversion.reason.message)).toMatch(/active|permission|conflict/i)
  const raw = await observed(bookDataPath(context)), marker = kind === 'rating' ? 'bookRatingsLegacy' : kind === 'note' ? 'bookNotesLegacy' : 'bookReviewsLegacy'
  const branch = kind === 'rating' ? 'bookRatings' : 'bookNotes', id = `legacy-${kind}-v1`
  console.info('CONVERSION_RACE', kind, conversion.status, raw[marker] ? 'atomic-pair-present' : 'atomic-pair-absent')
  expect(Boolean(raw[marker])).toBe(Boolean(raw[branch]?.[id])) // atomic pair even if promise rejected
  expect(raw.library[kind]).toBe(initial(context)[kind])
  await clients[1].life.purgeGeneration(context)
  expect(await observed(`users/${uid}/bookData/${context.bookId}`)).toBeNull()
  const next = await readd(context), before = await observed(bookDataPath(next))
  await expect(convert()).rejects.toThrow()
  expect(await observed(bookDataPath(next))).toEqual(before)
  expect(Object.keys(before)).toEqual(['library'])
})

const attacks = ['other-owner', 'stale-generation', 'creating', 'locked', 'purged', 'deleted-collection', 'stale-epoch',
  'stale-note-revision', 'stale-rating-revision', 'stale-membership-revision', 'note-tombstone', 'rating-tombstone', 'collection-tombstone',
  'note-null', 'rating-null', 'membership-null', 'catalog-null', 'generation-ancestor', 'user-ancestor', 'hostile-multipath',
  'note-identity', 'rating-identity', 'catalog-identity', 'historical-note', 'historical-review', 'cross-branch-status', 'cross-branch-lock', 'forged-conversion']
it.each(attacks)('denies direct authenticated SDK attack: %s', async attack => {
  const f = await fixture(), { context, c, note, rating, member } = f, s = clients[0]
  const base = bookDataPath(context), np = bookNotesPath(context, 'existing'), rp = bookRatingsPath(context, ratingA), mp = bookCollectionMembershipsPath(context, c.collectionId), cp = collectionCatalogPath(uid, c.collectionId)
  let target = np, client = 0, payload = { title: 'Attack', 'fieldRevisions/title': 2, updatedAt: serverTimestamp() }, replace = false
  if (attack === 'other-owner') client = 2
  if (attack === 'stale-generation') { await s.life.deleteGeneration(context); await readd(context) }
  if (attack === 'creating') { const next = ctx(1, `${bookId}-creating`); await s.life.initializeGeneration(next); await s.library.initializeLibrary(next, initial(next)); target = bookNotesPath(next, 'existing') }
  if (attack === 'locked' || attack === 'purged') { await s.life.lockDeletion(context); if (attack === 'purged') await s.life.purgeGeneration(context) }
  if (['deleted-collection', 'stale-epoch', 'stale-membership-revision'].includes(attack)) {
    target = mp; replace = true; payload = { epoch: 1, present: false, revision: 2 }
    if (attack === 'deleted-collection') await s.catalog.deleteCollection(c, (await s.catalog.getCollection(c)).token)
    if (attack === 'stale-epoch') await s.catalog.clearCollection(c, ratingA, (await s.catalog.getCollection(c)).token)
    if (attack === 'stale-membership-revision') { await s.memberships.removeBook(context, c, member.token); await s.memberships.addBook(context, c, (await s.memberships.getMembership(context, c)).token) }
  }
  if (attack === 'stale-note-revision') { await s.notes.patchNote(context, 'existing', { title: 'New' }, note.token) }
  if (attack === 'stale-rating-revision') { await s.ratings.updateRating(context, ratingA, ratingPayload(5), rating.token); target = rp; payload = { value: 2, revision: 2, updatedAt: serverTimestamp() } }
  if (attack === 'note-tombstone') { payload = await observed(np); replace = true; await s.notes.deleteNote(context, 'existing', note.token) }
  if (attack === 'rating-tombstone') { payload = { ...await observed(rp), revision: 3, updatedAt: serverTimestamp() }; replace = true; await s.ratings.deleteRating(context, ratingA, rating.token); target = rp }
  if (attack === 'collection-tombstone') { payload = await observed(cp); replace = true; await s.catalog.deleteCollection(c, (await s.catalog.getCollection(c)).token); target = cp }
  const nullPaths = { 'note-null': np, 'rating-null': rp, 'membership-null': mp, 'catalog-null': cp }
  if (attack in nullPaths) { target = nullPaths[attack]; payload = null; replace = true }
  if (attack === 'generation-ancestor' || attack === 'user-ancestor') { target = attack === 'generation-ancestor' ? base : `users/${uid}`; payload = attack === 'user-ancestor' ? await userSnapshot() : await observed(target); replace = true }
  if (attack === 'hostile-multipath') { target = ''; payload = { [`${bookLibraryPath(context)}/startedAt`]: 777, [`users/${getAuth(clients[2].app).currentUser.uid}/bookProtocol`]: { version: 2, state: 'ready' } } }
  if (attack === 'note-identity') payload = { createdAt: note.createdAt + 1 }
  if (attack === 'rating-identity') { target = rp; payload = { createdAt: rating.createdAt + 1 } }
  if (attack === 'catalog-identity') { target = cp; payload = { createdAt: (await observed(cp)).createdAt + 1 } }
  if (attack === 'historical-note' || attack === 'historical-review') { target = bookLibraryPath(context); payload = { [attack.slice(11)]: 'Attack' } }
  if (attack === 'cross-branch-status') { target = base; payload = { 'library/status': 'reading', [`bookRatings/${ratingA}/value`]: 2, [`bookRatings/${ratingA}/revision`]: 2, [`bookRatings/${ratingA}/updatedAt`]: serverTimestamp() } }
  if (attack === 'cross-branch-lock') { target = `users/${uid}`; payload = { [`bookLifecycle/${bookId}/state`]: 'deleting', [`bookData/${bookId}/1/bookNotes/existing/title`]: 'Attack', [`bookData/${bookId}/1/bookNotes/existing/fieldRevisions/title`]: 2, [`bookData/${bookId}/1/bookNotes/existing/updatedAt`]: serverTimestamp() } }
  if (attack === 'forged-conversion') { target = `${base}/bookNotesLegacy`; replace = true; payload = { version: 1, sourceHtml: 'Forged', intent: 'forged', outcome: 'empty', processedAt: serverTimestamp() } }
  const before = await userSnapshot()
  await permissionDenied(replace ? set(location(target, client), payload) : update(location(target, client), payload))
  expect(await userSnapshot()).toEqual(before)
})

it.each(mutationKinds)('accepts %s before lock, refuses replay after lock, then purges it physically', async kind => {
  const f = await fixture(), { context, c } = f, intent = await capturedMutation(kind, f)
  await intent.run()
  const committed = await observed(bookDataPath(context))
  if (kind === 'note.create') expect(committed.bookNotes.race).toMatchObject({ title: 'Race', contentHtml: 'Personal Race' })
  if (kind === 'note.patch') expect(committed.bookNotes.existing).toMatchObject({ title: 'Race', fieldRevisions: { title: 2 } })
  if (kind === 'note.pin') expect(committed.bookNotes.existing.isPinned).toBe(true)
  if (kind === 'rating.create') expect(committed.bookRatings[ratingB].value).toBe(3)
  if (kind === 'rating.update') expect(committed.bookRatings[ratingA]).toMatchObject({ value: 2, revision: 2 })
  if (kind === 'status') expect(committed.library.status).toBe('reading')
  if (kind === 'membership.add') expect(committed.collectionMemberships[c.collectionId]).toMatchObject({ present: true, revision: 3 })
  if (kind === 'membership.remove') expect(committed.collectionMemberships[c.collectionId]).toMatchObject({ present: false, revision: 2 })
  await clients[1].life.lockDeletion(context)
  await expect(intent.run()).rejects.toThrow()
  expect(await observed(bookDataPath(context))).toEqual(committed)
  await clients[1].life.purgeGeneration(context)
  expect(await observed(`users/${uid}/bookData/${context.bookId}`)).toBeNull()
  expect(intent.op.context.generation).toBe(1)
})
