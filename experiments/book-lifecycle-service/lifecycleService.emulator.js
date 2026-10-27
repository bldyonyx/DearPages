import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, goOffline, goOnline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createBookMutationContext, MAX_BOOK_GENERATION } from '../../src/utils/bookMutationContext.js'
import { bookDataPath, bookLifecyclePath, bookLibraryPath, bookNotesPath, bookProtocolPath } from '../../src/utils/bookGenerationPaths.js'

// Default implementations always call the real SDK against the emulator.
// Individual tests inject caller-boundary faults around actual SDK writes;
// this does not claim to simulate lost TCP acknowledgements.
vi.mock('firebase/database', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, set: vi.fn(actual.set), update: vi.fn(actual.update) }
})
const sdk = await vi.importActual('firebase/database')
const realFetch = globalThis.fetch.bind(globalThis)
const clients = []
let uid, otherUid, unreadyUid, bookId, sequence = 0
const library = { title: 'Fictional lifecycle service book', status: 'finished' }
const ctx = (generation = 1, owner = uid, id = bookId) => createBookMutationContext({ uid: owner, bookId: id, generation })
const service = (client = 0) => clients[client].service
const location = (path, client = 0) => ref(clients[client].database, path)
const observed = async path => (await get(location(path, 1))).val()
const bookRoot = context => bookDataPath(context).split('/').slice(0, -1).join('/')
const denied = promise => expect(promise).rejects.toThrow(/permission[ _-]denied/i)
async function active(context = ctx(), client = 0) {
  await service(client).initializeGeneration(context)
  await set(location(bookLibraryPath(context), client), library)
  await service(client).activateGeneration(context)
  return context
}
async function populate(context = ctx()) {
  await update(location(bookDataPath(context)), {
    'bookNotes/a': { text: 'Fictional note' }, 'bookNotes/b': { text: 'Another note' },
    'bookRatings/a': { value: 4 }, 'collectionMemberships/one': true,
  })
}
async function readd(context = ctx()) {
  await service().deleteGeneration(context)
  return service().beginNextGeneration(context)
}

beforeAll(async () => {
  await assertEmulatorProject()
  await assertEmulatorsReady()
  const email = `lifecycle-service-${Date.now()}@example.test`
  const password = 'fictional-emulator-password'
  for (let index = 0; index < 5; index++) {
    const app = initializeApp({ apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, projectId: emulator.projectId,
      databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `lifecycle-service-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, emulator.host, emulator.database)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if (index === 1) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid
    if (index === 4) unreadyUid = (await createUserWithEmailAndPassword(auth, `unready-${email}`, password)).user.uid
    clients.push({ app, auth, database, service: createBookLifecycleService(database) })
  }
  await service().initializeProtocol(ctx(1, uid, 'bootstrap'))
  await service(2).initializeProtocol(ctx(1, otherUid, 'bootstrap'))
})
beforeEach(() => {
  bookId = `fictional-service-${++sequence}`
  set.mockReset().mockImplementation(sdk.set)
  update.mockReset().mockImplementation(sdk.update)
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const client of clients) goOnline(client.database)
})
afterAll(async () => {
  for (const client of clients) { goOffline(client.database); await deleteApp(client.app) }
})

it('refuses a non-demo database before creating any reference or connection', () => {
  expect(() => createBookLifecycleService({ app: { options: { projectId: 'fictional-not-demo' } } }))
    .toThrow('book-lifecycle/emulator-only')
})

it('refuses alternate namespaces, hosts and privileged emulator credentials before any write', () => {
  const info = clients[0].database._repoInternal.repoInfo_
  for (const changes of [{ namespace: 'another-fictional-namespace' }, { host: '127.0.0.1:9001' },
    { secure: true }, { isUsingEmulator: false }, { nodeAdmin: true },
    { emulatorOptions: { mockUserToken: 'owner' } }]) {
    const candidate = { app: clients[0].app, _repoInternal: {
      repoInfo_: { ...info, host: info.host, ...changes },
    } }
    expect(() => createBookLifecycleService(candidate)).toThrow('book-lifecycle/emulator-only')
  }
  expect(set).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it('requires explicit ready protocol, then bootstraps it idempotently', async () => {
  const context = ctx(1, unreadyUid)
  await expect(service(4).initializeGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/protocol-not-ready' })
  await service(4).initializeProtocol(context)
  await service(4).initializeProtocol(context)
  expect((await get(location(bookProtocolPath(context), 4))).val()).toEqual({ version: 2, state: 'ready' })
  await service(4).initializeGeneration(context)
})

it('reads absent, creates generation 1 once, and preserves frozen caller context', async () => {
  const context = ctx()
  expect(await service().readLifecycle(context)).toBeNull()
  const result = await service().initializeGeneration(context)
  expect(Object.isFrozen(result)).toBe(true)
  expect(result).toEqual(context)
  await service().initializeGeneration(context)
  expect(set).toHaveBeenCalledTimes(1)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'creating' })
})

it('requires initialized library, then activates idempotently', async () => {
  const context = ctx()
  await service().initializeGeneration(context)
  await expect(service().activateGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/library-not-initialized' })
  await denied(set(location(bookLifecyclePath(context)), { generation: 1, state: 'active' }))
  await set(location(bookLibraryPath(context)), library)
  await service().activateGeneration(context)
  await service().activateGeneration(context)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'active' })
})

it('joins two concurrent creations without incrementing twice', async () => {
  const context = ctx()
  const results = await Promise.all([service().initializeGeneration(context), service(1).initializeGeneration(context)])
  expect(results).toEqual([context, context])
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'creating' })
})

it('locks durably, rejects ordinary writes, and purges every payload atomically', async () => {
  const context = await active()
  await populate(context)
  await expect(service().purgeGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/invalid-state' })
  await service().lockDeletion(context)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'deleting' })
  await denied(set(location(bookNotesPath(context, 'late')), { text: 'Late' }))
  await service().purgeGeneration(context)
  expect(await observed(bookRoot(context))).toBeNull()
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'deleted' })
})

it('handles two concurrent complete deletions and repeat resume calls', async () => {
  const context = await active()
  await populate(context)
  const expected = { generation: 1, state: 'deleted' }
  expect(await Promise.all([service().deleteGeneration(context), service(1).deleteGeneration(context)]))
    .toEqual([expected, expected])
  expect(await service().resumeDeletion(context)).toEqual(expected)
  expect(await service().deleteGeneration(context)).toEqual(expected)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('resumes acknowledged deletion using a fresh service instance after interruption', async () => {
  const context = await active()
  await populate(context)
  await service().lockDeletion(context)
  const restarted = createBookLifecycleService(clients[1].database)
  expect(await restarted.resumeDeletion(context)).toEqual({ generation: 1, state: 'deleted' })
  expect(await observed(bookRoot(context))).toBeNull()
})

it('resumes after an offline queued purge and does not expose deleted before acknowledgement', async () => {
  const context = await active()
  await populate(context)
  await service().lockDeletion(context)
  update.mockClear()
  const queue = update.mockImplementationOnce(async (...args) => {
    goOffline(clients[0].database)
    const pending = sdk.update(...args)
    expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'deleting' })
    expect(await observed(bookDataPath(context))).not.toBeNull()
    goOnline(clients[0].database)
    return pending
  })
  await service().resumeDeletion(context)
  expect(queue).toHaveBeenCalledTimes(1)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('cancels interrupted empty creating and permits its deterministic successor', async () => {
  const context = ctx()
  await service().initializeGeneration(context)
  await service().deleteGeneration(context)
  const next = await service().beginNextGeneration(context)
  expect(next).toEqual({ ...context, generation: 2 })
  expect(context.generation).toBe(1)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 2, state: 'creating' })
})

it('cancels interrupted creating with initialized data without activating it', async () => {
  const context = ctx()
  await service().initializeGeneration(context)
  await set(location(bookLibraryPath(context)), library)
  await service().deleteGeneration(context)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('readds once under concurrent calls, keeping the predecessor fixed for retries', async () => {
  const context = await active()
  await service().deleteGeneration(context)
  const [first, second] = await Promise.all([service().beginNextGeneration(context), service(1).beginNextGeneration(context)])
  expect(first).toEqual({ ...context, generation: 2 })
  expect(second).toEqual(first)
  expect(await service().beginNextGeneration(context)).toEqual(first)
  expect(await observed(bookRoot(context))).toBeNull()
  expect(Object.isFrozen(first)).toBe(true)
})

it.each(['initialize', 'readd', 'activate', 'lock', 'purge'])('recovers a discarded %s acknowledgement without a second mutation', async kind => {
  let context = ctx(), operation
  if (kind === 'initialize') operation = () => service().initializeGeneration(context)
  else {
    await active(context)
    if (kind === 'readd') { await service().deleteGeneration(context); operation = () => service().beginNextGeneration(context) }
    if (kind === 'activate') {
      context = await readd(context)
      await set(location(bookLibraryPath(context)), library)
      operation = () => service().activateGeneration(context)
    }
    if (kind === 'lock') operation = () => service().lockDeletion(context)
    if (kind === 'purge') { await populate(context); await service().lockDeletion(context); operation = () => service().purgeGeneration(context) }
  }
  const write = kind === 'purge' ? update : set
  const actual = kind === 'purge' ? sdk.update : sdk.set
  write.mockClear()
  write.mockImplementationOnce(async (...args) => {
    await actual(...args)
    throw Object.assign(new Error('Injected discarded SDK result'), { code: 'test/ack-lost' })
  })
  await expect(operation()).rejects.toMatchObject({ code: 'test/ack-lost' })
  await operation()
  expect(write).toHaveBeenCalledTimes(1)
})

it('keeps a rejected write visible and leaves the state unchanged without auto-retrying', async () => {
  const context = ctx()
  set.mockRejectedValueOnce(Object.assign(new Error('Injected transport failure'), { code: 'test/network' }))
  await expect(service().initializeGeneration(context)).rejects.toMatchObject({ code: 'test/network' })
  expect(set).toHaveBeenCalledTimes(1)
  expect(await service().readLifecycle(context)).toBeNull()
})

it('does not accept optimistic SDK state as an acknowledged server transition', async () => {
  const context = await active()
  goOffline(clients[0].database)
  const queued = sdk.set(location(bookLifecyclePath(context)), { generation: 1, state: 'deleting' })
  // REST bypasses the SDK cache and still sees the acknowledged active state.
  expect(await service().readLifecycle(context)).toEqual({ generation: 1, state: 'active' })
  goOnline(clients[0].database)
  await queued
  await service().resumeDeletion(context)
})

it('fails closed on an injected server-read network error without issuing a write', async () => {
  const context = ctx()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Injected connection failure')))
  await expect(service().initializeGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/network-error' })
  expect(set).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it.each([[401, 'permission-denied'], [403, 'permission-denied'], [503, 'server-error']])(
  'does not mask an HTTP %s refusal or retry it', async (status, code) => {
    const fetcher = vi.fn(async () => new Response('{}', { status }))
    vi.stubGlobal('fetch', fetcher)
    await expect(service().readLifecycle(ctx())).rejects.toMatchObject({ code: `book-lifecycle/${code}` })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(set).not.toHaveBeenCalled()
  },
)

it('rejects a newer generation reached between preflight and lock commit', async () => {
  const context = await active()
  set.mockImplementationOnce(async (...args) => {
    await service(1).deleteGeneration(context)
    await service(1).beginNextGeneration(context)
    return sdk.set(...args)
  })
  await expect(service().lockDeletion(context)).rejects.toMatchObject({ code: 'book-lifecycle/stale-generation' })
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 2, state: 'creating' })
})

it('rejects old mutations and transactions after readd without changing the new payload', async () => {
  const old = await active()
  const next = await readd(old)
  await set(location(bookLibraryPath(next)), library)
  await service().activateGeneration(next)
  await populate(next)
  const before = await observed(bookRoot(next))
  for (const call of [() => service().initializeGeneration(old), () => service().activateGeneration(old),
    () => service().lockDeletion(old), () => service().deleteGeneration(old), () => service().purgeGeneration(old),
    () => service().resumeDeletion(old)]) {
    await expect(call()).rejects.toMatchObject({ code: 'book-lifecycle/stale-generation' })
  }
  await expect(service().beginNextGeneration(old)).rejects.toMatchObject({ code: 'book-lifecycle/invalid-state' })
  await denied(runTransaction(location(bookNotesPath(old, 'late')), () => ({ text: 'Stale transaction' }), { applyLocally: false }))
  expect(await observed(bookRoot(next))).toEqual(before)
})

it('rejects a queued stale purge after another connection deletes and readds', async () => {
  const old = await active()
  await service().lockDeletion(old)
  update.mockImplementationOnce(async (...args) => {
    goOffline(clients[0].database)
    const pending = sdk.update(...args)
    const rejected = denied(pending)
    await service(1).resumeDeletion(old)
    await service(1).beginNextGeneration(old)
    goOnline(clients[0].database)
    await rejected
    // Preserve the actual SDK rejection for the service reconciliation path.
    return pending
  })
  await expect(service().purgeGeneration(old)).rejects.toMatchObject({ code: 'book-lifecycle/stale-generation' })
  expect(await observed(bookLifecyclePath(old))).toEqual({ generation: 2, state: 'creating' })
})

it('serializes concurrent SDK lock transactions with a fixed expected generation', async () => {
  const context = await active()
  const lock = client => runTransaction(location(bookLifecyclePath(context), client), current => {
    if (current && (current.generation !== context.generation || current.state !== 'active')) return undefined
    return { generation: context.generation, state: 'deleting' }
  }, { applyLocally: false })
  const locks = await Promise.all([lock(0), lock(1)])
  expect(locks.filter(result => result.committed)).toHaveLength(1)
  await service().resumeDeletion(context)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('preserves edits accepted before a concurrent lock only until the purge', async () => {
  const context = await active()
  await populate(context)
  const results = await Promise.allSettled([
    sdk.update(location(bookNotesPath(context, 'a'), 1), { text: 'Concurrent edit' }),
    service().lockDeletion(context),
  ])
  expect(results[1].status).toBe('fulfilled')
  if (results[0].status === 'rejected') expect(results[0].reason.message).toMatch(/permission[ _-]denied/i)
  await service().purgeGeneration(context)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('reaches the maximum generation from a demo-only high-counter fixture, then refuses rollover', async () => {
  // Reaching this boundary by replaying 2^31 lifecycles is impractical. Seed only
  // a fictional predecessor with Emulator's admin token, never used by service.
  const previous = ctx(MAX_BOOK_GENERATION - 1)
  const response = await realFetch(`http://127.0.0.1:9000/${bookLifecyclePath(previous)}.json?ns=demo-dear-pages`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ generation: previous.generation, state: 'deleted' }),
  })
  expect(response.ok).toBe(true)
  const last = await service().beginNextGeneration(previous)
  expect(last.generation).toBe(MAX_BOOK_GENERATION)
  await set(location(bookLibraryPath(last)), library)
  await service().activateGeneration(last)
  await service().deleteGeneration(last)
  await expect(service().beginNextGeneration(last)).rejects.toMatchObject({ code: 'book-lifecycle/generation-exhausted' })
  await denied(set(location(bookLifecyclePath(last)), { generation: 1, state: 'creating' }))
  await denied(set(location(bookLifecyclePath(last)), { generation: MAX_BOOK_GENERATION + 1, state: 'creating' }))
  expect(await observed(bookRoot(last))).toBeNull()
})

it.each(['activate', 'lock', 'purge', 'resume', 'readd'])('rejects %s on an absent book', async operation => {
  const methods = { activate: 'activateGeneration', lock: 'lockDeletion', purge: 'purgeGeneration', resume: 'resumeDeletion', readd: 'beginNextGeneration' }
  await expect(service()[methods[operation]](ctx())).rejects.toMatchObject({ code: expect.stringMatching(/^book-lifecycle\//) })
  expect(await observed(bookRoot(ctx()))).toBeNull()
})

it('refuses non-first initialization, resume on active and readd before deletion', async () => {
  await expect(service().initializeGeneration(ctx(2))).rejects.toMatchObject({ code: 'book-lifecycle/invalid-initial-generation' })
  const context = await active()
  await expect(service().resumeDeletion(context)).rejects.toMatchObject({ code: 'book-lifecycle/invalid-state' })
  await expect(service().beginNextGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/stale-generation' })
})

it('keeps illegal transitions, lock-and-purge and counter deletion denied by rules', async () => {
  const context = await active()
  await populate(context)
  await denied(set(location(bookLifecyclePath(context)), { generation: 1, state: 'deleted' }))
  await denied(sdk.update(ref(clients[0].database), {
    [bookLifecyclePath(context)]: { generation: 1, state: 'deleting' }, [bookDataPath(context)]: null,
  }))
  await denied(remove(location(bookLifecyclePath(context))))
  await service().lockDeletion(context)
  await denied(set(location(bookLifecyclePath(context)), { generation: 1, state: 'active' }))
  await denied(set(location(bookLifecyclePath(context)), { generation: 1, state: 'deleted' }))
  expect(await observed(bookDataPath(context))).not.toBeNull()
  await service().resumeDeletion(context)
})

it('isolates owners and anonymous clients while preserving another book', async () => {
  const target = await active()
  await populate(target)
  const retained = ctx(1, uid, `${bookId}-retained`)
  await active(retained)
  const other = ctx(1, otherUid)
  await active(other, 2)
  for (const client of [2, 3]) {
    await expect(service(client).deleteGeneration(target)).rejects.toMatchObject({ code: 'book-lifecycle/owner-mismatch' })
    await denied(sdk.set(location(bookLifecyclePath(target), client), { generation: 1, state: 'deleting' }))
    await denied(get(location(bookDataPath(target), client)))
  }
  await service().deleteGeneration(target)
  expect(await observed(bookRoot(target))).toBeNull()
  expect(await observed(bookLibraryPath(retained))).toEqual(library)
  expect((await get(location(bookLibraryPath(other), 2))).val()).toEqual(library)
})

it('fails closed on contradictory lifecycle and deleted-with-residue server responses', async () => {
  const context = await active()
  await service().deleteGeneration(context)
  vi.stubGlobal('fetch', async (url, options) => {
    const path = new URL(url).pathname
    if (path === `/${bookRoot(context)}.json`) return new Response(JSON.stringify({ orphan: true }))
    return realFetch(url, options)
  })
  await expect(service().resumeDeletion(context)).rejects.toMatchObject({ code: 'book-lifecycle/contradictory-state' })
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ generation: 1, state: 'unknown' })))
  await expect(service().readLifecycle(context)).rejects.toMatchObject({ code: 'book-lifecycle/contradictory-state' })
})

it('recovers a successful purge when its subsequent confirmation read fails', async () => {
  const context = await active()
  await populate(context)
  await service().lockDeletion(context)
  update.mockClear()
  update.mockImplementationOnce(async (...args) => {
    await sdk.update(...args)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Injected confirmation failure')))
  })
  await expect(service().purgeGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/network-error' })
  vi.unstubAllGlobals()
  expect(await service().resumeDeletion(context)).toEqual({ generation: 1, state: 'deleted' })
  expect(update).toHaveBeenCalledTimes(1)
  expect(await observed(bookRoot(context))).toBeNull()
})

it('does not repair a lost creation acknowledgement by regressing an advanced lifecycle', async () => {
  const context = ctx()
  set.mockImplementationOnce(async (...args) => {
    await sdk.set(...args)
    await sdk.set(location(bookLibraryPath(context), 1), library)
    await service(1).activateGeneration(context)
    throw Object.assign(new Error('Injected discarded creation result'), { code: 'test/ack-lost' })
  })
  await expect(service().initializeGeneration(context)).rejects.toMatchObject({ code: 'test/ack-lost' })
  await expect(service().initializeGeneration(context)).rejects.toMatchObject({ code: 'book-lifecycle/invalid-state' })
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'active' })
})
