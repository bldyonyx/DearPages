import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, get, update, remove, runTransaction, goOffline, goOnline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

const clients = []
let uid, otherUid, bookId, sequence = 0
const library = { title: 'Fictional book', status: 'finished' }
const control = (generation, state) => ({ generation, state })
const root = (owner = uid) => `users/${owner}`
const life = (owner = uid) => `${root(owner)}/bookLifecycle/${bookId}`
const payload = (g = 1, owner = uid) => `${root(owner)}/bookData/${bookId}/${g}`
const location = (path, client = 0) => ref(clients[client].database, path)
// A separate authenticated SDK is used to observe acknowledged server state.
const read = async path => (await get(location(path, 1))).val()
const denied = promise => expect(promise).rejects.toThrow(/permission[ _-]denied/i)
const transition = (state, g = 1, client = 0) => set(location(life(), client), control(g, state))
async function creating(g = 1) { await transition('creating', g) }
async function active(g = 1) {
  await creating(g)
  await set(location(`${payload(g)}/library`), library)
  await transition('active', g)
}
async function populate(g = 1) {
  await update(location(payload(g)), {
    'bookNotes/a': { text: 'First note' },
    'bookNotes/b': { text: 'Second note' },
    'bookRatings/a': { value: 4 },
    'bookRatings/b': { value: 5 },
    'collectionMemberships/one': true,
    'collectionMemberships/two': true,
  })
}
const purge = (g = 1, client = 0) => update(location(root(), client), {
  [`bookData/${bookId}/${g}`]: null,
  [`bookLifecycle/${bookId}`]: control(g, 'deleted'),
})
async function readded() {
  await active(); await populate(); await transition('deleting'); await purge(); await active(2); await populate(2)
}
async function unchangedAfterRejection(action) {
  const before = { lifecycle: await read(life()), data: await read(`${root()}/bookData/${bookId}`) }
  await denied(action())
  expect({ lifecycle: await read(life()), data: await read(`${root()}/bookData/${bookId}`) }).toEqual(before)
}

beforeAll(async () => {
  expect(emulator.projectId).toBe('demo-dear-pages')
  await assertEmulatorProject()
  await assertEmulatorsReady()
  const email = `poc-${Date.now()}@example.test`
  const password = 'fictional-emulator-password'
  for (let index = 0; index < 4; index++) {
    const app = initializeApp({ apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, projectId: emulator.projectId, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `lifecycle-poc-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, emulator.host, emulator.database)
    clients.push({ app, auth, database })
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if (index === 1) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${Date.now()}@example.test`, password)).user.uid
    // Client 3 stays anonymous.
  }
  await set(location(`${root()}/bookProtocol`), { version: 2, state: 'ready' })
  await set(location(`${root(otherUid)}/bookProtocol`, 2), { version: 2, state: 'ready' })
})
beforeEach(() => { bookId = `fictional-${++sequence}` })
afterAll(async () => {
  // Ephemeral emulator only. No administrative cleanup or ancestor bypass.
  for (const client of clients) { goOffline(client.database); await deleteApp(client.app) }
})

it('creates generation 1 and permits only library initialization while creating', async () => {
  await creating()
  expect(await read(life())).toEqual(control(1, 'creating'))
  for (const [path, value] of [['bookNotes/a', { text: 'Late' }], ['bookRatings/a', { value: 3 }], ['collectionMemberships/a', true]]) {
    await unchangedAfterRejection(() => set(location(`${payload()}/${path}`), value))
  }
  await set(location(`${payload()}/library`), library)
  expect(await read(payload())).toEqual({ library })
})

it('requires library for activation and supports atomic initialization plus activation', async () => {
  await creating()
  await unchangedAfterRejection(() => transition('active'))
  await update(location(root()), {
    [`bookData/${bookId}/1/library`]: library,
    [`bookLifecycle/${bookId}`]: control(1, 'active'),
  })
  expect(await read(life())).toEqual(control(1, 'active'))
  expect(await read(payload())).toEqual({ library })
})

it('creates and edits active data with generation in every path', async () => {
  await active(); await populate()
  await update(location(`${payload()}/bookNotes/a`), { text: 'Edited' })
  await update(location(`${payload()}/bookRatings/a`), { value: 2 })
  expect(await read(`${payload()}/bookNotes/a`)).toEqual({ text: 'Edited' })
  expect(await read(`${payload()}/bookRatings/a`)).toEqual({ value: 2 })
  expect(await read(`${payload()}/collectionMemberships`)).toEqual({ one: true, two: true })
  await unchangedAfterRejection(() => set(location(`${payload(2)}/library`), library))
})

it('protects ordinary note/rating deletion and rejects malformed or unknown fields', async () => {
  await active(); await populate()
  for (const path of ['bookNotes/a', 'bookNotes/a/text', 'bookRatings/a', 'bookRatings/a/value', 'library']) {
    await unchangedAfterRejection(() => remove(location(`${payload()}/${path}`)))
  }
  for (const [path, value] of [['bookRatings/a/value', 6], ['bookNotes/a/extra', true], ['unknown', true], ['library/status', 'unknown']]) {
    await unchangedAfterRejection(() => set(location(`${payload()}/${path}`), value))
  }
})

it('locks writes during deleting including membership deletions and library edits', async () => {
  await active(); await populate(); await transition('deleting')
  for (const [path, value] of [['bookNotes/c', { text: 'Late' }], ['bookRatings/c', { value: 1 }], ['collectionMemberships/c', true], ['library/title', 'Late']]) {
    await unchangedAfterRejection(() => set(location(`${payload()}/${path}`), value))
  }
  await unchangedAfterRejection(() => remove(location(`${payload()}/collectionMemberships/one`)))
})

it('purges all payload physically and finalizes deleted in one atomic update', async () => {
  await active(); await populate(); await transition('deleting'); await purge()
  expect(await read(`${root()}/bookData/${bookId}`)).toBeNull()
  expect(await read(life())).toEqual(control(1, 'deleted'))
})

it('supports purge then separate finalization, including an empty creating cancellation', async () => {
  await active(); await populate(); await transition('deleting')
  await remove(location(payload()))
  expect(await read(payload())).toBeNull()
  expect(await read(life())).toEqual(control(1, 'deleting'))
  await transition('deleted')
  expect(await read(life())).toEqual(control(1, 'deleted'))
  await creating(2); await transition('deleting', 2); await purge(2)
  expect(await read(life())).toEqual(control(2, 'deleted'))
})

it('readds generation 2 with no historical payload remaining', async () => {
  await active(); await populate(); await transition('deleting'); await purge(); await active(2)
  expect(await read(payload())).toBeNull()
  expect(await read(payload(2))).toEqual({ library })
  expect(await read(life())).toEqual(control(2, 'active'))
})

it('rejects old creates, edits, removals and purge retries after readd without touching generation 2', async () => {
  await readded()
  for (const action of [
    () => set(location(`${payload()}/bookNotes/late`), { text: 'Old' }),
    () => update(location(`${payload()}/bookNotes/a`), { text: 'Old edit' }),
    () => set(location(`${payload()}/bookRatings/a`), { value: 2 }),
    () => set(location(`${payload()}/collectionMemberships/late`), true),
    () => remove(location(`${payload()}/bookNotes/a`)),
    () => remove(location(payload())),
    () => purge(),
  ]) await unchangedAfterRejection(action)
})

it('rejects a real SDK transaction replayed against generation 1 after readd', async () => {
  await readded()
  await unchangedAfterRejection(() => runTransaction(location(`${payload()}/bookNotes/late`), () => ({ text: 'Stale transaction' }), { applyLocally: false }))
})

it.each([
  ['initial active', null, 'active', 1], ['initial zero', null, 'creating', 0],
  ['initial two', null, 'creating', 2], ['skip active', 'creating', 'deleted', 1],
  ['creating reuse', 'creating', 'creating', 1], ['active no-op', 'active', 'active', 1],
  ['active skip purge', 'active', 'deleted', 1], ['active increment', 'active', 'deleting', 2],
  ['unlock deletion', 'deleting', 'active', 1], ['deleting increment', 'deleting', 'creating', 2],
  ['deleted reuse', 'deleted', 'creating', 1], ['deleted skip', 'deleted', 'creating', 3],
  ['fraction', 'deleted', 'creating', 2.5], ['overflow', 'deleted', 'creating', 2147483648],
])('rejects illegal transition %s', async (_name, initial, target, generation) => {
  if (initial === 'creating') await creating()
  if (['active', 'deleting', 'deleted'].includes(initial)) await active()
  if (['deleting', 'deleted'].includes(initial)) await transition('deleting')
  if (initial === 'deleted') await purge()
  await unchangedAfterRejection(() => transition(target, generation))
})

it('cannot finalize with remaining data, purge active data or lock-and-purge in one step', async () => {
  await active(); await populate()
  await unchangedAfterRejection(() => remove(location(payload())))
  await unchangedAfterRejection(() => update(location(root()), {
    [`bookLifecycle/${bookId}`]: control(1, 'deleting'), [`bookData/${bookId}/1`]: null,
  }))
  await transition('deleting')
  await unchangedAfterRejection(() => transition('deleted'))
})

it('denies protected ancestors and immutable protocol/counter deletion or reset', async () => {
  await active(); await populate()
  for (const path of [root(), `${root()}/bookLifecycle`, life(), `${life()}/generation`, `${root()}/bookData`, `${root()}/bookData/${bookId}`, `${root()}/bookProtocol`]) {
    await unchangedAfterRejection(() => remove(location(path)))
  }
  for (const path of [root(), `${root()}/bookData`, `${root()}/bookLifecycle`]) {
    await unchangedAfterRejection(() => set(location(path), { replacement: true }))
  }
  await unchangedAfterRejection(() => set(location(`${root()}/bookProtocol/version`), 1))
  await unchangedAfterRejection(() => set(location(`${life()}/generation`), 0))
  await unchangedAfterRejection(() => set(location(`${life()}/extra`), true))
  expect(await read(`${root()}/bookProtocol`)).toEqual({ version: 2, state: 'ready' })
})

it('rejects hostile multipath updates atomically: root is before, newData ancestors are after', async () => {
  await active(); await populate()
  await unchangedAfterRejection(() => update(location(root()), {
    [`bookLifecycle/${bookId}`]: control(1, 'deleting'),
    [`bookData/${bookId}/1/bookNotes/a/text`]: 'Must not sneak through with lock',
  }))
  await transition('deleting')
  await unchangedAfterRejection(() => update(location(root()), {
    [`bookLifecycle/${bookId}`]: control(1, 'deleted'),
    [`bookData/${bookId}/1/bookNotes`]: null, // Other data remains.
  }))
  await purge(); await active(2)
  await unchangedAfterRejection(() => update(location(root()), {
    [`bookData/${bookId}/2/bookNotes/valid`]: { text: 'Valid alone' },
    [`bookData/${bookId}/1/bookNotes/stale`]: { text: 'Invalid' },
  }))
})

it('isolates two owners of the same bookId and denies anonymous reads/writes', async () => {
  await active(); await populate()
  await set(location(life(otherUid), 2), control(1, 'creating'))
  await set(location(`${payload(1, otherUid)}/library`, 2), library)
  await set(location(life(otherUid), 2), control(1, 'active'))
  for (const client of [2, 3]) {
    await denied(get(location(payload(), client)))
    await unchangedAfterRejection(() => set(location(life(), client), control(1, 'deleting')))
    await unchangedAfterRejection(() => remove(location(payload(), client)))
    await unchangedAfterRejection(() => set(location(`${payload()}/bookNotes/a`, client), { text: 'Intrusion' }))
  }
  await transition('deleting'); await purge()
  expect((await get(location(payload(1, otherUid), 2))).val()).toEqual({ library })
  expect((await get(location(life(otherUid), 2))).val()).toEqual(control(1, 'active'))
})

it('resumes after an offline interruption following acknowledged lock', async () => {
  await active(); await populate(); await transition('deleting')
  goOffline(clients[0].database)
  const before = await read(payload())
  const pending = purge()
  // Read through the second connection while the first cannot send its purge.
  expect(await read(payload())).toEqual(before)
  expect(await read(life())).toEqual(control(1, 'deleting'))
  goOnline(clients[0].database)
  await pending
  expect(await read(payload())).toBeNull()
  expect(await read(life())).toEqual(control(1, 'deleted'))
})

it('keeps a rejected partial cleanup resumable and preserves another book', async () => {
  await active(); await populate()
  const retainedId = `${bookId}-retained`
  await set(location(`${root()}/bookLifecycle/${retainedId}`), control(1, 'creating'))
  await set(location(`${root()}/bookData/${retainedId}/1/library`), library)
  await set(location(`${root()}/bookLifecycle/${retainedId}`), control(1, 'active'))
  await transition('deleting')
  await unchangedAfterRejection(() => update(location(root()), {
    [`bookData/${bookId}/1`]: null, [`bookLifecycle/${bookId}`]: control(2, 'deleted'),
  }))
  await purge()
  expect(await read(payload())).toBeNull()
  expect(await read(`${root()}/bookData/${retainedId}/1`)).toEqual({ library })
  expect(await read(`${root()}/bookLifecycle/${retainedId}`)).toEqual(control(1, 'active'))
})

it('serializes competing lock transactions and safely resolves competing purges', async () => {
  await active(); await populate()
  const lock = client => runTransaction(location(life(), client), current => {
    if (current && (current.generation !== 1 || current.state !== 'active')) return undefined
    return control(1, 'deleting')
  }, { applyLocally: false })
  const locks = await Promise.all([lock(0), lock(1)])
  expect(locks.filter(result => result.committed)).toHaveLength(1)
  expect(await read(life())).toEqual(control(1, 'deleting'))
  const purges = await Promise.allSettled([purge(1, 0), purge(1, 1)])
  expect(purges.filter(result => result.status === 'fulfilled').length).toBeGreaterThanOrEqual(1)
  for (const result of purges) if (result.status === 'rejected') expect(result.reason.message).toMatch(/permission[ _-]denied/i)
  expect(await read(payload())).toBeNull()
  expect(await read(life())).toEqual(control(1, 'deleted'))
  await active(2)
  await unchangedAfterRejection(() => purge(1, 1))
})

it('resolves a deliberately discarded acknowledgement by an independent server read', async () => {
  await active(); await populate(); await transition('deleting')
  // Fault injection at the caller boundary, not a claimed TCP acknowledgement loss.
  await expect((async () => { await purge(); throw new Error('simulated caller lost result') })()).rejects.toThrow('lost result')
  expect(await read(life())).toEqual(control(1, 'deleted'))
  expect(await read(payload())).toBeNull()
  await active(2); await populate(2)
  await unchangedAfterRejection(() => purge())
})

it('rejects writes to legacy stable paths and noncanonical generation keys', async () => {
  await active()
  for (const path of ['library', 'bookNotes', 'bookRatings', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatingsLegacy', 'collections']) {
    await denied(set(location(`${root()}/${path}/${bookId}`), { legacy: true }))
  }
  for (const g of ['01', '0', '-1']) await unchangedAfterRejection(() => set(location(`${payload(g)}/library`), library))
  // A dot is rejected by the SDK before the request reaches security rules.
  expect(() => location(`${payload('1.0')}/library`)).toThrow(/invalid path/i)
  expect(await read(payload())).toEqual({ library })
})

it('rejects an actually queued offline create after another client removes and readds the book', async () => {
  await active(); await populate()
  goOffline(clients[0].database)
  const queued = set(location(`${payload()}/bookNotes/offline`), { text: 'Prepared for generation 1' })
  const rejected = denied(queued) // Attach immediately, before reconnecting.
  await transition('deleting', 1, 1); await purge(1, 1)
  await transition('creating', 2, 1)
  await set(location(`${payload(2)}/library`, 1), library)
  await transition('active', 2, 1)
  const before = await read(payload(2))
  goOnline(clients[0].database)
  await rejected
  expect(await read(payload())).toBeNull()
  expect(await read(payload(2))).toEqual(before)
  expect(await read(life())).toEqual(control(2, 'active'))
})

it('serializes a concurrent edit and lock: accepted edits are purged, later edits are denied', async () => {
  await active(); await populate()
  const results = await Promise.allSettled([
    update(location(`${payload()}/bookNotes/a`, 1), { text: 'Concurrent edit' }),
    transition('deleting'),
  ])
  expect(results[1].status).toBe('fulfilled')
  if (results[0].status === 'rejected') expect(results[0].reason.message).toMatch(/permission[ _-]denied/i)
  expect(await read(life())).toEqual(control(1, 'deleting'))
  await unchangedAfterRejection(() => set(location(`${payload()}/bookNotes/a`, 1), { text: 'Too late' }))
  await purge()
  expect(await read(payload())).toBeNull()
  expect(await read(life())).toEqual(control(1, 'deleted'))
})

it('rejects cross-UID multipath writes without committing the valid owner portion', async () => {
  await active()
  await denied(update(location('users'), {
    [`${uid}/bookData/${bookId}/1/bookNotes/valid`]: { text: 'Valid alone' },
    [`${otherUid}/bookLifecycle/${bookId}`]: control(1, 'creating'),
  }))
  expect(await read(payload())).toEqual({ library })
  expect((await get(location(life(otherUid), 2))).val()).toBeNull()
})
