import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createGenerationApplicationService } from '../../src/services/generationApplicationService.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext, createCollectionSelection } from '../../src/utils/generationCollectionContracts.js'
import { createCatalogOperation } from '../../src/utils/generationCollectionCatalogModel.js'
import { createNoteCreateOperation, createNoteConversionOperation } from '../../src/utils/generationNoteContracts.js'
import { createRatingCreateOperation, createRatingConversionOperation } from '../../src/utils/generationRatingContracts.js'
import { captureMembershipBatch } from '../../src/utils/generationMembershipBatchContracts.js'
import { createBookRecoveryIntent } from '../../src/utils/generationRecoveryContracts.js'
import { prototype } from './prototype.mjs'
import { verify } from './composeRules.mjs'

const clients = [], live = new Set()
let uid, email, serial = 0
const password = 'fictional-password'
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const ctx = (bookId = 'book', generation = 1) => createBookMutationContext({ uid, bookId, generation })
const collection = (collectionId = 'collection', epoch = 1) => createCollectionContext({ uid, collectionId, epoch })
const app = () => clients[0].facade
const read = suffix => clients[1].observer.read(uid, path(suffix))
const recoveryIntent = (context = ctx()) => createBookRecoveryIntent({ context, intentId: 'resume', kind: 'resume-deletion', initializationId: null })
const record = (context = ctx(), extras = {}) => ({ id: context.bookId, title: 'Fictional book', status: 'to-read', addedAt: 100, ...extras })
async function client() {
  const sdk = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `application-${++serial}`)
  const auth = getAuth(sdk); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(sdk); connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const result = { sdk, auth, db, observer: prototype(db) }
  live.add(result)
  return result
}
async function close(current) { goOffline(current.db); await deleteApp(current.sdk); live.delete(current) }
// Explicit synthetic provisioning for the test fixture, OUTSIDE the facade.
// This pre-existing proof protocol is not a faithful migration or an app bootstrap.
async function provisionFixture(state = 'ready', current = clients[0], owner = uid) {
  await update(ref(current.db), {
    [`users/${owner}/bookProtocol`]: { version: 2, state: 'migrating' },
    [`users/${owner}/bookMigration`]: { id: 'application-fixture', version: 1 },
    [`accountControl/${owner}/legacyClosed`]: true,
  })
  if (state === 'ready') await set(ref(current.db, `users/${owner}/bookProtocol/state`), 'ready')
}
async function createBook(context = ctx(), extras = {}, facade = app()) {
  if (context.generation === 1) await facade.books.initializeGeneration(context)
  else {
    const next = await facade.books.beginNextGeneration(ctx(context.bookId, context.generation - 1))
    expect(next).toEqual(context)
  }
  await facade.library.initializeLibrary(context, record(context, extras))
  await facade.books.activateGeneration(context)
  return context
}
async function batch(rows = [{ bookId: 'book', collectionId: 'collection', before: { exists: false }, desired: true }], sequence = 1, intent = 'memberships') {
  const captured = []
  for (const row of rows) {
    const meta = await read(`collectionCatalog/${row.collectionId}`)
    captured.push({ generation: 1, epoch: meta.membershipEpoch, catalogCreatedAt: meta.createdAt, ...row })
  }
  return captureMembershipBatch(uid, intent, sequence, captured)
}
async function setupMemberships() {
  await provisionFixture(); await createBook(); await createBook(ctx('other'))
  await app().collections.createCollection(collection(), { name: 'Collection' })
}
function blockedCalls(facade = app()) {
  const op = captureMembershipBatch(uid, 'blocked', 1, [{ bookId: 'book', generation: 1, collectionId: 'collection', epoch: 1, catalogCreatedAt: 100, before: { exists: false }, desired: true }])
  return [
    () => facade.books.getContext('book'), () => facade.books.initializeGeneration(ctx()),
    () => facade.library.initializeLibrary(ctx(), record()), () => facade.library.getActiveBooks(),
    () => facade.notes.createNote(ctx(), 'n', { contentHtml: 'Text', date: '2026-11-06' }),
    () => facade.ratings.createRating(ctx(), '-1234567890123456789', { value: 4, date: '2026-11-06' }),
    () => facade.collections.createCollection(collection(), { name: 'Collection' }),
    () => facade.memberships.getBookMemberships(ctx()), () => facade.batches.execute(op),
    () => facade.books.deleteGeneration(ctx()), () => facade.recovery.discover(),
    () => facade.recovery.resumeDeletion(recoveryIntent()),
  ]
}
beforeAll(async () => { await verify(); await assertEmulatorProject(); await assertEmulatorsReady() })
beforeEach(async () => {
  clients.push(await client(), await client())
  email = `application-${Date.now()}-${serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, password)
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
  await set(ref(clients[0].db, path('profile')), { displayName: 'Fictional reader', email, createdAt: 100 })
  await set(ref(clients[0].db, path('preferences')), { language: 'fr', annualGoal: 12 })
  clients.forEach(current => { current.facade = createGenerationApplicationService(current.db, { uid }) })
})
afterEach(async () => { vi.restoreAllMocks(); for (const current of [...live]) await close(current); clients.length = 0 })

it('application: refuses non-demo databases and exposes no bootstrap or account deletion', () => {
  expect(() => createGenerationApplicationService({ app: { options: { projectId: 'real' } } }, { uid })).toThrow('emulator-only')
  expect(Object.isFrozen(app())).toBe(true)
  expect(app().books.initializeProtocol).toBeUndefined()
  expect(app().deleteAccount).toBeUndefined(); expect(app().migrate).toBeUndefined()
  expect(app().memberships.addBook).toBeUndefined(); expect(app().library.deleteGeneration).toBeUndefined()
})
it('application: an absent protocol is never permission to initialize even an empty library', async () => {
  const before = await read('')
  for (const call of blockedCalls()) await expect(call()).rejects.toThrow('generation-app/protocol-required')
  expect(await read('')).toEqual(before)
  expect(await read('bookProtocol')).toBeNull(); expect(await read('bookData')).toBeNull()
})
it('application: legacy accounts retain every branch, preferences, profile and Auth identity', async () => {
  const legacy = {
    library: { old: { id: 'old', title: 'Historical title', status: 'finished', note: 'Personal source', review: 'Personal review', rating: 5, addedAt: 10 } },
    collections: { c: { name: 'Historical collection', books: { old: true } } },
    bookNotes: { old: { note: { title: 'Personal note', contentHtml: 'Keep text', date: '2020-01-01', createdAt: 10, updatedAt: 10 } } },
    bookNotesLegacy: { old: { version: 1, outcome: 'copied', sourceHtml: 'Source', processedAt: 10 } },
    bookReviewsLegacy: { old: { version: 1, outcome: 'empty', sourceHtml: '', processedAt: 10 } },
    bookRatings: { old: { '-1234567890123456789': { deleted: true, revision: 2, createdAt: 10, updatedAt: 20 } } },
    bookRatingsLegacy: { old: { version: 1, sourceValue: 4, processedAt: 10 } },
  }
  await update(ref(clients[0].db, path('')), legacy)
  const before = await read(''), control = await clients[1].observer.read(uid, `accountControl/${uid}`)
  for (const call of blockedCalls()) await expect(call()).rejects.toThrow('generation-app/legacy-unmigrated')
  expect(await read('')).toEqual(before)
  expect(await clients[1].observer.read(uid, `accountControl/${uid}`)).toEqual(control)
  await signOut(clients[1].auth)
  expect((await signInWithEmailAndPassword(clients[1].auth, email, password)).user.uid).toBe(uid)
  expect(await read('')).toEqual(before)
})
it('application: migrating accounts block all operations without advancing the protocol', async () => {
  await provisionFixture('migrating'); const before = await read('')
  for (const call of blockedCalls()) await expect(call()).rejects.toThrow('generation-app/protocol-migrating')
  expect(await read('')).toEqual(before)
})
it.each([{ version: 1, state: 'ready' }, { version: 2, state: 'deleting' }, { version: 2, state: 'invalid' }, { version: 2, state: 'ready', extra: true }])('application: invalid observed protocol is refused: %j', async protocol => {
  await provisionFixture(); const before = await read('')
  const facade = createGenerationApplicationService(clients[0].db, { uid, fetch: async (...args) => {
    const response = await fetch(...args)
    if (!new URL(args[0]).pathname.startsWith('/users/')) return response
    const state = await response.json(); state.bookProtocol = protocol
    return { ok: true, status: 200, json: async () => state }
  } })
  await expect(facade.books.initializeGeneration(ctx())).rejects.toThrow('generation-app/invalid-protocol')
  await expect(set(ref(clients[0].db, path('bookProtocol')), protocol)).rejects.toThrow(/permission[ _-]?denied/i)
  expect(await read('')).toEqual(before)
})
it('application: ready with legacy residue in an observation is also refused', async () => {
  await provisionFixture(); const before = await read('')
  const facade = createGenerationApplicationService(clients[0].db, { uid, fetch: async (...args) => {
    const response = await fetch(...args)
    if (!new URL(args[0]).pathname.startsWith('/users/')) return response
    const state = await response.json(); state.library = { old: { note: 'retained' } }
    return { ok: true, status: 200, json: async () => state }
  } })
  await expect(facade.books.initializeGeneration(ctx())).rejects.toThrow('legacy-unmigrated')
  expect(await read('')).toEqual(before)
})
it('application: a ready synthetic account supports explicit book initialization and library changes', async () => {
  await provisionFixture()
  expect(await app().books.getContext('book')).toBeNull()
  await app().books.initializeGeneration(ctx())
  expect(await app().books.getContext('book')).toEqual({ context: ctx(), state: 'creating' })
  await app().library.initializeLibrary(ctx(), record())
  const discovery = await app().recovery.discover()
  expect(discovery.actions[0].kind).toBe('review-creation')
  await app().books.activateGeneration(ctx())
  expect(await app().books.getContext('book')).toEqual({ context: ctx(), state: 'active' })
  const captured = (await app().books.getContext('book')).context
  expect(Object.isFrozen(captured)).toBe(true)
  await app().library.updateBookStatus(captured, 'reading')
  await app().library.updateBookStartedAt(captured, 50)
  await app().library.updateBookStatus(captured, 'finished')
  await app().library.updateBookFinishedAt(captured, 200)
  await app().library.updateBookRating(captured, 4)
  expect((await app().library.getActiveBooks()).map(item => item.context)).toEqual([captured])
  expect((await app().library.getActiveBook(captured)).book).toMatchObject({ status: 'finished', startedAt: 50, finishedAt: 200, rating: 4 })
  await expect(app().library.updateLibraryFields(captured, { finishedAt: 250 }, { expected: { finishedAt: 199 } })).rejects.toThrow('field-conflict')
})
it('application: notes keep CAS, field revisions, pin semantics and terminal tombstones', async () => {
  await provisionFixture(); await createBook()
  const op = createNoteCreateOperation({ context: ctx(), entryId: 'n', payload: { title: 'Title', contentHtml: 'Private note', date: '2026-11-06' } })
  await app().notes.execute(op); await app().notes.execute(op)
  const original = await app().notes.getNote(ctx(), 'n')
  await app().notes.patchNote(ctx(), 'n', { title: 'Changed' }, original.token)
  const edited = await app().notes.getNote(ctx(), 'n')
  expect(edited.fieldRevisions).toEqual({ title: 2, contentHtml: 1, date: 1 })
  await expect(app().notes.patchNote(ctx(), 'n', { title: 'Stale' }, original.token)).rejects.toThrow('field-conflict')
  await app().notes.setPinned(ctx(), 'n', true, edited.token)
  const pinned = await app().notes.getNote(ctx(), 'n')
  expect(pinned.updatedAt).toBe(edited.updatedAt)
  await app().notes.saveNote(ctx(), 'n', { title: 'Changed', contentHtml: 'Edited content', date: '2026-11-05' }, pinned.token)
  const latest = await app().notes.getNote(ctx(), 'n')
  expect((await app().notes.getNotes(ctx()))).toHaveLength(1)
  await app().notes.deleteNote(ctx(), 'n', latest.token)
  expect(await app().notes.getNotes(ctx())).toEqual([])
  expect((await read('bookData/book/1/bookNotes/n')).deleted).toBe(true)
  await expect(app().notes.execute(op)).rejects.toThrow('creation-conflict')
})
it('application: rating creation, reconciliation, revisions, stale CAS and deletion are preserved', async () => {
  await provisionFixture(); await createBook(); await app().library.updateBookStatus(ctx(), 'finished')
  const id = '-1234567890123456789'
  const op = createRatingCreateOperation({ context: ctx(), entryId: id, payload: { value: 4, date: '2026-11-06', impression: 'Private impression' } })
  await app().ratings.execute(op)
  expect((await app().ratings.reconcile(op)).rating.revision).toBe(1)
  const first = await app().ratings.getRating(ctx(), id)
  await app().ratings.updateRating(ctx(), id, { value: 5, date: '2026-11-05' }, first.token)
  const updated = await app().ratings.getRating(ctx(), id)
  expect(updated.revision).toBe(2)
  await expect(app().ratings.updateRating(ctx(), id, { value: 3, date: '2026-11-05' }, first.token)).rejects.toThrow('conflict')
  await app().ratings.deleteRating(ctx(), id, updated.token)
  expect(await app().ratings.getRatings(ctx())).toEqual([])
  expect(await read(`bookData/book/1/bookRatings/${id}`)).toMatchObject({ deleted: true, revision: 3 })
  await expect(app().ratings.execute(op)).rejects.toThrow()
})
it('application: explicit source conversions delegate without automatic migration or duplicate copies', async () => {
  await provisionFixture(); await createBook(ctx(), { note: 'Source note', review: 'Source review', rating: 4 })
  await app().library.updateBookStatus(ctx(), 'finished')
  const source = await app().notes.getLegacySource(ctx(), 'note')
  expect(await app().notes.getNotes(ctx())).toEqual([])
  const op = createNoteConversionOperation({ context: ctx(), expected: source.token, date: '2026-11-06' })
  await app().notes.convertLegacy(op); await app().notes.convertLegacy(op)
  expect(await app().notes.getNotes(ctx())).toHaveLength(1)
  const rating = await app().ratings.getLegacySource(ctx())
  const conversion = createRatingConversionOperation({ context: ctx(), expected: rating.token })
  await app().ratings.convertLegacy(conversion); await app().ratings.reconcile(conversion)
  expect(await app().ratings.getRatings(ctx())).toHaveLength(1)
  expect((await app().library.getActiveBook(ctx())).book).toMatchObject({ note: 'Source note', review: 'Source review', rating: 4 })
})
it('application: catalog revisions, atomic multi-book batches, epochs and receipt reconciliation', async () => {
  await setupMemberships()
  const create = createCatalogOperation({ type: 'catalog.create', context: collection('second'), payload: { name: 'Second' } })
  await app().collections.execute(create); await app().collections.reconcile(create)
  let meta = await app().collections.getCollection(collection())
  await app().collections.updateMetadata(meta.context, { name: 'Renamed' }, meta.token)
  meta = await app().collections.getCollection(collection())
  expect(meta.revision).toBe(2)
  await app().collections.setPinned(meta.context, true, meta.token)
  meta = await app().collections.getCollection(collection())
  const op = await batch([{ bookId: 'book', collectionId: 'collection', before: { exists: false }, desired: true }, { bookId: 'other', collectionId: 'collection', before: { exists: false }, desired: true }])
  expect((await app().batches.execute(op)).status).toBe('confirmed')
  const snapshot = await read('')
  expect((await app().batches.execute(op)).status).toBe('confirmed')
  expect(await read('')).toEqual(snapshot)
  expect((await app().batches.reconcile(op)).status).toBe('confirmed')
  const membership = await app().memberships.getMembership(ctx(), collection())
  expect(membership).toMatchObject({ effective: true, raw: { epoch: 1, revision: 1, present: true } })
  expect((await app().memberships.getBookMemberships(ctx())).effective).toHaveLength(1)
  const selection = createCollectionSelection({ collection: collection(), entries: [{ context: ctx(), expected: membership.token }] })
  expect(await app().memberships.verifySelection(selection)).toEqual(selection)
  expect(await app().memberships.getRawMembership(ctx(), collection())).toEqual(membership.raw)
  const cleared = await app().collections.clearCollection(meta.context, '-1234567890123456789', meta.token)
  expect(cleared.context.epoch).toBe(2)
  expect((await app().memberships.getMembership(ctx(), collection('collection', 2))).effective).toBe(false)
  const stale = captureMembershipBatch(uid, 'stale-epoch', 2, [{ bookId: 'book', generation: 1, collectionId: 'collection', epoch: 1, catalogCreatedAt: meta.createdAt, before: { exists: true, ...membership.raw }, desired: false }])
  expect((await app().batches.execute(stale)).status).toBe('rejected')
  const readd = await batch([{ bookId: 'book', collectionId: 'collection', before: { exists: true, ...membership.raw }, desired: true }], 2, 'epoch-two')
  expect((await app().batches.execute(readd)).status).toBe('confirmed')
  expect((await app().memberships.getMembership(ctx(), cleared.context)).raw).toEqual({ epoch: 2, revision: 1, present: true })
  const current = await app().collections.getCollection(cleared.context)
  await app().collections.deleteCollection(current.context, current.token)
  expect((await app().memberships.getBookMemberships(ctx())).effective).toHaveLength(0)
  expect((await app().collections.getCatalog()).map(c => c.id)).toEqual(['second'])
})
it('application: concurrent batch intentions keep one sequence winner and no partial loser', async () => {
  await setupMemberships(); await app().collections.createCollection(collection('second'), { name: 'Second' })
  const a = await batch(), b = await batch([{ bookId: 'other', collectionId: 'second', before: { exists: false }, desired: true }], 1, 'competing')
  const outcomes = await Promise.all([app().batches.execute(a), clients[1].facade.batches.execute(b)])
  expect(outcomes.map(result => result.status).sort()).toEqual(['confirmed', 'conflict'])
  const rows = [await read('bookData/book/1/collectionMemberships'), await read('bookData/other/1/collectionMemberships')]
  expect(rows.filter(value => value !== null)).toHaveLength(1)
})
it('application: purge and explicit readd never inherit sources, entries, markers or memberships', async () => {
  await setupMemberships(); await app().notes.createNote(ctx(), 'n', { contentHtml: 'Private content', date: '2026-11-06' })
  await app().library.updateBookStatus(ctx(), 'finished')
  await app().ratings.createRating(ctx(), '-1234567890123456789', { value: 4, date: '2026-11-06' })
  const op = await batch(); await app().batches.execute(op)
  const old = ctx(), other = await read('bookData/other'), catalog = await read('collectionCatalog'), profile = await read('profile'), prefs = await read('preferences')
  expect((await app().books.deleteGeneration(old)).status).toBe('confirmed')
  expect(await read('bookData/book')).toBeNull(); expect(await read('batchReceipts')).toBeNull()
  expect((await read('batchHead')).sequence).toBe(1)
  expect((await app().batches.execute(op)).status).toBe('indeterminate')
  await createBook(ctx('book', 2))
  expect((await app().books.getContext('book')).context.generation).toBe(2)
  expect((await app().books.deleteGeneration(old)).status).toBe('stale')
  await expect(app().notes.createNote(old, 'delayed', { contentHtml: 'Old', date: '2026-11-06' })).rejects.toThrow('stale-generation')
  expect(await app().notes.getNotes(ctx('book', 2))).toEqual([])
  expect(await app().ratings.getRatings(ctx('book', 2))).toEqual([])
  expect((await app().memberships.getBookMemberships(ctx('book', 2))).effective).toEqual([])
  const book = (await app().library.getActiveBook(ctx('book', 2))).book
  for (const field of ['note', 'review', 'rating']) expect(book[field]).toBeUndefined()
  expect(await read('bookData/book/1')).toBeNull()
  expect(await read('bookData/other')).toEqual(other); expect(await read('collectionCatalog')).toEqual(catalog)
  expect(await read('profile')).toEqual(profile); expect(await read('preferences')).toEqual(prefs)
  expect(clients[0].auth.currentUser.uid).toBe(uid)
})
it('application: interrupted deletion is discovered and resumed via a new owner-bound facade', async () => {
  await setupMemberships(); await app().batches.execute(await batch())
  await app().books.lockDeletion(ctx())
  await expect(app().notes.createNote(ctx(), 'late', { contentHtml: 'Late', date: '2026-11-06' })).rejects.toThrow('not-active')
  const oldName = clients[0].sdk.name
  await close(clients[0]); expect(getApps().some(sdk => sdk.name === oldName)).toBe(false)
  const fresh = await client(); await signInWithEmailAndPassword(fresh.auth, email, password)
  const facade = createGenerationApplicationService(fresh.db, { uid })
  const action = (await facade.recovery.discover()).actions[0]
  expect(action).toEqual({ kind: 'resume-deletion', context: ctx() })
  const intent = recoveryIntent(action.context)
  expect((await facade.recovery.reconcile(intent)).status).toBe('pending')
  expect((await facade.recovery.resumeDeletion(intent)).status).toBe('confirmed')
  expect((await facade.recovery.reconcile(intent)).status).toBe('confirmed')
  expect(await read('bookData/book')).toBeNull(); expect((await read('batchHead')).sequence).toBe(1)
})
it('application: creating remains an explicit decision and no read activates it', async () => {
  await provisionFixture(); await app().books.initializeGeneration(ctx()); await app().library.initializeLibrary(ctx(), record())
  expect((await app().recovery.discover()).actions[0].kind).toBe('review-creation')
  expect((await app().recovery.resumeDeletion(recoveryIntent())).status).toBe('decision-required')
  expect((await app().books.getContext('book')).state).toBe('creating')
})
it.each(['deleting', 'deleted'])('application: terminal account %s blocks every namespace', async state => {
  await provisionFixture(); await createBook()
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'deleting', legacyClosed: true })
  if (state === 'deleted') {
    await set(ref(clients[0].db, path('')), null)
    await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'deleted', legacyClosed: true })
  }
  const before = await read('')
  for (const call of blockedCalls()) await expect(call()).rejects.toThrow('generation-app/account-terminal')
  expect(await read('')).toEqual(before)
  expect(clients[0].auth.currentUser.uid).toBe(uid)
})
it('application: a terminal fence installed after preflight still denies the delegated purge', async () => {
  await provisionFixture(); await createBook()
  const facade = createGenerationApplicationService(clients[0].db, { uid, update: async (...args) => {
    await set(ref(clients[1].db, `accountControl/${uid}`), { state: 'deleting', legacyClosed: true })
    return update(...args)
  } })
  await expect(facade.books.deleteGeneration(ctx())).rejects.toThrow('account-terminal')
  expect(await read('bookData/book/1/library')).not.toBeNull()
})
it('application: old facade and captured contexts cannot follow an Auth account switch', async () => {
  await provisionFixture(); await createBook(); const before = await read('')
  const stranger = await client(), otherEmail = `application-other-${serial}@example.test`
  const otherUid = (await createUserWithEmailAndPassword(stranger.auth, otherEmail, password)).user.uid
  await set(ref(stranger.db, `accountControl/${otherUid}`), { state: 'active', legacyClosed: false })
  await provisionFixture('ready', stranger, otherUid)
  const otherBefore = await stranger.observer.read(otherUid, `users/${otherUid}`)
  await signInWithEmailAndPassword(clients[0].auth, otherEmail, password)
  for (const call of blockedCalls()) await expect(call()).rejects.toThrow('owner-mismatch')
  const next = createGenerationApplicationService(clients[0].db, { uid: otherUid })
  await expect(next.books.deleteGeneration(ctx())).rejects.toThrow('owner-mismatch')
  expect(await read('')).toEqual(before)
  expect(await stranger.observer.read(otherUid, `users/${otherUid}`)).toEqual(otherBefore)
})
it('application: a scope change during an awaited gate cannot write with the old facade', async () => {
  await provisionFixture(); const before = await read('')
  let switched = false
  const facade = createGenerationApplicationService(clients[0].db, { uid, fetch: async (...args) => {
    const response = await fetch(...args)
    if (!switched) { switched = true; await signOut(clients[0].auth) }
    return response
  } })
  await expect(facade.books.initializeGeneration(ctx())).rejects.toThrow('owner-mismatch')
  expect(await read('')).toEqual(before)
})
it.each(['network', 'denied', 'server', 'invalid-json'])('application: %s preflight fails closed without creating anything', async fault => {
  await provisionFixture(); const before = await read('')
  const facade = createGenerationApplicationService(clients[0].db, { uid, fetch: async () => {
    if (fault === 'network') throw new Error('offline')
    if (fault === 'denied') return { ok: false, status: 403 }
    if (fault === 'server') return { ok: false, status: 503 }
    return { ok: true, status: 200, json: () => { throw new SyntaxError('invalid') } }
  } })
  const codes = { network: 'network-error', denied: 'permission-denied', server: 'server-error', 'invalid-json': 'invalid-observation' }
  await expect(facade.books.initializeGeneration(ctx())).rejects.toThrow(`generation-app/${codes[fault]}`)
  expect(await read('')).toEqual(before)
})
it('application: a transport failure retains native uncertain outcome and never allocates a retry', async () => {
  await setupMemberships(); let writes = 0
  const op = await batch()
  const facade = createGenerationApplicationService(clients[0].db, { uid, update: () => { writes++; throw new Error('transport') } })
  expect(await facade.batches.execute(op)).toEqual({ status: 'uncertain', canRetry: false })
  expect(writes).toBe(1); expect(await read('batchHead')).toBeNull()
  expect(await app().batches.reconcile(op)).toEqual({ status: 'not-committed', canRetry: true })
})
it('application: lost caller confirmation reconciles the original receipt without duplicate mutation', async () => {
  await setupMemberships(); let writes = 0
  const op = await batch()
  const facade = createGenerationApplicationService(clients[0].db, { uid, update: async (...args) => { writes++; await update(...args); throw new Error('lost ack') } })
  expect((await facade.batches.execute(op)).status).toBe('confirmed')
  expect(writes).toBe(1)
  const before = await read('')
  expect((await facade.batches.execute(op)).status).toBe('confirmed')
  expect(writes).toBe(1); expect(await read('')).toEqual(before)
})
it('application: a failed postflight is never success or proof of rollback', async () => {
  await setupMemberships(); const op = await batch(); let committed = false, writes = 0
  const facade = createGenerationApplicationService(clients[0].db, { uid,
    fetch: (...args) => { if (committed) throw new Error('lost observation'); return fetch(...args) },
    update: async (...args) => { writes++; await update(...args); committed = true },
  })
  await expect(facade.batches.execute(op)).rejects.toThrow('generation-app/network-error')
  expect(writes).toBe(1)
  expect((await app().batches.reconcile(op)).status).toBe('confirmed')
  expect((await read('bookData/book/1/collectionMemberships/collection')).revision).toBe(1)
})
it('application: mutable payloads are captured before awaits while retry envelopes must stay frozen', async () => {
  await provisionFixture(); await createBook()
  const payload = { title: 'Captured', contentHtml: 'Captured content', date: '2026-11-06' }
  const pending = app().notes.createNote(ctx(), 'captured', payload)
  payload.title = 'Changed after call'; await pending
  expect((await app().notes.getNote(ctx(), 'captured')).title).toBe('Captured')
  const op = createNoteCreateOperation({ context: ctx(), entryId: 'new', payload: { contentHtml: 'New', date: '2026-11-06' } })
  await expect(app().notes.execute(structuredClone(op))).rejects.toThrow('frozen')
})
it('application: Auth changing while a response body is decoded also fails closed', async () => {
  await provisionFixture(); const before = await read('')
  let switched = false
  const facade = createGenerationApplicationService(clients[0].db, { uid, fetch: async (...args) => {
    const response = await fetch(...args)
    return { ok: response.ok, status: response.status, json: async () => {
      const value = await response.json()
      if (!switched) { switched = true; await signOut(clients[0].auth) }
      return value
    } }
  } })
  await expect(facade.books.initializeGeneration(ctx())).rejects.toThrow('generation-app/owner-mismatch')
  expect(await read('')).toEqual(before)
})
