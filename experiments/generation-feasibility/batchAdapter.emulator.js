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
import { createGenerationMembershipBatchService } from '../../src/services/generationMembershipBatchService.js'

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
async function attack(values, index = 0) {
  const before = await read('')
  await denied(multipath(values, index))
  expect(await read('')).toEqual(before)
}
beforeAll(async () => {
  await verify(); await assertEmulatorProject(); await assertEmulatorsReady()
  for (let i = 0; i < 3; i++) {
    const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `batch-adapter-${i}`)
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
    clients.push({ app, auth, db, p: prototype(db), adapter: createGenerationMembershipBatchService(db), life: createBookLifecycleService(db), library: createGenerationLibraryService(db), catalog: createGenerationCollectionCatalogService(db) })
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

const adapter = () => clients[0].adapter
it('adapter: refuses non-demo construction and another owner', async () => {
  expect(() => createGenerationMembershipBatchService({ app: { options: { projectId: 'real' } } })).toThrow('emulator-only')
  await setup()
  await expect(clients[2].adapter.execute(batch([await row()]))).rejects.toThrow('owner-mismatch')
})
it('adapter: commits, confirms a lost caller result and never writes on confirmed retry', async () => {
  await setup(); const op = batch([await row()])
  expect(await adapter().execute(op)).toEqual({ status: 'confirmed', canRetry: false })
  const before = await read('')
  const second = createGenerationMembershipBatchService(clients[1].db, { update: () => { throw new Error('must not write') } })
  expect((await second.execute(op)).status).toBe('confirmed')
  expect(await read('')).toEqual(before)
})
it('adapter: a transport throwing after actual commit reconciles as confirmed', async () => {
  await setup(); const op = batch([await row()]); let calls = 0
  const service = createGenerationMembershipBatchService(clients[0].db, { update: async (...args) => { calls++; await update(...args); throw new Error('discarded acknowledgement') } })
  expect((await service.execute(op)).status).toBe('confirmed'); expect(calls).toBe(1)
})
it('adapter: unavailable evidence and failed transport never authorize automatic retry', async () => {
  await setup(); const op = batch([await row()]); let writes = 0
  const unavailable = createGenerationMembershipBatchService(clients[0].db, { fetch: () => { throw new Error('offline') }, update: () => { writes++ } })
  expect(await unavailable.execute(op)).toEqual({ status: 'uncertain', canRetry: false }); expect(writes).toBe(0)
  const failed = createGenerationMembershipBatchService(clients[0].db, { update: () => { writes++; throw new Error('network') } })
  expect(await failed.execute(op)).toEqual({ status: 'uncertain', canRetry: false }); expect(writes).toBe(1)
  expect(await read('batchHead')).toBeNull()
})
it('adapter: committed write with unavailable confirmation remains uncertain until explicit reconciliation', async () => {
  await setup(); const op = batch([await row()]); let committed = false
  const service = createGenerationMembershipBatchService(clients[0].db, {
    fetch: (...args) => { if (committed) throw new Error('lost observation'); return fetch(...args) },
    update: async (...args) => { await update(...args); committed = true },
  })
  expect((await service.execute(op)).status).toBe('uncertain')
  expect((await adapter().reconcile(op)).status).toBe('confirmed')
})
it('adapter: concurrent different batches have one winner and no partial losing effects', async () => {
  await setup(); await catalog('other')
  const a = batch([await row()], 1, 'a'), b = batch([await row('book', 'other')], 1, 'b')
  const outcomes = await Promise.all([adapter().execute(a), clients[1].adapter.execute(b)])
  expect(outcomes.map(x => x.status).sort()).toEqual(['confirmed', 'conflict'])
  const receipt = await read('batchReceipts/1')
  const memberships = await read('bookData/book/1/collectionMemberships')
  expect(Object.keys(memberships)).toEqual([receipt.intent === 'a' ? 'collection' : 'other'])
})
it('adapter: stale no-op guards reject all changed rows and hostile SDK bypasses are denied', async () => {
  await setup(); await catalog('other')
  const stale = batch([await row('book', 'collection', absent, false), await row('book', 'other')], 2, 'stale')
  await adapter().execute(batch([await row()]))
  const before = await read('')
  expect((await adapter().execute(stale)).status).toBe('rejected')
  expect(await read('')).toEqual(before)
  await attack(adapter().writes(stale))
  await attack({ [path('bookData/book/1/collectionMemberships/other')]: { epoch: 1, present: true, revision: 1 } })
  await attack({ [path('batchHead')]: null })
})
it('adapter: enforces immutable canonical envelopes and 32 guarded rows', async () => {
  await setup(); const op = batch([await row()])
  await expect(adapter().execute(structuredClone(op))).rejects.toThrow()
  expect(() => batch(Array.from({ length: 33 }, (_, i) => ({ ...op.guards[0], collectionId: `c${i}` })))).toThrow()
})
it('adapter: purge removes all receipts, preserves sequence and never follows an old generation', async () => {
  await setup(); await activate('second'); const op = batch([await row()])
  await adapter().execute(op)
  const head = await read('batchHead')
  expect((await adapter().deleteGeneration(context())).status).toBe('confirmed')
  expect(await read('batchReceipts')).toBeNull(); expect(await read('batchHead')).toEqual(head)
  expect(await read('bookData/book')).toBeNull(); expect(await read('bookData/second/1/library')).not.toBeNull()
  expect((await clients[1].adapter.resumeDeletion(context())).status).toBe('confirmed')
  expect(await adapter().execute(op)).toEqual({ status: 'indeterminate', canRetry: false })
  await activate('book', 2); const before = await read('')
  expect((await adapter().deleteGeneration(context())).status).toBe('stale')
  expect((await adapter().resumeDeletion(context())).status).toBe('stale')
  const stale = batch([await row()], 2, 'old-generation')
  expect((await adapter().execute(stale)).status).toBe('rejected')
  await attack(adapter().writes(stale)); expect(await read('')).toEqual(before)
  expect((await adapter().execute(batch([await row('book', 'collection', absent, true, 2)], 2, 'new-generation'))).status).toBe('confirmed')
})
it('adapter: purge reconciles a committed operation despite thrown acknowledgement', async () => {
  await setup(); await adapter().execute(batch([await row()]))
  await clients[0].life.lockDeletion(context())
  const service = createGenerationMembershipBatchService(clients[0].db, { update: async (...args) => { await update(...args); throw new Error('lost purge confirmation') } })
  expect((await service.resumeDeletion(context())).status).toBe('confirmed')
  expect(await read('batchReceipts')).toBeNull(); expect((await read('batchHead')).sequence).toBe(1)
})
it('adapter: resume refuses an active book; concurrent deletions converge', async () => {
  await setup()
  expect((await adapter().resumeDeletion(context())).status).toBe('conflict')
  const outcomes = await Promise.all([adapter().deleteGeneration(context()), clients[1].adapter.deleteGeneration(context())])
  expect(outcomes.every(x => x.status === 'confirmed')).toBe(true)
})
it('adapter: 65 commits evict proof without replay or sequence reset', async () => {
  await setup(); const first = batch([await row()], 1, 'first')
  await adapter().execute(first)
  for (let n = 2; n <= 65; n++) expect((await adapter().execute(batch([await row('book', 'collection', raw(), true)], n, `noop-${n}`))).status).toBe('confirmed')
  expect(Object.keys(await read('batchReceipts'))).toHaveLength(64)
  const before = await read('')
  expect(await adapter().execute(first)).toEqual({ status: 'indeterminate', canRetry: false })
  expect(await read('')).toEqual(before)
})
it('adapter: 32 guarded rows commit with activity only for effective changes', async () => {
  await ready(); await activate()
  const rows = []
  for (let i = 0; i < 32; i++) { await catalog(`c${i}`); rows.push(await row('book', `c${i}`)) }
  expect((await adapter().execute(batch(rows))).status).toBe('confirmed')
  expect(Object.keys(await read('bookData/book/1/collectionMemberships'))).toHaveLength(32)
  const activity = await read('collectionActivity')
  const noops = rows.map(r => ({ ...r, before: raw() }))
  expect((await adapter().execute(batch(noops, 2, 'noops'))).status).toBe('confirmed')
  expect(await read('collectionActivity')).toEqual(activity)
})
it('adapter: closed envelope rejects oversize padding locally and through direct SDK', async () => {
  await setup(); const op = batch([await row()])
  const forged = { ...op, padding: 'x'.repeat(128 * 1024) }
  await expect(adapter().execute(Object.freeze(forged))).rejects.toThrow()
  const values = adapter().writes(op)
  values[path('batchReceipts/1')] = forged
  await attack(values)
})
it('adapter: a queued SDK batch cannot touch a readded generation', async () => {
  await setup(); const op = batch([await row()]), values = adapter().writes(op)
  goOffline(clients[0].db)
  let settled = false
  const pending = multipath(values).then(() => 'accepted', () => 'denied').finally(() => { settled = true })
  try {
    expect((await clients[1].adapter.deleteGeneration(context())).status).toBe('confirmed')
    await clients[1].life.beginNextGeneration(context())
    const next = context('book', 2)
    await clients[1].library.initializeLibrary(next, { id: 'book', title: 'New', status: 'to-read', addedAt: 100 })
    await clients[1].life.activateGeneration(next)
    expect(settled).toBe(false)
  } finally { goOnline(clients[0].db) }
  expect(await pending).toBe('denied')
  expect(await read('bookData/book/2/collectionMemberships')).toBeNull()
  expect(await read('batchHead')).toBeNull()
})
