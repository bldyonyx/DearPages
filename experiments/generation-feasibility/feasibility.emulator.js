import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationLibraryService } from '../../src/services/generationLibraryService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext } from '../../src/utils/generationCollectionContracts.js'
import { captureBatch, prototype } from './prototype.mjs'
import { verify } from './composeRules.mjs'
import { simulate } from './simulate.mjs'

const clients = []
let uid, serial = 0
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const context = (bookId = 'book', generation = 1) => createBookMutationContext({ uid, bookId, generation })
const cctx = (collectionId = 'collection', epoch = 1) => createCollectionContext({ uid, collectionId, epoch })
const write = (suffix, value, index = 0) => set(ref(clients[index].db, path(suffix)), value)
const multipath = (values, index = 0) => update(ref(clients[index].db), values)
const read = suffix => clients[1].p.read(uid, path(suffix))
const denied = async (promise) => expect(promise).rejects.toThrow(/permission[ _-]?denied/i)
const account = value => set(ref(clients[0].db, `accountControl/${uid}`), value)
const fence = state => account({ state, legacyClosed: state !== 'active' })
const absent = { exists: false }
const raw = (epoch = 1, present = true, revision = 1) => ({ exists: true, epoch, present, revision })
const batch = (rows, sequence = 1, intent = `intent-${serial}`) => captureBatch(uid, intent, sequence, rows)
const freezeMigration = (id = 'migration') => multipath({
  [path('bookProtocol')]: { version: 2, state: 'migrating' },
  [path('bookMigration')]: { id, version: 1 },
  [`accountControl/${uid}/legacyClosed`]: true,
})
async function ready() { await freezeMigration(); await write('bookProtocol/state', 'ready') }
async function activate(bookId = 'book', generation = 1, sources = false) {
  const c = context(bookId, generation), s = clients[0]
  if (generation === 1) await s.life.initializeGeneration(c)
  else await s.life.beginNextGeneration(context(bookId, generation - 1))
  await s.library.initializeLibrary(c, { id: bookId, title: 'Fictional book', status: 'to-read', addedAt: 100,
    ...(sources ? { note: 'Fictional private note', review: 'Fictional private review', rating: 4 } : {}) })
  await s.life.activateGeneration(c)
}
async function catalog(id = 'collection') { await clients[0].catalog.createCollection(cctx(id), { name: 'Fictional collection' }) }
async function row(bookId = 'book', collectionId = 'collection', before = absent, desired = true, generation = 1, epoch = 1) {
  const meta = await read(`collectionCatalog/${collectionId}`)
  return { bookId, generation, collectionId, epoch, catalogCreatedAt: meta.createdAt, before, desired }
}
async function setup() { await ready(); await activate(); await catalog() }
async function purge(bookId = 'book', generation = 1) {
  await clients[0].life.lockDeletion(context(bookId, generation))
  await multipath({ [path(`bookData/${bookId}/${generation}`)]: null, [path(`bookLifecycle/${bookId}`)]: { generation, state: 'deleted' }, [path('batchReceipts')]: null, [path('purgeContext')]: { bookId, generation } })
}
async function attack(values, index = 0) {
  const before = await read('')
  await denied(multipath(values, index))
  expect(await read('')).toEqual(before)
}
async function queuedAcross(action, barrier) {
  goOffline(clients[0].db)
  let settled = false
  const pending = action().then(() => { settled = true; return 'accepted' }, error => { settled = true; return /permission[ _-]?denied/i.test(error.message) ? 'denied' : 'other' })
  await barrier()
  expect(settled).toBe(false)
  goOnline(clients[0].db)
  let timer
  try { expect(await Promise.race([pending, new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), 8000) })])).toBe('denied') }
  finally { clearTimeout(timer) }
}
beforeAll(async () => {
  await verify(); await assertEmulatorProject(); await assertEmulatorsReady()
  for (let i = 0; i < 3; i++) {
    const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `feasibility-${i}`)
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
    clients.push({ app, auth, db, p: prototype(db), life: createBookLifecycleService(db), library: createGenerationLibraryService(db), catalog: createGenerationCollectionCatalogService(db) })
  }
  await createUserWithEmailAndPassword(clients[2].auth, `other-${Date.now()}@example.test`, 'fictional-password')
})
beforeEach(async () => {
  const email = `proof-${Date.now()}-${++serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, 'fictional-password')).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, 'fictional-password')
  await fence('active')
})
afterEach(() => { clients.forEach(c => goOnline(c.db)) })
afterAll(async () => { for (const c of clients) { goOffline(c.db); await deleteApp(c.app) } })

it('A: freezes protocol, migration identity and external legacy barrier atomically', async () => {
  await write('library/old', { title: 'Before freeze' })
  await denied(write('bookProtocol', { version: 2, state: 'migrating' }))
  expect(await read('bookProtocol')).toBeNull()
  await freezeMigration()
  expect(await read('library/old')).toEqual({ title: 'Before freeze' })
  expect(await read('bookProtocol')).toEqual({ version: 2, state: 'migrating' })
  expect(await clients[1].p.read(uid, `accountControl/${uid}`)).toEqual({ state: 'active', legacyClosed: true })
})
it.each(['library', 'collections', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy'])('A: old SDK writes and null deletion denied on %s after freeze', async branch => {
  await write(`${branch}/old`, 'retained'); await freezeMigration()
  await attack({ [path(`${branch}/old`)]: 'stale' })
  await attack({ [path(branch)]: null })
})
it('A: queued legacy write prepared before freeze is rejected after reconnect', async () => {
  await write('library/old', 'before')
  await queuedAcross(() => write('library/old', 'queued'), async () => {
    await multipath({ [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'migration', version: 1 }, [`accountControl/${uid}/legacyClosed`]: true }, 1)
    expect((await read('bookProtocol')).state).toBe('migrating')
  })
  expect(await read('library/old')).toBe('before')
})
it('A: hostile mixed multipath, ancestor replacement and protocol null are atomic denials', async () => {
  await freezeMigration()
  await attack({ [path('library/old')]: 'stale', [path('importWitness')]: { migrationId: 'migration', value: 'valid control' } })
  await attack({ [path('')]: { bookProtocol: { version: 2, state: 'ready' } } })
  await attack({ [path('bookProtocol')]: null })
  await write('importWitness', { migrationId: 'migration', value: 'accepted import control' })
  expect((await read('importWitness')).value).toBe('accepted import control')
})
it('A: two migrating clients have one identity; resume reads it, different migration denied', async () => {
  const values = id => ({ [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id, version: 1 }, [`accountControl/${uid}/legacyClosed`]: true })
  const outcomes = await Promise.allSettled([multipath(values('first')), multipath(values('second'), 1)])
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
  const stored = await read('bookMigration')
  expect(['first', 'second']).toContain(stored.id)
  expect(await clients[0].p.read(uid, path('bookMigration'))).toEqual(stored)
  await attack({ [path('bookMigration')]: { id: 'different', version: 1 } })
})
it('A: ready requires legacy purge and cannot return to migrating or reopen legacy', async () => {
  await write('library/old', 'personal'); await freezeMigration()
  await denied(write('bookProtocol/state', 'ready'))
  await multipath({ [path('library')]: null, [path('bookProtocol/state')]: 'ready' })
  await attack({ [path('bookProtocol/state')]: 'migrating' })
  await attack({ [`accountControl/${uid}/legacyClosed`]: false })
  await attack({ [path('library/old')]: 'resurrected' })
  expect(await read('library')).toBeNull()
})

it('B/C: one row, activity, normal confirmation and identical retry mutate only once', async () => {
  await setup(); const op = batch([await row()])
  expect(await clients[0].p.execute(op)).toBe('confirmed')
  const stored = await read('')
  expect(stored.bookData.book[1].collectionMemberships.collection).toEqual({ epoch: 1, present: true, revision: 1 })
  expect(stored.collectionActivity.collection.at).toBeGreaterThan(0)
  expect(await clients[1].p.execute(op)).toBe('confirmed')
  expect(await read('')).toEqual(stored)
})
it('B: several books in one collection commit atomically', async () => {
  await setup(); await activate('second')
  await clients[0].p.execute(batch([await row(), await row('second')]))
  expect((await read('bookData/second/1/collectionMemberships/collection')).present).toBe(true)
  expect((await read('bookData/book/1/collectionMemberships/collection')).present).toBe(true)
})
it('B: several collections for one book commit atomically', async () => {
  await setup(); await catalog('second')
  await clients[0].p.execute(batch([await row(), await row('book', 'second')]))
  expect(Object.keys(await read('bookData/book/1/collectionMemberships'))).toHaveLength(2)
  expect(Object.keys(await read('collectionActivity'))).toHaveLength(2)
})
it('B: unchanged present and physically absent guards do not create rows or increment revisions', async () => {
  await setup(); await catalog('absent'); await clients[0].p.execute(batch([await row()]))
  const activityBefore = await read('collectionActivity')
  await clients[0].p.execute(batch([await row('book', 'collection', raw(), true), await row('book', 'absent', absent, false)], 2))
  expect(await read('bookData/book/1/collectionMemberships/collection')).toEqual({ epoch: 1, present: true, revision: 1 })
  expect(await read('bookData/book/1/collectionMemberships/absent')).toBeNull()
  expect(await read('collectionActivity')).toEqual(activityBefore)
})
it('B: absent no-op guard becoming present rejects all changed rows', async () => {
  await setup(); await catalog('second')
  const stale = batch([await row('book', 'collection', absent, false), await row('book', 'second')], 2)
  await clients[1].p.execute(batch([await row()], 1, 'winner'))
  await attack(clients[0].p.writes(stale))
  expect(await read('bookData/book/1/collectionMemberships/second')).toBeNull()
})
it('B: unchanged present guard with stale revision rejects all rows', async () => {
  await setup(); await catalog('second'); await clients[0].p.execute(batch([await row()]))
  const stale = batch([await row('book', 'collection', raw(), true), await row('book', 'second')], 3)
  await clients[1].p.execute(batch([await row('book', 'collection', raw(), false)], 2, 'remove'))
  await attack(clients[0].p.writes(stale))
})
it('B: residual old epoch is guarded exactly and explicit add creates current epoch revision one', async () => {
  await setup(); await clients[0].p.execute(batch([await row()]))
  const meta = await clients[0].catalog.getCollection(cctx())
  await clients[0].catalog.clearCollection(cctx(), '-1234567890123456789', meta.token)
  expect(await read('bookData/book/1/collectionMemberships/collection')).toEqual({ epoch: 1, present: true, revision: 1 })
  await clients[0].p.execute(batch([await row('book', 'collection', raw(), true, 1, 2)], 2))
  expect(await read('bookData/book/1/collectionMemberships/collection')).toEqual({ epoch: 2, present: true, revision: 1 })
})
it.each(['generation', 'epoch', 'identity', 'revision'])('B: server refuses captured stale %s without JS preflight', async field => {
  await setup(); const op = structuredClone(batch([await row()]))
  if (field === 'generation') op.guards[0].generation = 2
  if (field === 'epoch') op.guards[0].epoch = 2
  if (field === 'identity') op.guards[0].catalogCreatedAt++
  if (field === 'revision') op.guards[0].before = raw(1, true, 99)
  await attack(clients[0].p.writes(op))
})
it.each(['clear', 'delete', 'book-lock'])('B: %s after selection invalidates the entire batch', async kind => {
  await setup(); const op = batch([await row()])
  const meta = await clients[0].catalog.getCollection(cctx())
  if (kind === 'clear') await clients[0].catalog.clearCollection(cctx(), '-1234567890123456789', meta.token)
  if (kind === 'delete') await clients[0].catalog.deleteCollection(cctx(), meta.token)
  if (kind === 'book-lock') await clients[0].life.lockDeletion(context())
  await attack(clients[0].p.writes(op))
})
it('B: two concurrent batches have one sequence winner and no partial losing effects', async () => {
  await setup(); await catalog('second')
  const ops = [batch([await row()], 1, 'one'), batch([await row('book', 'second')], 1, 'two')]
  const outcomes = await Promise.allSettled(ops.map((op, i) => clients[i].p.execute(op)))
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
  expect(Object.keys(await read('bookData/book/1/collectionMemberships'))).toHaveLength(1)
  expect((await read('batchHead')).sequence).toBe(1)
})
it.each(['partial', 'unlisted', 'ancestor', 'null', 'activity-only', 'receipt-only', 'head-only'])('B: hostile SDK %s rejected with unchanged server', async kind => {
  await setup(); await activate('second')
  const op = batch([await row(), await row('second')]); let values = clients[0].p.writes(op)
  if (kind === 'partial') delete values[path('bookData/second/1/collectionMemberships/collection')]
  if (kind === 'unlisted') values[path('bookData/unlisted/1/collectionMemberships/collection')] = { epoch: 1, present: true, revision: 1 }
  if (kind === 'ancestor') values = { [path('bookData')]: { forged: true } }
  if (kind === 'null') values[path('bookData/book/1/collectionMemberships/collection')] = null
  if (kind === 'activity-only') values = { [path('collectionActivity/collection')]: { at: Date.now(), catalogCreatedAt: 1 } }
  if (kind === 'receipt-only') values = { [path('batchReceipts/1')]: op }
  if (kind === 'head-only') values = { [path('batchHead')]: { sequence: 1, slot: 1, intent: 'forged' } }
  await attack(values)
})
it('B: pin and metadata edits preserve independent membership activity', async () => {
  await setup(); const meta = await clients[0].catalog.getCollection(cctx())
  await clients[0].catalog.setPinned(cctx(), true, meta.token)
  await clients[0].p.execute(batch([await row()]))
  expect((await read('collectionCatalog/collection')).pinned).toBe(true)
  expect((await read('collectionActivity/collection')).at).toBeGreaterThan(0)
})

it('C: discarded caller confirmation is reconciled without second mutation', async () => {
  await setup(); const op = batch([await row()])
  await multipath(clients[0].p.writes(op)) // Commit, intentionally discard result.
  const before = await read('')
  expect(await clients[1].p.reconcile(op)).toBe('confirmed')
  expect(await clients[1].p.execute(op)).toBe('confirmed')
  expect(await read('')).toEqual(before)
})
it('C: different envelope or occupied sequence conflicts; direct identical replay denied', async () => {
  await setup(); const op = batch([await row()], 1, 'intent-37'); console.log('DIAGNOSTIC envelope: initial commit');
  try { await clients[0].p.execute(op) } catch (error) { await simulate(uid, clients[0].p.writes(op)); throw error }
  console.log('DIAGNOSTIC envelope: compare different envelope')
  const different = batch([await row('book', 'collection', absent, false)], 1, op.intent)
  expect(await clients[1].p.reconcile(different)).toBe('conflict')
  await expect(clients[1].p.execute(different)).rejects.toThrow('conflict')
  console.log('DIAGNOSTIC envelope: direct identical replay'); await attack(clients[0].p.writes(op))
})
it('C: 65 commits evict first receipt; unknown old outcome never replays', async () => {
  await setup(); const first = batch([await row()], 1, 'first'); console.log('DIAGNOSTIC eviction: commit 1');
  try { await clients[0].p.execute(first) } catch (error) { await simulate(uid, clients[0].p.writes(first)); throw error }
  const activityBefore = await read('collectionActivity')
  for (let n = 2; n <= 65; n++) { console.log(`DIAGNOSTIC eviction: commit ${n}, slot ${n % 64}`); await clients[0].p.execute(batch([await row('book', 'collection', raw(), true)], n, `noop-${n}`)) }
  const receipts = await read('batchReceipts')
  expect(Object.keys(receipts)).toHaveLength(64)
  expect(receipts[0].sequence).toBe(64); expect(receipts[1].sequence).toBe(65)
  for (let slot = 2; slot < 64; slot++) expect(receipts[slot].sequence).toBe(slot)
  expect((await read('batchHead')).sequence).toBe(65)
  expect(await read('bookData/book/1/collectionMemberships/collection')).toEqual({ epoch: 1, present: true, revision: 1 })
  expect(await read('collectionActivity')).toEqual(activityBefore)
  expect(await clients[1].p.reconcile(first)).toBe('indeterminate')
  await expect(clients[1].p.execute(first)).rejects.toThrow('indeterminate')
  await attack(clients[0].p.writes(first))
})
it('C/composed: book purge removes relational receipts, retains sequence, old replay fails after readd', async () => {
  await ready(); await activate('book', 1, true); await catalog()
  const op = batch([await row()]); await clients[0].p.execute(op)
  expect(await read('bookData/book/1/library')).toMatchObject({ note: 'Fictional private note', review: 'Fictional private review', rating: 4 })
  await clients[0].life.lockDeletion(context())
  await expect(clients[0].life.purgeGeneration(context())).rejects.toMatchObject({ code: 'book-lifecycle/transition-conflict' }) // Receipt-aware contract required.
  await purge()
  expect(await read('batchReceipts')).toBeNull(); expect(await read('bookData/book')).toBeNull()
  expect((await read('batchHead')).sequence).toBe(1)
  expect(await clients[1].p.reconcile(op)).toBe('indeterminate')
  await expect(clients[1].p.execute(op)).rejects.toThrow('indeterminate')
  await activate('book', 2)
  await attack(clients[0].p.writes(op))
  const staleAtNextSequence = structuredClone(op)
  staleAtNextSequence.sequence = 2; staleAtNextSequence.intent = 'stale-at-next-sequence'
  await attack(clients[0].p.writes(staleAtNextSequence))
  expect(await read('bookData/book/1')).toBeNull()
  expect(await read('bookData/book/2/collectionMemberships')).toBeNull()
  const readded = await read('bookData/book/2/library')
  for (const source of ['note', 'review', 'rating']) expect(readded).not.toHaveProperty(source)
})
it('C: head cannot jump near limit; last integer boundary tested by direct SDK rejection', async () => {
  await setup(); const last = batch([await row()], 2147483647, 'last')
  await attack(clients[0].p.writes(last))
  expect(() => batch([{}], 2147483648)).toThrow('batch bounds')
  expect(await read('batchHead')).toBeNull()
})
it('C: 32 guarded rows commit; row 33 and overlarge envelope are rejected', async () => {
  await setup()
  const rows = []
  for (let i = 0; i < 32; i++) { if (i) await catalog(`c${i}`); rows.push(await row('book', i ? `c${i}` : 'collection')) }
  const op = batch(rows)
  console.log('FEASIBILITY_COST', JSON.stringify({ rows: 32, receiptBytes: new TextEncoder().encode(JSON.stringify(op)).length, writePaths: Object.keys(clients[0].p.writes(op)).length }))
  console.log('DIAGNOSTIC size: positive commit');
  try { await clients[0].p.execute(op) } catch (error) { await simulate(uid, clients[0].p.writes(op)); throw error }
  expect(Object.keys(await read('bookData/book/1/collectionMemberships'))).toHaveLength(32)
  expect(() => batch([...rows, rows[0]], 2)).toThrow('batch bounds')
  // Use a CURRENT positive envelope for both attacks: otherwise stale before
  // states would reject them even without the intended schema constraints.
  const current = batch(await Promise.all(rows.map(r => row(r.bookId, r.collectionId, raw(), true))), 2, 'current-size-control')
  const forged = structuredClone(current); forged.guards[32] = { enabled: false }
  await attack(clients[0].p.writes(forged))
  const oversized = structuredClone(current); oversized.padding = 'x'.repeat(128 * 1024)
  await attack(clients[0].p.writes(oversized))
  await clients[0].p.execute(current)
  expect((await read('batchHead')).sequence).toBe(2)
})

it.each([1, 2, 4, 5, 6, 7, 8, 12, 16, 24, 31, 32])('diagnostic: progressive batch size %i', async size => {
  await setup()
  const rows = [await row()]
  for (let i = 1; i < size; i++) { await catalog(`c${i}`); rows.push(await row('book', `c${i}`)) }
  const op = batch(rows)
  console.log('DIAGNOSTIC_SIZE', JSON.stringify({ size, bytes: new TextEncoder().encode(JSON.stringify(op)).length, paths: Object.keys(clients[0].p.writes(op)).length }))
  await clients[0].p.execute(op)
  expect(Object.keys(await read('bookData/book/1/collectionMemberships'))).toHaveLength(size)
})

it.each(['first', 'c7', 'intent-37', 'u0', 'safe!~é'])('diagnostic: valid identifier %s passes direct server validation', async intent => {
  await setup()
  const op = batch([await row('book', 'collection', absent, false)], 1, intent)
  try { await multipath(clients[0].p.writes(op)) } catch (error) { await simulate(uid, clients[0].p.writes(op)); throw error }
  expect((await read('batchHead')).intent).toBe(intent)
  expect(await read('bookData/book/1/collectionMemberships')).toBeNull()
})

it.each([
  ['nul', 'bad\u0000id'], ['tab', 'bad\tid'], ['newline', 'bad\nid'], ['space', 'bad id'],
  ['del', 'bad\u007fid'], ['dot', 'bad.id'], ['hash', 'bad#id'], ['dollar', 'bad$id'],
  ['left-bracket', 'bad[id'], ['right-bracket', 'bad]id'], ['slash', 'bad/id'],
  ['prototype', 'prototype'], ['constructor', 'constructor'], ['proto', '__proto__'],
  ['empty', ''], ['too-long', 'x'.repeat(129)],
])('diagnostic: invalid identifier %s remains denied by server', async (_label, intent) => {
  await setup()
  const forged = structuredClone(batch([await row('book', 'collection', absent, false)]))
  forged.intent = intent // Bypass the JS identifier validator deliberately.
  await attack(clients[0].p.writes(forged))
})

it.each(['receipt', 'guard', 'before', 'after', 'disabled-guard'])('diagnostic: unknown field on %s is rejected without stale preconditions', async location => {
  await setup()
  const op = batch([await row('book', 'collection', absent, false)])
  const forged = structuredClone(op)
  if (location === 'receipt') forged.padding = 'forbidden'
  if (location === 'guard') forged.guards[0].padding = 'forbidden'
  if (location === 'before') forged.guards[0].before = { ...forged.guards[0].before, padding: 'forbidden' }
  if (location === 'after') forged.guards[0].after = { ...forged.guards[0].after, padding: 'forbidden' }
  if (location === 'disabled-guard') forged.guards[1].padding = 'forbidden'
  await attack(clients[0].p.writes(forged))
  // Establish the otherwise identical envelope is authorized.
  await clients[0].p.execute(op)
  expect((await read('batchHead')).sequence).toBe(1)
})

it.each(['absent', 'migrating', 'ready'])('D/composed: terminal purge from protocol %s and simulated Auth failure', async protocol => {
  await write('profile', { displayName: 'Fictional private name' })
  if (protocol === 'migrating') { await freezeMigration(); await write('importWitness', { migrationId: 'migration', value: 'private' }) }
  if (protocol === 'ready') { await setup(); await clients[0].p.execute(batch([await row()])) }
  await fence('deleting')
  await attack({ [path('profile')]: { displayName: 'stale' } })
  await attack({ [path('library/recreated')]: 'stale' })
  await attack({ [path('importWitness')]: { migrationId: 'migration', value: 'stale' } })
  await attack({ [path('')]: { profile: { recreated: true } } })
  await write('', null)
  expect(await read('')).toBeNull()
  await account({ state: 'deleted', legacyClosed: true })
  // Deliberately keep Emulator Auth alive: failure after RTDB purge.
  expect(clients[0].auth.currentUser.uid).toBe(uid)
  await attack({ [path('profile/recreated')]: true })
  expect(await read('')).toBeNull()
})
it.each(['null', 'active', 'reopen', 'foreign', 'mixed'])('D: terminal barrier attack %s denied', async kind => {
  await ready(); await fence('deleting')
  const target = `accountControl/${uid}`
  let values = { [target]: null }, index = 0
  if (kind === 'active') values = { [target]: { state: 'active', legacyClosed: true } }
  if (kind === 'reopen') values = { [target]: { state: 'deleting', legacyClosed: false } }
  if (kind === 'foreign') { values = { [path('')]: null }; index = 2 }
  if (kind === 'mixed') values = { [path('')]: null, [target]: { state: 'active', legacyClosed: false } }
  await attack(values, index)
  expect(await clients[1].p.read(uid, target)).toEqual({ state: 'deleting', legacyClosed: true })
})
it('D: deleted transition requires complete user absence, null purge does not allow non-null replacement', async () => {
  await write('profile', { private: true }); await fence('deleting')
  await denied(account({ state: 'deleted', legacyClosed: true }))
  await attack({ [path('')]: { only: 'replacement' } })
  await write('', null); await account({ state: 'deleted', legacyClosed: true })
  await denied(account({ state: 'active', legacyClosed: false }))
})
it('D: offline old client cannot recreate profile after terminal purge', async () => {
  await write('profile', { private: true })
  await queuedAcross(() => write('profile/recreated', true), async () => {
    await set(ref(clients[1].db, `accountControl/${uid}`), { state: 'deleting', legacyClosed: true })
    await set(ref(clients[1].db, path('')), null)
    await set(ref(clients[1].db, `accountControl/${uid}`), { state: 'deleted', legacyClosed: true })
    expect(await read('')).toBeNull()
  })
  expect(await read('')).toBeNull()
})
it('composed: batch racing clear either commits before clear or rejects; relation never effective afterward', async () => {
  await setup(); const op = batch([await row()]), meta = await clients[1].catalog.getCollection(cctx())
  const results = await Promise.allSettled([clients[0].p.execute(op), clients[1].catalog.clearCollection(cctx(), '-1234567890123456789', meta.token)])
  expect(results[1].status).toBe('fulfilled')
  expect((await read('collectionCatalog/collection')).membershipEpoch).toBe(2)
  const membership = await read('bookData/book/1/collectionMemberships/collection')
  expect(membership === null || membership.epoch === 1).toBe(true)
  await attack(clients[0].p.writes(op))
})
it('composed: foreign user cannot read or mutate owner data or barriers', async () => {
  await setup(); const op = batch([await row()])
  await attack(clients[0].p.writes(op), 2)
  await expect(clients[2].p.read(clients[2].auth.currentUser.uid, path(''))).rejects.toThrow('server evidence unavailable')
})
