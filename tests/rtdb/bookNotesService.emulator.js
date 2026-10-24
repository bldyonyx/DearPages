// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

vi.mock('../../src/services/firebase.js', () => ({ database: clients[0].database }))
// Intercept only the moment between the service's preflight and its real SDK write.
vi.mock('firebase/database', async (original) => {
  const sdk = await original()
  return { ...sdk, set: vi.fn(sdk.set), update: vi.fn(sdk.update), remove: vi.fn(sdk.remove) }
})
const clients = []
let service, uid
let bookId = 'book'
const original = { id: 'book', title: 'Book', note: '<b>Legacy</b>', rating: 4, review: 'Review', updatedAt: 123 }
const input = { contentHtml: '<p><b>Bold</b><i>Italic</i><font size="4">Big</font><br></p>', date: '2024-02-29' }
const bookPath = () => `users/${uid}/library/${bookId}`
const notesPath = () => `users/${uid}/bookNotes/${bookId}`
const bookRef = (index = 1) => ref(clients[index].database, bookPath())
const noteRef = (id, index = 1) => ref(clients[index].database, `${notesPath()}/${id}`)
const readBook = async () => (await get(bookRef())).val()
const rawNote = () => ({ title: '', ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const denied = (promise) => expect(promise).rejects.toThrow(/permission[ _]denied/i)

beforeAll(async () => {
  expect(emulator.projectId).toBe('demo-dear-pages')
  await assertEmulatorProject()
  await assertEmulatorsReady()
  const email = `notes-${Date.now()}@example.test`
  for (let index = 0; index < 4; index++) {
    const app = initializeApp({ apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, projectId: emulator.projectId, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `notes-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, emulator.host, emulator.database)
    clients.push({ app, auth, database })
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, 'emulator-only-password')).user.uid
    if (index === 1) await signInWithEmailAndPassword(auth, email, 'emulator-only-password')
    if (index === 2) await createUserWithEmailAndPassword(auth, `intruder-${Date.now()}@example.test`, 'emulator-only-password')
    // Fourth client is deliberately unauthenticated.
  }
  service = await import('../../src/services/bookNotesService.js')
})

beforeEach(async () => {
  bookId = `book-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await set(bookRef(), original)
})

afterAll(async () => {
  // This suite uses ephemeral emulator data only; no ancestor deletion bypass.
  for (const client of clients) {
    goOffline(client.database)
    await deleteApp(client.app)
  }
})

describe('book notes CRUD and server rules', () => {
  it('creates independent notes, reads rich HTML and updates/deletes individually without touching the book', async () => {
    const first = await service.createBookNote(uid, bookId, input)
    const second = await service.createBookNote(uid, bookId, { ...input, title: 'Second', date: '0001-01-01' })
    expect(first).not.toBe(second)
    const stored = (await get(noteRef(first))).val()
    expect(stored).toEqual({ title: '', ...input, createdAt: expect.any(Number), updatedAt: expect.any(Number) })
    expect(stored.createdAt).toBe(stored.updatedAt)
    await service.updateBookNote(uid, bookId, first, { title: 'Changed', date: '2000-02-29' })
    expect((await get(noteRef(first))).val()).toMatchObject({ title: 'Changed', date: '2000-02-29', contentHtml: input.contentHtml, createdAt: stored.createdAt })
    expect((await service.getBookNotes(uid, bookId)).map((note) => note.id)).toEqual([first, second])
    expect(await service.getBookNote(uid, bookId, second)).toMatchObject({ id: second, title: 'Second' })
    await service.deleteBookNote(uid, bookId, first)
    expect(await service.getBookNote(uid, bookId, first)).toBeNull()
    expect((await get(noteRef(second))).exists()).toBe(true)
    expect(await readBook()).toEqual(original)
  })

  it('sanitizes hostile HTML before storage and permits every current formatting tag', async () => {
    const id = await service.createBookNote(uid, bookId, { ...input, contentHtml: '<div><strong>S</strong><em>E</em><font size="2">2</font><font size="3">3</font><font size="5">5</font><img src=x onerror=bad()><script>bad()</script></div>' })
    expect((await get(noteRef(id))).val().contentHtml).toBe('<div><strong>S</strong><em>E</em><font size="2">2</font><font size="3">3</font><font size="5">5</font></div>')
  })

  it.each([2, 3])('denies reads, creates, updates and deletes for client %s', async (index) => {
    const id = await service.createBookNote(uid, bookId, input)
    await denied(get(ref(clients[index].database, notesPath())))
    await denied(get(noteRef(id, index)))
    await denied(set(noteRef('intrusion', index), rawNote()))
    await denied(update(noteRef(id, index), { title: 'Intrusion', updatedAt: serverTimestamp() }))
    await denied(remove(noteRef(id, index)))
  })

  it('denies ancestor replacement, deletion and malformed multi-path writes', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    for (const path of [`users/${uid}`, `users/${uid}/bookNotes`, notesPath()]) {
      await denied(set(ref(clients[0].database, path), {}))
      await denied(remove(ref(clients[0].database, path)))
    }
    await denied(update(ref(clients[0].database, `users/${uid}`), {
      [`bookNotes/${bookId}/${id}/extra`]: true,
      [`bookNotes/${bookId}/${id}/updatedAt`]: serverTimestamp(),
    }))
    expect(await readBook()).toEqual(original)
    expect((await get(noteRef(id))).val()).toMatchObject(input)
  })

  it.each(['2025-02-29', '1900-02-29', '2100-02-29', '0000-01-01', '2024-04-31', '2024-13-01', '2024-01-00', '2024-1-01', '2024-01-01T00:00:00Z'])('rejects invalid civil dates from a bypassing client: %s', async (date) => {
    await denied(set(noteRef('bad-date'), { ...rawNote(), date }))
  })

  it.each(['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31'])('accepts valid civil dates: %s', async (date) => {
    await set(noteRef('valid-date'), { ...rawNote(), date })
    expect((await get(noteRef('valid-date'))).val().date).toBe(date)
  })

  it.each(['<script>alert(1)</script>', '<p onclick="bad()">X</p>', '<img src=x>', '<font size="6">X</font>', '<p style="color:red">X</p>', '<svg></svg>', '<a href="javascript:bad()">X</a>'])('rejects unsafe or unsupported raw HTML: %s', async (contentHtml) => {
    await denied(set(noteRef('unsafe'), { ...rawNote(), contentHtml }))
  })

  it('rejects unknown/missing fields, wrong types, invalid IDs, oversized values and forged timestamps', async () => {
    for (const patch of [
      { title: null }, { title: 12 }, { title: '<b>Title</b>' }, { title: 'x'.repeat(201) },
      { contentHtml: null }, { contentHtml: 12 }, { contentHtml: 'x'.repeat(200001) },
      { date: null }, { extra: true }, { createdAt: 1 }, { updatedAt: 1 },
    ]) await denied(set(noteRef('invalid'), { ...rawNote(), ...patch }))
    for (const id of ['space id', 'x'.repeat(129)]) await denied(set(noteRef(id), rawNote()))
    const id = await service.createBookNote(uid, bookId, input)
    await denied(update(noteRef(id, 0), { createdAt: 0, updatedAt: serverTimestamp() }))
    await denied(update(noteRef(id, 0), { contentHtml: null, updatedAt: serverTimestamp() }))
    expect(await readBook()).toEqual(original)
  })

  it('merges concurrent patches on one note and keeps different notes independent', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    const second = await service.createBookNote(uid, bookId, input)
    await Promise.all([
      service.updateBookNote(uid, bookId, id, { title: 'Title' }),
      update(noteRef(id), { contentHtml: '<b>Other client</b>', updatedAt: serverTimestamp() }),
      service.updateBookNote(uid, bookId, second, { date: '2025-10-01' }),
    ])
    expect((await get(noteRef(id))).val()).toMatchObject({ title: 'Title', contentHtml: '<b>Other client</b>' })
    expect((await get(noteRef(second))).val()).toMatchObject({ ...input, date: '2025-10-01' })
    expect(await readBook()).toEqual(original)
  })

  it('accepts more than one hundred notes without a count ceiling', async () => {
    const ids = await Promise.all(Array.from({ length: 105 }, () => service.createBookNote(uid, bookId, input)))
    expect(new Set(ids).size).toBe(105)
    expect(await service.getBookNotes(uid, bookId)).toHaveLength(105)
    expect(await readBook()).toEqual(original)
  })

  it('rejects control characters and requires a fresh timestamp even for a child-field write', async () => {
    for (const patch of [{ title: 'A\u0001B' }, { contentHtml: 'A\u0001B' }, { contentHtml: 'A\u007fB' }]) {
      await denied(set(noteRef('controls'), { ...rawNote(), ...patch }))
    }
    const id = await service.createBookNote(uid, bookId, input)
    await denied(update(noteRef(id, 0), { title: 'No timestamp', updatedAt: 1 }))
    // Move beyond the creation millisecond so retaining its timestamp cannot pass.
    await new Promise((resolve) => setTimeout(resolve, 10))
    await denied(set(ref(clients[0].database, `${notesPath()}/${id}/title`), 'No timestamp'))
  })

  it.each(['create', 'update', 'delete'])('rejects %s when another client deletes the book after preflight', async (operation) => {
    const id = await service.createBookNote(uid, bookId, input)
    const sdk = await vi.importActual('firebase/database')
    const write = operation === 'create' ? set : operation === 'update' ? update : remove
    write.mockImplementationOnce(async (...args) => {
      await sdk.remove(bookRef())
      return sdk[operation === 'create' ? 'set' : operation === 'update' ? 'update' : 'remove'](...args)
    })
    await denied(operation === 'create' ? service.createBookNote(uid, bookId, input)
      : operation === 'update' ? service.updateBookNote(uid, bookId, id, { title: 'Late' })
        : service.deleteBookNote(uid, bookId, id))
    expect(await readBook()).toBeNull()
    // Restore solely to inspect preserved orphan data; no production migration.
    await set(bookRef(), original)
    expect((await get(noteRef(id))).val()).toMatchObject({ title: '', ...input })
    expect((await service.getBookNotes(uid, bookId))).toHaveLength(1)
  })

  it('rejects a queued offline write after a remote book deletion', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    await get(noteRef(id, 0))
    goOffline(clients[0].database)
    const pending = update(noteRef(id, 0), { title: 'Queued', updatedAt: serverTimestamp() })
    const rejection = denied(pending)
    await remove(bookRef())
    goOnline(clients[0].database)
    await rejection
    expect(await readBook()).toBeNull()
    await set(bookRef(), original)
    expect((await get(noteRef(id))).val().title).toBe('')
  })

  it('rejects an atomic book deletion plus note mutation, or book creation plus note creation', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    const user = ref(clients[0].database, `users/${uid}`)
    await denied(update(user, { [`library/${bookId}`]: null, [`bookNotes/${bookId}/${id}/title`]: 'Late', [`bookNotes/${bookId}/${id}/updatedAt`]: serverTimestamp() }))
    expect(await readBook()).toEqual(original)
    await denied(update(user, { 'library/new-book': original, 'bookNotes/new-book/new-note': rawNote() }))
  })

  it('cannot recreate a note deleted after preflight', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      await sdk.remove(noteRef(id))
      return sdk.update(...args)
    })
    await denied(service.updateBookNote(uid, bookId, id, { title: 'Late', ...input }))
    expect((await get(noteRef(id))).exists()).toBe(false)
  })

  it('denies all operations for a missing book while preserving historical and new notes', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    await remove(bookRef())
    for (const operation of [
      () => service.getBookNotes(uid, bookId), () => service.getBookNote(uid, bookId, id),
      () => service.createBookNote(uid, bookId, input),
      () => service.updateBookNote(uid, bookId, id, { title: 'Late' }),
      () => service.deleteBookNote(uid, bookId, id),
    ]) await expect(operation()).rejects.toMatchObject({ code: 'book-notes/book-not-found' })
    await denied(set(noteRef('new'), rawNote()))
    await denied(update(noteRef(id, 0), { title: 'Late', updatedAt: serverTimestamp() }))
    await denied(remove(noteRef(id, 0)))
    await denied(get(noteRef(id, 0)))
  })
})
