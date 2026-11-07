import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, getIdTokenResult } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline, goOnline, setWithPriority } from 'firebase/database'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { createHistoricalImportService } from './service.mjs'
import { verifyHistoricalImport } from './verify.mjs'
import { receiptKey, receiptFor, sourceValue, planDigest } from './protocol.mjs'
import { transformHistoricalSnapshot } from '../../src/utils/historicalGenerationTransformer.js'
import { verify } from './composeRules.mjs'

const clients = []
let uid, serial = 0, originalRules
const ratingId = '-1234567890123456789', deletedId = '-abcdefghijklmnopqrs'
function fixture() {
  const note = { title: ' Note ', contentHtml: '<p>Été 🪴</p>', date: '2024-02-29', isPinned: true, createdAt: 10, updatedAt: 15 }
  const collection = { name: ' Collection ', description: '', icon: 'library', pinned: false, createdAt: 4, updatedAt: 8 }
  return {
    library: { book: { id: 'book', title: 'Fictif', status: 'reading', addedAt: 2, finishedAt: -1000, authors: [' Z ', 'A'], note: 'Original', review: 'Avis', rating: 4 }, second: { id: 'second', title: 'Autre', status: 'finished', addedAt: 3 } },
    bookNotes: { book: { n: note, another: { ...note, title: '' }, 'legacy-note-v1': { ...note, contentHtml: 'Copie éditée' } } },
    bookNotesLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: 'Original', processedAt: 9 } },
    bookReviewsLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: 'Avis', processedAt: 9 } }, // deleted copy stays absent
    bookRatings: { book: { [ratingId]: { value: 3, date: '2024-02-29', revision: 7, createdAt: 5, updatedAt: 12, impression: ' Exact ' }, [deletedId]: { deleted: true, revision: 8, createdAt: 5, updatedAt: 14 }, 'legacy-rating-v1': { value: 2, date: '', revision: 5, createdAt: 8, updatedAt: 13 } } },
    bookRatingsLegacy: { book: { version: 1, sourceValue: 4, processedAt: 8 } },
    collections: { empty: collection, a: { ...collection, books: { book: true, second: true } }, b: { ...collection, books: { book: true } } },
    profile: { displayName: 'Existing fictitious reader', email: 'fixture@example.test', custom: 'retained' },
    preferences: { language: 'fr', annualGoal: 500, custom: { preserve: true } },
  }
}
const identity = (id = uid, migrationId = 'stable-migration') => ({ uid: id, migrationId, transformVersion: 1 })
const service = (index = 0, migrationId) => createHistoricalImportService(clients[index].db, identity(uid, migrationId))
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const write = (suffix, value, index = 0) => set(ref(clients[index].db, path(suffix)), value)
const denied = promise => expect(promise).rejects.toThrow(/permission[ _-]?denied/i)
async function read(suffix = '', index = 0, id = uid) {
  const token = await clients[index].auth.currentUser.getIdToken()
  const url = new URL(`http://127.0.0.1:9000/users/${id}${suffix ? `/${suffix}` : ''}.json`)
  url.searchParams.set('ns', 'demo-dear-pages'); url.searchParams.set('auth', token)
  const response = await fetch(url, { cache: 'no-store', redirect: 'error' })
  if (!response.ok) throw new Error(`read denied ${response.status}`)
  return response.json()
}
async function preparation() { return transformHistoricalSnapshot(sourceValue(await read()), identity()) }
async function loadRules(body) {
  const response = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages', { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body, redirect: 'error' })
  if (!response.ok) throw new Error(await response.text())
}
beforeAll(async () => {
  await verify(); await assertEmulatorProject(); await assertEmulatorsReady()
  const previous = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages', { headers: { Authorization: 'Bearer owner' }, redirect: 'error' })
  expect(previous.ok).toBe(true); originalRules = await previous.text()
  await loadRules(await readFile(new URL('database.rules.json', import.meta.url), 'utf8'))
  for (let i = 0; i < 3; i++) {
    const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `historical-import-${i}`)
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
    clients.push({ app, auth, db })
  }
  await createUserWithEmailAndPassword(clients[2].auth, `historical-other-${Date.now()}@example.test`, 'fictional-password')
})
beforeEach(async () => {
  const email = `historical-import-${Date.now()}-${++serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, 'fictional-password')).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, 'fictional-password')
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
  await update(ref(clients[0].db, path('')), fixture()) // Owner SDK, no Admin fixture data.
})
afterAll(async () => {
  try { for (const client of clients) { goOffline(client.db); await deleteApp(client.app) } }
  finally { if (originalRules) await loadRules(originalRules) }
})

it('imports all seven branches faithfully, seals, verifies independently and preserves Auth/profile/preferences/raw history', async () => {
  const before = await read(), authBefore = clients[0].auth.currentUser.toJSON(), svc = service()
  expect(svc.approve).toBeUndefined(); expect(svc.ready).toBeUndefined(); expect(svc.purge).toBeUndefined()
  expect((await svc.begin()).checkpoint.stage).toBe('frozen')
  const imported = await svc.resume()
  expect(imported.status).toBe('imported-unfinalized'); expect(imported.checkpoint.stage).toBe('imported')
  const verified = await svc.sealAndVerify()
  expect(verified).toMatchObject({ status: 'verified-unfinalized', failures: [], canApprove: false, canReady: false })
  const after = await read()
  expect(sourceValue(after)).toEqual(before)
  expect(after.bookData.book[1].bookNotes).toMatchObject(before.bookNotes.book)
  expect(after.bookData.book[1].bookRatings).toEqual(before.bookRatings.book)
  expect(after.bookData.book[1].bookReviewsLegacy.sourceHtml).toBe('Avis')
  expect(after.bookData.book[1].bookNotes['legacy-review-v1']).toBeUndefined()
  expect(after.collectionCatalog.empty.name).toBe(' Collection ')
  expect(after.bookData.book[1].collectionMemberships).toEqual({ a: { epoch: 1, present: true, revision: 1 }, b: { epoch: 1, present: true, revision: 1 } })
  expect(after.bookLifecycle).toEqual({ book: { generation: 1, state: 'creating' }, second: { generation: 1, state: 'creating' } })
  expect(after.bookProtocol).toEqual({ version: 2, state: 'migrating' })
  const token = await getIdTokenResult(clients[0].auth.currentUser)
  expect(token.claims.user_id).toBe(uid)
  expect(clients[0].auth.currentUser.uid).toBe(authBefore.uid)
  expect(clients[0].auth.currentUser.email).toBe(authBefore.email)
  await signInWithEmailAndPassword(clients[1].auth, authBefore.email, 'fictional-password')
})
it('resumes an interrupted import in a fresh service using durable receipts and the same identity', async () => {
  await service().begin()
  const partial = await service().resume({ maxUnits: 2 })
  expect(partial.status).toBe('interrupted'); expect(partial.checkpoint.completedUnits).toHaveLength(2)
  const before = await read(), resumed = service(1)
  expect((await resumed.begin()).status).toBe('resumable')
  expect((await resumed.resume()).status).toBe('imported-unfinalized')
  const after = await read()
  for (const [id, receipt] of Object.entries(before.importReceipts)) expect(after.importReceipts[id]).toEqual(receipt)
  expect((await resumed.sealAndVerify()).status).toBe('verified-unfinalized')
})
it('replays a complete and a sealed import without changing any server value', async () => {
  const svc = service(); await svc.begin(); await svc.resume()
  const before = await read()
  expect((await service(1).resume()).written).toBe(0)
  expect(await read()).toEqual(before)
  await svc.sealAndVerify()
  const sealed = await read()
  expect((await service(1).resume()).status).toBe('verified-unfinalized')
  expect(await read()).toEqual(sealed)
})
it('reconciles a committed unit with no caller acknowledgement/checkpoint advance', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prep = await preparation(), entry = prep.destinations.find(item => item.intent.unit.kind === 'library')
  await update(ref(clients[0].db), { [entry.destinationPath]: entry.intent.payload, [path(`importReceipts/${receiptKey(entry.intent.unit.unitId)}`)]: receiptFor(entry.intent) })
  const resumed = await service(1).resume({ maxUnits: 0 })
  expect(resumed.checkpoint.completedUnits).toContainEqual(entry.intent.unit)
  expect((await service(1).resume()).status).toBe('imported-unfinalized')
})
it('supports concurrent identical importers without overwrite, changed identity or duplicates', async () => {
  await service().begin()
  const outcomes = await Promise.all([service().resume(), service(1).resume()])
  expect(outcomes.every(value => value.status === 'imported-unfinalized')).toBe(true)
  expect((await service().sealAndVerify()).status).toBe('verified-unfinalized')
})
it('reconciles two simultaneous freezes with the same immutable identity', async () => {
  const results = await Promise.all([service().begin(), service(1).begin()])
  expect(results.every(value => ['frozen', 'resumable'].includes(value.status))).toBe(true)
  expect(await read('bookMigration')).toEqual({ id: 'stable-migration', version: 1 })
  expect((await service().resume()).status).toBe('imported-unfinalized')
})
it('rejects an old SDK write queued before the atomic freeze when it reconnects', async () => {
  goOffline(clients[0].db)
  const outcome = write('library/book/title', 'Stale queued title').then(() => 'accepted', () => 'denied')
  try { await service(1).begin() }
  finally { goOnline(clients[0].db) }
  expect(await outcome).toBe('denied')
  expect(await read('library/book/title')).toBe('Fictif')
})
it('refuses a mixed import plus terminal-account transition atomically', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prep = await preparation(), entry = prep.destinations.find(item => item.intent.unit.kind === 'library')
  await denied(update(ref(clients[0].db), {
    [entry.destinationPath]: entry.intent.payload,
    [path(`importReceipts/${receiptKey(entry.intent.unit.unitId)}`)]: receiptFor(entry.intent),
    [`accountControl/${uid}`]: { state: 'deleting', legacyClosed: true },
  }))
  expect(await read('bookData')).toBeNull()
  expect((await service().resume()).status).toBe('imported-unfinalized')
})
it('rejects another migration identity and forged source/plan binding', async () => {
  await service().begin()
  await expect(service(1, 'another').begin()).rejects.toThrow(/conflict/)
  await denied(write('bookMigration/id', 'another'))
  await denied(write('historicalImport/sourceVersion', 'a'.repeat(64)))
  await denied(write('historicalImport/planDigest', 'a'.repeat(64)))
})
it('freezes each raw historical branch and refuses deletion even during terminal account state', async () => {
  await service().begin()
  const before = sourceValue(await read())
  for (const branch of ['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections']) {
    await denied(write(branch, null)); await denied(write(`${branch}/changed`, { value: true }))
  }
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'deleting', legacyClosed: true })
  await denied(write('', null)); await denied(write('profile', null))
  await expect(service().resume()).rejects.toThrow('account-blocked')
  expect(sourceValue(await read())).toEqual(before)
})
it('rejects incomplete import, forged progress, approval, ready and lifecycle activation', async () => {
  await service().begin(); await service().resume({ maxUnits: 1 })
  await expect(service().sealAndVerify()).rejects.toThrow('incomplete-import')
  await denied(write('historicalImport/stage', 'verified'))
  await denied(write('historicalImport/approved', true))
  await denied(write('bookProtocol/state', 'ready'))
  await denied(write('bookLifecycle/book/state', 'active'))
  // A declarative progress stage is not independent evidence of completeness.
  await write('historicalImport/stage', 'imported')
  expect((await service().sealAndVerify()).status).toBe('blocked')
  expect((await read('historicalImport')).phase).toBe('open')
  await denied(write('bookProtocol/state', 'ready'))
})
it('refuses owner ready/approval even after a complete independently verified import', async () => {
  await service().begin(); await service().resume(); await service().sealAndVerify()
  await denied(write('bookProtocol/state', 'ready'))
  await denied(write('historicalImport/stage', 'verified'))
  await denied(write('historicalImport/phase', 'open'))
  await denied(write('library', null))
})
it('rules reject falsified historical values and preserve atomicity of mixed writes', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prep = await preparation(), entry = prep.destinations.find(item => item.intent.unit.kind === 'library')
  const before = await read()
  await denied(update(ref(clients[0].db), { [entry.destinationPath]: { ...entry.intent.payload, title: 'Forged' }, [path(`importReceipts/${receiptKey(entry.intent.unit.unitId)}`)]: receiptFor(entry.intent) }))
  expect(await read()).toEqual(before)
  await denied(set(ref(clients[0].db, entry.destinationPath), { ...entry.intent.payload, extra: 'discarded?' }))
})
it('detects incorrect technical hashes independently instead of trusting a valid-looking imported envelope', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prep = await preparation(), catalog = prep.destinations.find(item => item.intent.unit.kind === 'collection')
  const forged = { ...catalog.intent.payload, creation: 'a'.repeat(64) }
  await update(ref(clients[0].db), { [catalog.destinationPath]: forged, [path(`importReceipts/${receiptKey(catalog.intent.unit.unitId)}`)]: receiptFor(catalog.intent) })
  await expect(service().resume()).rejects.toThrow('destination-or-receipt-conflict')
  await write('historicalImport/stage', 'imported')
  const report = await service().sealAndVerify()
  expect(report.status).toBe('blocked'); expect(report.canApprove).toBe(false)
})
it('independent verifier rejects missing, excess and altered payloads and technical data without using the transformer output', async () => {
  await service().begin(); await service().resume(); await service().sealAndVerify()
  const complete = await read()
  expect(verifyHistoricalImport(complete, identity()).status).toBe('verified-unfinalized')
  for (const change of [
    value => { delete value.bookData.book[1].bookNotes.n },
    value => { value.bookData.book[1].bookRatings[ratingId].revision++ },
    value => { value.bookData.book[1].bookNotes.n.creation = 'b'.repeat(64) },
    value => { value.bookData.book[1].extra = { retained: false } },
    value => { value.collectionCatalog.empty.name = 'Trimmed' },
    value => { value.importReceipts = {} },
    value => { value.library.book.title = 'Changed source' },
    value => { value.bookLifecycle.book.state = 'active' },
  ]) {
    const observed = structuredClone(complete); change(observed)
    expect(verifyHistoricalImport(observed, identity())).toMatchObject({ status: 'blocked', canApprove: false, canReady: false })
  }
})
it('rejects new writes after sealing, including hidden ancestors and new receipt keys', async () => {
  await service().begin(); await service().resume(); await service().sealAndVerify()
  const before = await read()
  await denied(write('bookData/book/1/bookNotes/extra', fixture().bookNotes.book.n))
  await denied(write('bookData/book/1', before.bookData.book[1]))
  await denied(write('collectionCatalog/extra', before.collectionCatalog.empty))
  await denied(write(`importReceipts/${'f'.repeat(64)}`, { unitId: 'forged', payloadDigest: 'f'.repeat(64) }))
  expect(await read()).toEqual(before)
})
it('proves the existing feasibility profile denies faithful import in migrating without weakening it', async () => {
  await loadRules(await readFile(new URL('../generation-feasibility/database.rules.json', import.meta.url), 'utf8'))
  try {
    const before = await read()
    await expect(service().begin()).rejects.toThrow(/permission[ _-]?denied/i)
    expect(await read()).toEqual(before)
    await update(ref(clients[0].db), {
      [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'baseline-proof', version: 1 },
      [`accountControl/${uid}/legacyClosed`]: true,
    })
    await denied(write('bookLifecycle/book', { generation: 1, state: 'creating' }))
    await denied(write('bookData/book/1/library', before.library.book))
    await denied(write(`bookData/book/1/bookRatings/${deletedId}`, before.bookRatings.book[deletedId]))
    expect(sourceValue(await read())).toEqual(before)
  } finally { await loadRules(await readFile(new URL('database.rules.json', import.meta.url), 'utf8')) }
})
it('blocks a source changed before freeze rather than importing a stale snapshot', async () => {
  const prepared = await transformHistoricalSnapshot(await read(), identity())
  await write('library/book/title', 'Changed before freeze')
  await update(ref(clients[0].db), {
    [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'stable-migration', version: 1 },
    [`accountControl/${uid}/legacyClosed`]: true,
    [path('historicalImport')]: { sourceVersion: prepared.sourceVersion, planDigest: planDigest(prepared), phase: 'open', stage: 'frozen' },
  })
  await expect(service().resume()).rejects.toThrow('identity-or-source-conflict')
  expect(await read('bookData')).toBeNull()
  expect(await read('library/book/title')).toBe('Changed before freeze')
})
it('refuses incomplete source list coverage even when each imported list value is individually valid', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prepared = await preparation(), entry = prepared.destinations.find(item => item.intent.unit.kind === 'library' && item.intent.context.bookId === 'book')
  await update(ref(clients[0].db), { [entry.destinationPath]: { ...entry.intent.payload, authors: [' Z '] }, [path(`importReceipts/${receiptKey(entry.intent.unit.unitId)}`)]: receiptFor(entry.intent) })
  await expect(service().resume()).rejects.toThrow('destination-or-receipt-conflict')
  await write('historicalImport/stage', 'imported')
  expect((await service().sealAndVerify()).status).toBe('blocked')
})
it('rejects target priorities and unknown fields through the real SDK', async () => {
  await service().begin(); await service().resume({ maxUnits: 0 })
  const prepared = await preparation(), entry = prepared.destinations.find(item => item.intent.unit.kind === 'library')
  await denied(setWithPriority(ref(clients[0].db, entry.destinationPath), entry.intent.payload, 1))
  const catalog = prepared.destinations.find(item => item.intent.unit.kind === 'collection')
  await denied(set(ref(clients[0].db, catalog.destinationPath), { ...catalog.intent.payload, extra: true }))
})
it('refuses incompatible source before freezing without changing raw data or account control', async () => {
  await write('bookNotes/book/n/isPinned', null)
  const before = await read()
  await expect(service().begin()).rejects.toThrow('incompatible-source')
  expect(await read()).toEqual(before)
  expect((await read('bookProtocol'))).toBeNull()
})
it('isolates other owners and refuses a service bound to another Auth identity before network access', async () => {
  await service().begin(); await service().resume({ maxUnits: 1 })
  expect(() => service(2)).toThrow('fictional-owner-required')
  await denied(write('bookProtocol/state', 'ready', 2))
  await denied(write('library/book/title', 'Other account', 2))
  await expect(read('', 2)).rejects.toThrow('read denied')
})
it('does not infer an import from a forged plan digest or checkpoint observation', async () => {
  await service().begin()
  const user = await read(), prep = await preparation()
  expect(user.historicalImport.planDigest).toBe(planDigest(prep))
  expect(verifyHistoricalImport({ ...user, historicalImport: { ...user.historicalImport, phase: 'sealed', stage: 'imported' } }, identity()).status).toBe('blocked')
})
