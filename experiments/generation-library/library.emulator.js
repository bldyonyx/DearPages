import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { bookDataPath, bookLibraryPath, bookLifecyclePath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationLibraryService } from '../../src/services/generationLibraryService.js'
import { createGenerationLibraryBook } from '../../src/utils/generationLibraryModel.js'

vi.mock('firebase/database', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, runTransaction: vi.fn(actual.runTransaction) }
})
const sdk = await vi.importActual('firebase/database')
const clients = []
let uid, otherUid, bookId, sequence = 0
const ctx = (generation = 1, owner = uid, id = bookId) => createBookMutationContext({ uid: owner, bookId: id, generation })
const location = (path, client = 0) => ref(clients[client].database, path)
const observed = async path => (await get(location(path, 4))).val()
const svc = (client = 0) => clients[client].library
const life = (client = 0) => clients[client].lifecycle
const denied = promise => expect(promise).rejects.toThrow(/permission[ _-]denied/i)
function record(context = ctx(), extras = {}) {
  return { ...createGenerationLibraryBook({ id: context.bookId, title: 'Fictional book', authors: ['Author'],
    categories: ['Fiction'], isbns: ['123'], description: 'Keep description' }, 'finished'),
  addedAt: 1000, startedAt: 100, finishedAt: 200, note: 'Keep note', review: 'Keep review', rating: 4, ...extras }
}
async function creating(context = ctx(), client = 0) {
  await life(client).initializeGeneration(context)
  return context
}
async function active(context = ctx(), client = 0, extras = {}) {
  await creating(context, client)
  await svc(client).initializeLibrary(context, record(context, extras))
  await life(client).activateGeneration(context)
  return context
}
async function readd(old) {
  await life(1).deleteGeneration(old)
  const next = await life(1).beginNextGeneration(old)
  await svc(1).initializeLibrary(next, record(next, { title: 'New generation' }))
  await life(1).activateGeneration(next)
  return next
}
async function unchanged(action, context = ctx()) {
  const before = await observed(bookDataPath(context))
  await action()
  expect(await observed(bookDataPath(context))).toEqual(before)
}

beforeAll(async () => {
  await assertEmulatorProject()
  await assertEmulatorsReady()
  const email = `generation-library-${Date.now()}@example.test`, password = 'fictional-emulator-password'
  for (let index = 0; index < 5; index++) {
    const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
      databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `generation-library-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, '127.0.0.1', 9000)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if ([1, 4].includes(index)) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid
    clients.push({ app, auth, database, library: createGenerationLibraryService(database), lifecycle: createBookLifecycleService(database) })
  }
  await life().initializeProtocol(ctx(1, uid, 'bootstrap'))
  await life(2).initializeProtocol(ctx(1, otherUid, 'bootstrap'))
})
beforeEach(() => {
  bookId = `fictional-library-${++sequence}`
  runTransaction.mockReset().mockImplementation(sdk.runTransaction)
})
afterEach(() => { vi.unstubAllGlobals(); for (const client of clients) goOnline(client.database) })
afterAll(async () => { for (const client of clients) { goOffline(client.database); await deleteApp(client.app) } })

it('refuses non-demo configuration without opening a reference', () => {
  expect(() => createGenerationLibraryService({ app: { options: { projectId: 'fictional-not-demo' } } })).toThrow('emulator-only')
})

it('round-trips valid RTDB keys containing URL syntax without retargeting another path', async () => {
  const context = ctx(1, uid, `${bookId}?percent%2F+amp&back\\slash`)
  await active(context)
  await svc().updateBookRating(context, 3)
  expect((await svc().getActiveBook(context)).book.rating).toBe(3)
  expect((await observed(bookLibraryPath(context))).id).toBe(context.bookId)
  await svc().deleteGeneration(context)
  expect(await observed(bookDataPath(context))).toBeNull()
})

it('initializes a full record only in creating and does not implicitly activate', async () => {
  const context = ctx(), input = record(context)
  const wire = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null))
  await expect(svc().initializeLibrary(context, input)).rejects.toMatchObject({ code: 'generation-library/not-found' })
  await creating(context)
  await svc().initializeLibrary(context, input)
  expect(await observed(bookLibraryPath(context))).toEqual(wire)
  expect(await observed(bookLifecyclePath(context))).toEqual({ generation: 1, state: 'creating' })
  await expect(svc().getActiveBook(context)).rejects.toMatchObject({ code: 'generation-library/not-active' })
  await life().activateGeneration(context)
  expect((await svc().getActiveBook(context)).book).toEqual(wire)
})

it('retries identical initialization and rejects a different competing payload without overwrite', async () => {
  const context = await creating(), input = record(context)
  await Promise.all([svc().initializeLibrary(context, input), svc(1).initializeLibrary(context, input)])
  await svc().initializeLibrary(context, input)
  await unchanged(() => expect(svc(1).initializeLibrary(context, { ...input, title: 'Other' }))
    .rejects.toMatchObject({ code: 'generation-library/initialization-conflict' }))
})

it('chooses one of two different concurrent initializations and preserves its entire record', async () => {
  const context = await creating(), a = record(context), b = record(context, { title: 'Competitor', rating: 2 })
  const results = await Promise.allSettled([svc().initializeLibrary(context, a), svc(1).initializeLibrary(context, b)])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  const stored = await observed(bookLibraryPath(context))
  expect([a, b].some(candidate => candidate.title === stored.title && candidate.rating === stored.rating)).toBe(true)
  expect(results.find(r => r.status === 'rejected').reason.code).toBe('generation-library/initialization-conflict')
})

it('discovers only active books with captured contexts, sorted newest first', async () => {
  const first = await active(), second = await active(ctx(1, uid, `${bookId}-second`), 0, { addedAt: 2000 })
  const hidden = await creating(ctx(1, uid, `${bookId}-creating`))
  await svc().initializeLibrary(hidden, record(hidden))
  const deleted = await active(ctx(1, uid, `${bookId}-deleted`))
  await life().deleteGeneration(deleted)
  const list = await svc().getActiveBooks(uid)
  const selected = list.filter(entry => [first.bookId, second.bookId, hidden.bookId, deleted.bookId].includes(entry.context.bookId))
  expect(selected.map(entry => entry.context.bookId)).toEqual([second.bookId, first.bookId])
  expect(selected.every(entry => Object.isFrozen(entry.context))).toBe(true)
})

it('preserves legacy status/date behavior and every unrelated field', async () => {
  const context = await active()
  const before = await observed(bookLibraryPath(context))
  await svc().updateBookStatus(context, 'abandoned')
  const after = await observed(bookLibraryPath(context))
  expect(after.status).toBe('abandoned')
  expect(after.finishedAt).toBeUndefined()
  expect(after.abandonedAt).toEqual(expect.any(Number))
  expect(after).toMatchObject({ authors: before.authors, categories: before.categories, description: before.description,
    startedAt: 100, addedAt: 1000, note: 'Keep note', review: 'Keep review', rating: 4 })
  const unchangedDate = after.abandonedAt
  expect((await svc().updateBookStatus(context, 'abandoned')).patch).toBeNull()
  expect((await observed(bookLibraryPath(context))).abandonedAt).toBe(unchangedDate)
})

it.each([['Started', 'startedAt'], ['Finished', 'finishedAt'], ['Abandoned', 'abandonedAt']])(
  'changes and clears the %s date without altering other fields', async (name, field) => {
    const context = await active()
    await svc()[`updateBook${name}At`](context, 123)
    expect((await observed(bookLibraryPath(context)))[field]).toBe(123)
    await svc()[`updateBook${name}At`](context, null)
    const stored = await observed(bookLibraryPath(context))
    expect(stored[field]).toBeUndefined()
    expect(stored.note).toBe('Keep note')
    expect(stored.rating).toBe(4)
    await svc()[`updateBook${name}At`](context, 456)
    await svc()[`updateBook${name}At`](context, undefined)
    expect((await observed(bookLibraryPath(context)))[field]).toBeUndefined()
  },
)

it('rejects historical setters locally while preserving scalar rating and multiple-record branches', async () => {
  const context = await active()
  await set(location(`${bookDataPath(context)}/bookNotes/n`), { text: 'Multiple note' })
  await set(location(`${bookDataPath(context)}/bookRatings/r`), { value: 5 })
  runTransaction.mockClear()
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  await expect(svc().updateBookNote(context, '<b>New note</b>')).rejects.toMatchObject({ code: 'generation-library/historical-source-readonly' })
  await expect(svc().updateBookReview(context, 'New review')).rejects.toMatchObject({ code: 'generation-library/historical-source-readonly' })
  expect(runTransaction).not.toHaveBeenCalled()
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
  await svc().updateBookRating(context, 2)
  expect(await observed(bookLibraryPath(context))).toMatchObject({ note: 'Keep note', review: 'Keep review', rating: 2 })
  expect(await observed(`${bookDataPath(context)}/bookNotes/n`)).toEqual({ text: 'Multiple note' })
  expect(await observed(`${bookDataPath(context)}/bookRatings/r`)).toEqual({ value: 5 })
})

it('merges simultaneous distinct-field edits without losing metadata or dates', async () => {
  const context = await active()
  await Promise.all([svc().updateBookFinishedAt(context, 1234), svc(1).updateBookStartedAt(context, 321)])
  expect(await observed(bookLibraryPath(context))).toMatchObject({ finishedAt: 1234, startedAt: 321, review: 'Keep review',
    title: 'Fictional book', authors: ['Author'], note: 'Keep note', addedAt: 1000 })
})

it('handles a cold SDK cache and an actual hash retry on the same reference', async () => {
  const context = await active(), seen = []
  runTransaction.mockImplementationOnce((reference, callback, options) => sdk.runTransaction(reference, current => {
    seen.push(current)
    return callback(current)
  }, options))
  await svc(1).updateBookFinishedAt(context, 9876)
  expect(seen[0]).toBeNull()
  expect(seen.length).toBeGreaterThanOrEqual(2)
  expect(await observed(bookLibraryPath(context))).toMatchObject({ finishedAt: 9876, note: 'Keep note', authors: ['Author'] })
})

it('supports explicit same-field compare-and-set conflicts', async () => {
  const context = await active()
  const results = await Promise.allSettled([
    svc().updateBookRating(context, 1, { expected: { rating: 4 } }),
    svc(1).updateBookRating(context, 2, { expected: { rating: 4 } }),
  ])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.find(result => result.status === 'rejected').reason.code).toBe('generation-library/field-conflict')
  expect([1, 2]).toContain((await observed(bookLibraryPath(context))).rating)
})

it('serializes a mutation with deletion lock; accepted data is then completely purged', async () => {
  const context = await active()
  const results = await Promise.allSettled([svc().updateBookRating(context, 2), life(1).lockDeletion(context)])
  expect(results[1].status).toBe('fulfilled')
  if (results[0].status === 'rejected') expect(results[0].reason).toBeInstanceOf(Error)
  expect((await observed(bookLifecyclePath(context))).state).toBe('deleting')
  await life().purgeGeneration(context)
  expect(await observed(bookDataPath(context))).toBeNull()
})

it('rejects a generation-1 write delivered after readd without touching generation 2', async () => {
  const old = await active()
  runTransaction.mockImplementationOnce(async (...args) => {
    await readd(old)
    return sdk.runTransaction(...args)
  })
  await expect(svc().updateBookStartedAt(old, 999)).rejects.toThrow()
  const next = ctx(2)
  expect(await observed(bookDataPath(old))).toBeNull()
  expect(await observed(bookLibraryPath(next))).toMatchObject({ title: 'New generation', note: 'Keep note' })
  await expect(svc().updateBookRating(old, 1)).rejects.toMatchObject({ code: 'generation-library/stale-generation' })
})

it('rejects a real offline queued transaction after delete/readd', async () => {
  const old = await active()
  runTransaction.mockImplementationOnce(async (...args) => {
    goOffline(clients[0].database)
    const pending = sdk.runTransaction(...args)
    const rejected = expect(pending).rejects.toThrow()
    await readd(old)
    goOnline(clients[0].database)
    await rejected
    return pending
  })
  await expect(svc().updateBookFinishedAt(old, 987)).rejects.toThrow()
  expect(await observed(bookDataPath(old))).toBeNull()
  expect(await observed(bookLibraryPath(ctx(2)))).toMatchObject({ finishedAt: 200, title: 'New generation' })
})

it('exposes a discarded successful write result and safely re-reads/repeats the same intent', async () => {
  const context = await active()
  runTransaction.mockClear()
  runTransaction.mockImplementationOnce(async (...args) => {
    await sdk.runTransaction(...args)
    throw Object.assign(new Error('Injected discarded result'), { code: 'test/ack-lost' })
  })
  await expect(svc().updateBookFinishedAt(context, 123)).rejects.toMatchObject({ code: 'test/ack-lost' })
  const before = (await svc().getActiveBook(context)).book
  expect(before.finishedAt).toBe(123)
  expect((await svc().updateBookFinishedAt(context, 123)).patch).toBeNull()
  expect(await observed(bookLibraryPath(context))).toEqual(before)
  expect(runTransaction).toHaveBeenCalledTimes(1)
})

it('delegates removal/resume to lifecycle and preserves another book', async () => {
  const context = await active(), retained = await active(ctx(1, uid, `${bookId}-retained`))
  await svc().deleteGeneration(context)
  await svc().resumeDeletion(context)
  expect(await observed(bookDataPath(context))).toBeNull()
  expect((await observed(bookLifecyclePath(context))).state).toBe('deleted')
  expect(await observed(bookLibraryPath(retained))).not.toBeNull()
})

it.each(['creating', 'deleting', 'deleted'])('refuses ordinary writes during %s in service and rules', async state => {
  const context = await creating()
  await svc().initializeLibrary(context, record(context))
  if (state !== 'creating') await life().lockDeletion(context)
  if (state === 'deleted') await life().purgeGeneration(context)
  await unchanged(async () => {
    await expect(svc().updateBookReview(context, 'Forbidden')).rejects.toThrow()
    await denied(update(location(bookLibraryPath(context)), { review: 'Forbidden' }))
  })
})

it.each([
  { id: 'other-book' }, { addedAt: 999 }, { status: 'unknown' }, { title: 'x'.repeat(201) },
  { authors: 'scalar' }, { authors: { named: 'Author' } }, { authors: [123] }, { categories: { '01': 'Fiction' } },
  { rating: 6 }, { rating: 2.5 }, { finishedAt: 'tomorrow' }, { startedAt: 1.5 },
  { updatedAt: -1 }, { note: '<script>bad()</script>' }, { review: { nested: true } }, { unknown: true },
])('rejects malformed/unknown fields directly in rules without partial writes: %#', async patch => {
  const context = await active()
  await unchanged(() => denied(update(location(bookLibraryPath(context)), patch)))
})

it('rejects ancestor writes, ordinary library deletion and lock-plus-edit atomically', async () => {
  const context = await active()
  await unchanged(async () => {
    await denied(remove(location(bookLibraryPath(context))))
    await denied(set(location(bookDataPath(context)), { library: record(context) }))
    await denied(update(ref(clients[0].database), {
      [bookLifecyclePath(context)]: { generation: 1, state: 'deleting' },
      [`${bookLibraryPath(context)}/review`]: 'Must not sneak through',
    }))
  })
  expect((await observed(bookLifecyclePath(context))).state).toBe('active')
})

it('isolates other owners and anonymous clients; preserves their same-ID book', async () => {
  const context = await active(), other = await active(ctx(1, otherUid), 2)
  for (const client of [2, 3]) {
    await expect(svc(client).updateBookRating(context, 1)).rejects.toThrow('owner-mismatch')
    await denied(update(location(bookLibraryPath(context), client), { rating: 1 }))
    await denied(get(location(bookLibraryPath(context), client)))
  }
  await svc().deleteGeneration(context)
  expect((await get(location(bookLibraryPath(other), 2))).val().rating).toBe(4)
})

it('fails visibly on read network failure without any SDK transaction', async () => {
  const context = await active()
  runTransaction.mockClear()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Injected local failure')))
  await expect(svc().updateBookRating(context, 1)).rejects.toThrow('network-error')
  expect(runTransaction).not.toHaveBeenCalled()
  expect((await observed(bookLibraryPath(context))).rating).toBe(4)
})


it.each([{ note: 'Keep note' }, { review: 'Keep review' }, { note: null }, { review: undefined },
  { startedAt: 987, note: 'Changed' }, { rating: 2, review: 'Changed' },
  { startedAt: 987, note: 'Changed', review: 'Changed' }])('rejects the entire historical patch locally %#', async patch => {
  const context = await active(), before = await observed(bookDataPath(context))
  runTransaction.mockClear()
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(svc().updateLibraryFields(context, patch)).rejects.toMatchObject({ code: 'generation-library/historical-source-readonly' })
    expect(runTransaction).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  } finally { fetchSpy.mockRestore() }
  expect(await observed(bookDataPath(context))).toEqual(before)
})

it('cannot bypass source immutability by reinitializing an active record', async () => {
  const context = await active(), before = await observed(bookDataPath(context))
  runTransaction.mockClear()
  await expect(svc().initializeLibrary(context, record(context, { note: 'Changed', review: 'Changed' })))
    .rejects.toMatchObject({ code: 'generation-library/not-active' })
  expect(runTransaction).not.toHaveBeenCalled()
  expect(await observed(bookDataPath(context))).toEqual(before)
})

it('sanitizes initial historical sources while creating, without modifying the input', async () => {
  const context = await creating(), input = record(context, { note: '<b>Safe</b><script>bad()</script>' })
  await svc().initializeLibrary(context, input)
  expect(input.note).toContain('<script>')
  // The existing Node fallback strips tags (browser DOMPurify retains safe tags).
  expect((await observed(bookLibraryPath(context))).note).toBe('Safebad()')
  await life().activateGeneration(context)
  expect((await svc().getActiveBook(context)).book.note).toBe('Safebad()')
})
