import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { initializeApp, deleteApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationLibraryService } from '../../src/services/generationLibraryService.js'
import { createGenerationBookNotesService } from '../../src/services/generationBookNotesService.js'
import { createGenerationBookRatingsService } from '../../src/services/generationBookRatingsService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { createGenerationMembershipBatchService } from '../../src/services/generationMembershipBatchService.js'
import { createGenerationRecoveryService } from '../../src/services/generationRecoveryService.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext } from '../../src/utils/generationCollectionContracts.js'
import { createBookRecoveryIntent } from '../../src/utils/generationRecoveryContracts.js'
import { captureBatch, prototype } from './prototype.mjs'
import { verify } from './composeRules.mjs'

const clients = [], live = new Set()
let uid, email, serial = 0
const password = 'fictional-password'
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const ctx = (bookId = 'book', generation = 1) => createBookMutationContext({ uid, bookId, generation })
const intent = (context = ctx()) => createBookRecoveryIntent({ context, intentId: 'resume', kind: 'resume-deletion', initializationId: null })
const read = suffix => clients[1].p.read(uid, path(suffix))
const write = (suffix, value) => set(ref(clients[0].db, path(suffix)), value)
const fence = state => set(ref(clients[0].db, `accountControl/${uid}`), { state, legacyClosed: state !== 'active' })
async function newClient() {
  const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `recovery-${++serial}`)
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const client = { app, auth, db, p: prototype(db), life: createBookLifecycleService(db), library: createGenerationLibraryService(db), batch: createGenerationMembershipBatchService(db), recovery: createGenerationRecoveryService(db) }
  live.add(client)
  return client
}
async function close(client) { goOffline(client.db); await deleteApp(client.app); live.delete(client) }
async function ready() {
  await update(ref(clients[0].db), { [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'fixture', version: 1 }, [`accountControl/${uid}/legacyClosed`]: true })
  await write('bookProtocol/state', 'ready')
}
async function creating(bookId = 'book', generation = 1, withLibrary = true, client = clients[0]) {
  const context = ctx(bookId, generation)
  if (generation === 1) await client.life.initializeGeneration(context)
  else await client.life.beginNextGeneration(ctx(bookId, generation - 1))
  if (withLibrary) await client.library.initializeLibrary(context, { id: bookId, title: 'Private book', status: 'finished', addedAt: 100, finishedAt: 200, ...(generation === 1 ? { note: 'Private source', review: 'Private review', rating: 4 } : {}) })
  return context
}
async function active(bookId = 'book', generation = 1, client = clients[0]) {
  const context = await creating(bookId, generation, true, client)
  await client.life.activateGeneration(context)
  return context
}
async function locked() { await ready(); await active(); await clients[0].life.lockDeletion(ctx()) }
async function personalFixture() {
  await ready(); await active(); await active('other')
  const notes = createGenerationBookNotesService(clients[0].db)
  await notes.createNote(ctx(), 'note', { title: 'Private title', contentHtml: 'Private content', date: '2026-11-06' })
  await createGenerationBookRatingsService(clients[0].db).createRating(ctx(), '-1234567890123456789', { value: 4, date: '2026-11-06', impression: 'Private impression' })
  const catalog = createGenerationCollectionCatalogService(clients[0].db)
  await catalog.createCollection(createCollectionContext({ uid, collectionId: 'collection', epoch: 1 }), { name: 'Personal collection' })
  const meta = await read('collectionCatalog/collection')
  const op = captureBatch(uid, 'membership', 1, [{ bookId: 'book', generation: 1, collectionId: 'collection', epoch: 1, catalogCreatedAt: meta.createdAt, before: { exists: false }, desired: true }])
  await clients[0].batch.execute(op)
  return op
}
beforeAll(async () => { await verify(); await assertEmulatorProject(); await assertEmulatorsReady() })
beforeEach(async () => {
  clients.push(await newClient(), await newClient())
  email = `recovery-${Date.now()}-${serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, password)
  await fence('active')
})
afterEach(async () => { for (const client of [...live]) await close(client); clients.length = 0 })

it('recovery: rejects non-Emulator databases and foreign owners', async () => {
  expect(() => createGenerationRecoveryService({ app: { options: { projectId: 'real' } } })).toThrow('emulator-only')
  await expect(clients[0].recovery.discover('foreign')).rejects.toThrow('owner-mismatch')
  const stranger = await newClient()
  await createUserWithEmailAndPassword(stranger.auth, `stranger-${serial}@example.test`, password)
  await expect(stranger.recovery.resumeDeletion(intent())).rejects.toThrow('owner-mismatch')
})
it('recovery: discovery is read-only, deterministic and captures creating/deleting only', async () => {
  await ready(); await active('active'); await active('deleting')
  await clients[0].life.lockDeletion(ctx('deleting'))
  await creating('creating-empty', 1, false); await creating('creating-library')
  await active('deleted'); await clients[0].batch.deleteGeneration(ctx('deleted'))
  const before = await read('')
  const result = await clients[0].recovery.discover(uid)
  expect(result.status).toBe('observed')
  expect(result.actions.map(a => [a.kind, a.context.bookId])).toEqual([
    ['review-creation', 'creating-empty'], ['review-creation', 'creating-library'], ['resume-deletion', 'deleting'],
  ])
  expect(result.actions[0].choices).toEqual(['resume-creation', 'abandon-creation'])
  expect(Object.isFrozen(result.actions[2].context)).toBe(true)
  expect(await read('')).toEqual(before)
})
it('recovery: creates no protocol and no lifecycle when discovery is not ready', async () => {
  const before = await read('')
  expect(await clients[0].recovery.discover(uid)).toEqual({ status: 'protocol-not-ready', actions: [] })
  expect(await read('')).toEqual(before)
})
it('recovery: resumes from a completely new SDK client after the original app is closed', async () => {
  const op = await personalFixture()
  const other = await read('bookData/other'), catalog = await read('collectionCatalog'), head = await read('batchHead')
  await clients[0].life.lockDeletion(ctx())
  const name = clients[0].app.name
  await close(clients[0]); expect(getApps().some(app => app.name === name)).toBe(false)
  const fresh = await newClient(); await signInWithEmailAndPassword(fresh.auth, email, password)
  const action = (await fresh.recovery.discover(uid)).actions[0]
  expect(action).toEqual({ kind: 'resume-deletion', context: ctx() })
  const captured = intent(action.context)
  expect((await fresh.recovery.resumeDeletion(captured)).status).toBe('confirmed')
  expect(await read('bookData/book')).toBeNull(); expect(await read('batchReceipts')).toBeNull()
  expect(await read('batchHead')).toEqual(head)
  expect(await read('bookData/other')).toEqual(other); expect(await read('collectionCatalog')).toEqual(catalog)
  expect((await fresh.batch.execute(op)).status).toBe('indeterminate')
  expect((await fresh.recovery.discover(uid)).actions).toEqual([])
  await close(fresh)
  const next = await newClient(); await signInWithEmailAndPassword(next.auth, email, password)
  expect((await next.recovery.resumeDeletion(captured)).status).toBe('confirmed')
  expect(await read('batchHead')).toEqual(head)
})
it('recovery: repeated interrupted purges remain locked and require explicit retry', async () => {
  await locked(); let writes = 0
  const failing = createGenerationRecoveryService(clients[0].db, { update: () => { writes++; throw new Error('network interruption') } })
  for (let i = 0; i < 3; i++) {
    expect(await failing.resumeDeletion(intent())).toEqual({ status: 'uncertain', canRetry: false, reason: 'purge-unconfirmed' })
    expect((await read('bookLifecycle/book')).state).toBe('deleting')
    expect(await read('bookData/book/1/library')).not.toBeNull()
  }
  expect(writes).toBe(3)
  expect((await clients[1].recovery.resumeDeletion(intent())).status).toBe('confirmed')
})
it('recovery: lost purge acknowledgement reconciles only from actual server absence', async () => {
  await locked(); let writes = 0
  const service = createGenerationRecoveryService(clients[0].db, { update: async (...args) => { writes++; await update(...args); throw new Error('lost ack') } })
  expect((await service.resumeDeletion(intent())).status).toBe('confirmed'); expect(writes).toBe(1)
  expect(await read('bookData/book')).toBeNull()
})
it('recovery: lost observations after purge stay uncertain until explicit reconciliation', async () => {
  await locked(); let committed = false
  const service = createGenerationRecoveryService(clients[0].db, {
    update: async (...args) => { await update(...args); committed = true },
    fetch: (...args) => { if (committed) throw new Error('network down'); return fetch(...args) },
  })
  expect((await service.resumeDeletion(intent())).status).toBe('uncertain')
  expect(await read('bookData/book')).toBeNull()
  expect((await clients[1].recovery.reconcile(intent())).status).toBe('confirmed')
})
it('recovery: concurrent new-client resumes converge without sequence reset', async () => {
  await personalFixture(); await clients[0].life.lockDeletion(ctx())
  const head = await read('batchHead')
  const results = await Promise.all([clients[0].recovery.resumeDeletion(intent()), clients[1].recovery.resumeDeletion(intent())])
  expect(results.map(r => r.status)).toEqual(['confirmed', 'confirmed'])
  expect(await read('batchHead')).toEqual(head); expect(await read('batchReceipts')).toBeNull()
})
it('recovery: never activates or abandons creating books even with explicit creation intentions', async () => {
  await ready(); await creating()
  const before = await read('')
  expect((await clients[0].recovery.resumeDeletion(intent())).status).toBe('decision-required')
  for (const kind of ['resume-creation', 'abandon-creation']) {
    const creation = createBookRecoveryIntent({ context: ctx(), intentId: 'creation', kind, initializationId: kind === 'resume-creation' ? 'a'.repeat(64) : null })
    await expect(clients[0].recovery.resumeDeletion(creation)).rejects.toThrow('Only explicit resume-deletion')
  }
  expect(await read('')).toEqual(before)
})
it('recovery: stale captured generations cannot purge or inherit data after readd', async () => {
  await personalFixture(); await clients[0].life.lockDeletion(ctx())
  const captured = intent((await clients[0].recovery.discover(uid)).actions[0].context)
  await clients[1].recovery.resumeDeletion(captured)
  await active('book', 2)
  const before = await read('')
  expect((await clients[0].recovery.reconcile(captured)).status).toBe('stale')
  expect((await clients[0].recovery.resumeDeletion(captured)).status).toBe('stale')
  expect(await read('')).toEqual(before)
  expect(await read('bookData/book/1')).toBeNull()
  for (const branch of ['bookNotes', 'bookRatings', 'collectionMemberships', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatingsLegacy']) expect(await read(`bookData/book/2/${branch}`)).toBeNull()
  await expect(update(ref(clients[0].db), { [path('bookData/book/1/library/note')]: 'resurrection' })).rejects.toThrow(/permission[ _-]?denied/i)
  expect(await read('')).toEqual(before)
})
it('recovery: a generation advancing after preflight is never retargeted', async () => {
  await locked(); let reads = 0
  const service = createGenerationRecoveryService(clients[0].db, { fetch: async (...args) => {
    reads++
    if (reads === 4) {
      await clients[1].batch.resumeDeletion(ctx())
      await active('book', 2, clients[1])
    }
    return fetch(...args)
  } })
  expect((await service.resumeDeletion(intent())).status).toBe('stale')
  expect((await read('bookLifecycle/book')).generation).toBe(2)
  expect(await read('bookData/book/2/library')).not.toBeNull()
})
it('recovery: active, absent and mutable intentions never cause deletion', async () => {
  await ready(); await active()
  const before = await read('')
  expect((await clients[0].recovery.resumeDeletion(intent())).status).toBe('stale')
  expect((await clients[0].recovery.resumeDeletion(intent(ctx('absent')))).status).toBe('stale')
  await expect(clients[0].recovery.resumeDeletion(structuredClone(intent()))).rejects.toThrow('frozen')
  expect(await read('')).toEqual(before)
})
it.each([401, 403])('recovery: HTTP %s is a refusal, never an empty successful discovery', async status => {
  await locked(); let writes = 0
  const service = createGenerationRecoveryService(clients[0].db, { fetch: async () => ({ status, ok: false }), update: () => { writes++ } })
  expect(await service.discover(uid)).toEqual({ status: 'rejected', reason: 'permission-denied', actions: [] })
  expect((await service.resumeDeletion(intent())).status).toBe('rejected'); expect(writes).toBe(0)
})
it.each(['network', 'server', 'invalid-json'])('recovery: %s observations never authorize writes', async fault => {
  await locked(); let writes = 0
  const service = createGenerationRecoveryService(clients[0].db, { fetch: async () => {
    if (fault === 'network') throw new Error('offline')
    if (fault === 'server') return { status: 503, ok: false }
    return { status: 200, ok: true, json: () => { throw new SyntaxError('invalid') } }
  }, update: () => { writes++ } })
  const status = fault === 'invalid-json' ? 'contradictory' : 'uncertain'
  expect((await service.discover(uid)).status).toBe(status)
  expect((await service.resumeDeletion(intent())).status).toBe(status); expect(writes).toBe(0)
})
it('recovery: server-denied purge remains rejected with data preserved', async () => {
  await locked()
  const service = createGenerationRecoveryService(clients[0].db, { update: (...args) => update(args[0], { ...args[1], [path('bookLifecycle/book')]: { generation: 1, state: 'active' } }) })
  const before = await read('')
  expect((await service.resumeDeletion(intent())).status).toBe('rejected')
  expect(await read('')).toEqual(before)
})
it('recovery: terminal account stops discovery and resume without recreating data', async () => {
  await locked(); await fence('deleting')
  expect(await clients[0].recovery.discover(uid)).toEqual({ status: 'account-terminal', actions: [] })
  const before = await read('')
  expect((await clients[0].recovery.resumeDeletion(intent())).status).toBe('account-terminal')
  expect(await read('')).toEqual(before)
})
it('recovery: account deletion racing a purge cannot bypass the terminal fence', async () => {
  await locked()
  const service = createGenerationRecoveryService(clients[0].db, { update: async (...args) => { await fence('deleting'); return update(...args) } })
  expect((await service.resumeDeletion(intent())).status).toBe('account-terminal')
  expect((await read('bookLifecycle/book')).state).toBe('deleting')
  expect(await read('bookData/book/1/library')).not.toBeNull()
})
it('recovery: malformed lifecycle and deleted-with-residue observations cannot confirm', async () => {
  await locked()
  for (const lifecycle of [{ generation: 1, state: 'unknown' }, { generation: 1, state: 'deleted' }]) {
    const service = createGenerationRecoveryService(clients[0].db, { fetch: async (...args) => {
      const response = await fetch(...args)
      if (!new URL(args[0]).pathname.startsWith('/users/')) return response
      const state = await response.json(); state.bookLifecycle.book = lifecycle
      return { ok: true, status: 200, json: async () => state }
    } })
    expect((await service.reconcile(intent())).status).toBe('contradictory')
  }
  expect((await read('bookLifecycle/book')).state).toBe('deleting')
})
it('recovery: numeric book IDs keep their indices in RTDB array observations', async () => {
  await ready(); await creating('0', 1, false); await active('1'); await clients[0].life.lockDeletion(ctx('1'))
  const discovered = await clients[0].recovery.discover(uid)
  expect(discovered.actions.map(a => a.context.bookId)).toEqual(['0', '1'])
  expect((await clients[0].recovery.resumeDeletion(intent(discovered.actions[1].context))).status).toBe('confirmed')
  expect((await clients[0].recovery.discover(uid)).actions.map(a => a.context.bookId)).toEqual(['0'])
})
