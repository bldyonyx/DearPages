// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

vi.mock('../../src/services/firebase.js', () => ({ database: clients[0].database, isFirebaseEmulator: true }))
// Intercept only the moment between the service's preflight and its real SDK write.
vi.mock('firebase/database', async (original) => {
  const sdk = await original()
  return { ...sdk, set: vi.fn(sdk.set), update: vi.fn(sdk.update), remove: vi.fn(sdk.remove) }
})
const clients = []
let service, uid
let bookId = 'book'
const original = { id: 'book', title: 'Book', note: '<b>Legacy</b>', rating: 4, review: 'Review', updatedAt: 123, status: 'reading', addedAt: 99, metadata: { untouched: true } }
const input = { contentHtml: '<p><b>Bold</b><i>Italic</i><font size="4">Big</font><br></p>', date: '2024-02-29' }
const bookPath = () => `users/${uid}/library/${bookId}`
const notesPath = () => `users/${uid}/bookNotes/${bookId}`
const bookRef = (index = 1) => ref(clients[index].database, bookPath())
const noteRef = (id, index = 1) => ref(clients[index].database, `${notesPath()}/${id}`)
const readBook = async () => (await get(bookRef())).val()
const rawNote = () => ({ title: '', ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const legacyRef = (index = 1) => ref(clients[index].database, `users/${uid}/bookNotesLegacy/${bookId}`)
const readMarker = async () => (await get(legacyRef())).val()
const reviewMarkerRef = (index = 1) => ref(clients[index].database, `users/${uid}/bookReviewsLegacy/${bookId}`)
const readReviewMarker = async () => (await get(reviewMarkerRef())).val()
const denied = (promise) => expect(promise).rejects.toThrow(/permission[ _]denied/i)

beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto)
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
    expect(stored).toEqual({ title: '', ...input, isPinned: false, createdAt: expect.any(Number), updatedAt: expect.any(Number) })
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

describe('atomic emulator-only legacy conversion', () => {
  it('reads a safe historical fallback without migration, then suppresses it permanently after deletion', async () => {
    const before = await service.getBookNotesForDisplay(uid, bookId)
    expect(before).toEqual({ notes: [], legacy: { status: 'unprocessed', contentHtml: original.note, sourceVersion: expect.any(String) }, legacyReview: { status: 'unprocessed', contentHtml: original.review, sourceVersion: expect.any(String) } })
    expect(await readMarker()).toBeNull()
    await service.migrateLegacyBookNote(uid, bookId)
    const copied = await service.getBookNotesForDisplay(uid, bookId)
    expect(copied.legacy).toEqual({ status: 'processed' })
    expect(copied.notes).toHaveLength(1)
    await service.deleteBookNote(uid, bookId, 'legacy-note-v1')
    expect(await service.getBookNotesForDisplay(uid, bookId)).toEqual({ notes: [], legacy: { status: 'processed' }, legacyReview: { status: 'unprocessed', contentHtml: original.review, sourceVersion: expect.any(String) } })
    expect(await readBook()).toEqual(original)
  })

  it('preserves a pre-contract collision at the reserved ID and refuses conversion', async () => {
    // Seed an otherwise unreachable historical fixture through the LOCAL emulator
    // admin interface, only after beforeAll verifies the demo project and Hub.
    const existing = { ...input, title: 'Pre-existing', createdAt: 100, updatedAt: 100 }
    const response = await fetch(`http://${emulator.host}:${emulator.database}/${notesPath()}/legacy-note-v1.json?ns=${emulator.projectId}`, {
      method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(existing),
    })
    expect(response.ok).toBe(true)
    await expect(service.migrateLegacyBookNote(uid, bookId)).rejects.toMatchObject({ code: 'book-notes/legacy-conflict' })
    expect((await get(noteRef('legacy-note-v1'))).val()).toEqual(existing)
    expect(await readMarker()).toBeNull()
    expect(await readBook()).toEqual(original)
  })

  it('copies allowed HTML, uses migration timestamps and preserves the complete book and other notes', async () => {
    const other = await service.createBookNote(uid, bookId, input)
    const before = (await get(noteRef(other))).val()
    await update(bookRef(), { note: '<p><b>Old</b><font size="4">Large</font><img src=x><script>bad()</script></p>' })
    const book = await readBook()
    const marker = await service.migrateLegacyBookNote(uid, bookId)
    const legacy = (await get(noteRef('legacy-note-v1'))).val()
    expect(marker).toEqual({ version: 1, outcome: 'copied', sourceHtml: book.note, processedAt: expect.any(Number) })
    expect(legacy).toMatchObject({ title: '', contentHtml: '<p><b>Old</b><font size="4">Large</font></p>', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), createdAt: marker.processedAt, updatedAt: marker.processedAt })
    expect(legacy.createdAt).not.toBe(book.updatedAt)
    expect((await get(noteRef(other))).val()).toEqual(before)
    expect(await readBook()).toEqual(book)
    expect(await service.migrateLegacyBookNote(uid, bookId)).toEqual(marker)
    expect(await service.getBookNotes(uid, bookId)).toHaveLength(2)
  })

  it.each([null, ''])('marks an empty source once and never imports a later source: %j', async (note) => {
    await update(bookRef(), { note })
    const marker = await service.migrateLegacyBookNote(uid, bookId)
    expect(marker).toMatchObject({ version: 1, outcome: 'empty', sourceHtml: '' })
    expect(await service.getBookNotes(uid, bookId)).toEqual([])
    await update(bookRef(), { note: 'Later historical edit' })
    expect(await service.migrateLegacyBookNote(uid, bookId)).toEqual(marker)
    expect(await service.getBookNotes(uid, bookId)).toEqual([])
  })

  it('serializes competing conversions and refuses a delayed contender after edit or deletion', async () => {
    const sdk = await vi.importActual('firebase/database')
    const attempts = []
    const compete = async (...args) => {
      attempts.push(args)
      // A separate authenticated SDK wins after this conversion's preflight.
      await sdk.update(ref(clients[1].database, `users/${uid}`), args[1])
      return sdk.update(...args)
    }
    update.mockImplementationOnce(compete)
    const results = await Promise.all([service.migrateLegacyBookNote(uid, bookId), service.migrateLegacyBookNote(uid, bookId)])
    expect(results[0]).toEqual(results[1])
    expect(await service.getBookNotes(uid, bookId)).toHaveLength(1)
    await service.updateBookNote(uid, bookId, 'legacy-note-v1', { contentHtml: '<i>Edited</i>' })
    await service.migrateLegacyBookNote(uid, bookId)
    expect((await get(noteRef('legacy-note-v1'))).val().contentHtml).toBe('<i>Edited</i>')
    await denied(sdk.update(ref(clients[1].database, `users/${uid}`), attempts[0][1]))
    await service.deleteBookNote(uid, bookId, 'legacy-note-v1')
    expect(await service.migrateLegacyBookNote(uid, bookId)).toEqual(results[0])
    await denied(sdk.update(ref(clients[1].database, `users/${uid}`), attempts[0][1]))
    await denied(set(noteRef('legacy-note-v1'), rawNote()))
    expect(await service.getBookNotes(uid, bookId)).toEqual([])
    expect(await readMarker()).toEqual(results[0])
    expect(await readBook()).toEqual(original)
  })

  it('rejects a stale source without marking it and safely retries the latest source', async () => {
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      await sdk.update(bookRef(), { note: '<i>New source</i>' })
      return sdk.update(...args)
    })
    await denied(service.migrateLegacyBookNote(uid, bookId))
    expect(await readMarker()).toBeNull()
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookNote(uid, bookId)
    expect((await get(noteRef('legacy-note-v1'))).val().contentHtml).toBe('<i>New source</i>')
    expect(await readBook()).toEqual({ ...original, note: '<i>New source</i>' })
  })

  it('retries safely before commit and after a lost acknowledgement', async () => {
    update.mockRejectedValueOnce(new Error('network interrupted before commit'))
    await expect(service.migrateLegacyBookNote(uid, bookId)).rejects.toThrow('network interrupted')
    expect(await readMarker()).toBeNull()
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      await sdk.update(...args)
      throw new Error('network interrupted after commit')
    })
    await expect(service.migrateLegacyBookNote(uid, bookId)).rejects.toThrow('network interrupted')
    const committed = (await get(noteRef('legacy-note-v1'))).val()
    await service.deleteBookNote(uid, bookId, 'legacy-note-v1')
    await service.migrateLegacyBookNote(uid, bookId)
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    expect((await readMarker()).processedAt).toBe(committed.createdAt)
    expect(await readBook()).toEqual(original)
  })

  it('rejects an offline conversion after book deletion, without partial data', async () => {
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      goOffline(clients[0].database)
      const pending = sdk.update(...args)
      // Attach rejection before reconnecting.
      const settled = pending.then(() => null, (error) => error)
      await sdk.remove(bookRef())
      goOnline(clients[0].database)
      const error = await settled
      if (error) throw error
    })
    await denied(service.migrateLegacyBookNote(uid, bookId))
    await set(bookRef(), original)
    expect(await readMarker()).toBeNull()
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookNote(uid, bookId)
    expect(await service.getBookNotes(uid, bookId)).toHaveLength(1)
  })

  it('enforces owner access, immutable marker, reserved ID and atomic schema validation', async () => {
    const user = ref(clients[1].database, `users/${uid}`)
    const marker = { version: 1, outcome: 'copied', sourceHtml: original.note, processedAt: serverTimestamp() }
    const writes = { [`bookNotesLegacy/${bookId}`]: marker, [`bookNotes/${bookId}/legacy-note-v1`]: rawNote() }
    for (const index of [2, 3]) {
      await denied(get(legacyRef(index)))
      await denied(update(ref(clients[index].database, `users/${uid}`), writes))
    }
    await denied(set(noteRef('legacy-note-v1'), rawNote()))
    await denied(set(legacyRef(), marker))
    for (const patch of [{ version: 2 }, { outcome: 'empty' }, { sourceHtml: 'stale' }, { processedAt: 1 }, { extra: true }, { sourceHtml: null }]) {
      await denied(update(user, { ...writes, [`bookNotesLegacy/${bookId}`]: { ...marker, ...patch } }))
    }
    await denied(update(user, { ...writes, [`bookNotes/${bookId}/legacy-note-v1`]: { ...rawNote(), extra: true } }))
    expect(await readMarker()).toBeNull()
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookNote(uid, bookId)
    for (const index of [1, 2, 3]) {
      await denied(remove(legacyRef(index)))
      await denied(update(legacyRef(index), { outcome: 'empty' }))
    }
    for (const path of [`users/${uid}`, `users/${uid}/bookNotesLegacy`]) {
      await denied(remove(ref(clients[1].database, path)))
      await denied(set(ref(clients[1].database, path), {}))
    }
    expect(await readBook()).toEqual(original)
  })

  it('never processes invalid historical content or a source over the storage limit', async () => {
    for (const note of [42, 'A\u0001B', 'x'.repeat(200001)]) {
      await update(bookRef(), { note })
      await expect(service.migrateLegacyBookNote(uid, bookId)).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
      expect(await readMarker()).toBeNull()
      expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
      expect(await readBook()).toEqual({ ...original, note })
    }
  })
})

describe('independent historical review conversion', () => {
  it('converts note and review concurrently with independent markers and preserves ordinary notes and the complete book', async () => {
    const other = await service.createBookNote(uid, bookId, input)
    const otherBefore = (await get(noteRef(other))).val()
    await update(bookRef(), { review: '<p><b>Review</b><i>I</i><font size="5">Large</font><img src=x><script>bad()</script></p>' })
    const before = await readBook()
    const display = await service.getBookNotesForDisplay(uid, bookId)
    await Promise.all([
      service.migrateLegacyBookNote(uid, bookId, { expectedVersion: display.legacy.sourceVersion }),
      service.migrateLegacyBookReview(uid, bookId, { expectedVersion: display.legacyReview.sourceVersion, title: 'My review of the book' }),
    ])
    const review = (await get(noteRef('legacy-review-v1'))).val()
    expect(review).toMatchObject({ title: 'My review of the book', contentHtml: '<p><b>Review</b><i>I</i><font size="5">Large</font></p>', createdAt: expect.any(Number), updatedAt: expect.any(Number), date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    expect(review.createdAt).toBe((await readReviewMarker()).processedAt)
    expect(review.createdAt).not.toBe(before.updatedAt)
    expect((await get(noteRef(other))).val()).toEqual(otherBefore)
    expect(await readBook()).toEqual(before)
    const after = await service.getBookNotesForDisplay(uid, bookId)
    expect(after.notes).toHaveLength(3)
    expect(after.legacy).toEqual({ status: 'processed' })
    expect(after.legacyReview).toEqual({ status: 'processed' })
    expect(await readMarker()).toMatchObject({ sourceHtml: before.note, version: 1 })
    expect(await readReviewMarker()).toMatchObject({ sourceHtml: before.review, version: 1 })
  })

  it('handles competing clients, repeat conversions, edits and deletion without overwriting or resurrection', async () => {
    const sdk = await vi.importActual('firebase/database')
    let writes
    update.mockImplementationOnce(async (...args) => {
      writes = args[1]
      await sdk.update(ref(clients[1].database, `users/${uid}`), writes)
      return sdk.update(...args)
    })
    const markers = await Promise.all([service.migrateLegacyBookReview(uid, bookId), service.migrateLegacyBookReview(uid, bookId)])
    expect(markers[0]).toEqual(markers[1])
    expect(await readMarker()).toBeNull()
    const created = (await get(noteRef('legacy-review-v1'))).val()
    expect(created.title).toBe('Mon avis sur le livre')
    await service.updateBookNote(uid, bookId, 'legacy-review-v1', { title: 'Renamed', contentHtml: '<i>Changed</i>', date: '1900-01-01' })
    await service.migrateLegacyBookReview(uid, bookId)
    expect((await get(noteRef('legacy-review-v1'))).val()).toMatchObject({ title: 'Renamed', contentHtml: '<i>Changed</i>', date: '1900-01-01', createdAt: created.createdAt })
    await denied(sdk.update(ref(clients[1].database, `users/${uid}`), writes))
    await service.deleteBookNote(uid, bookId, 'legacy-review-v1')
    expect(await service.migrateLegacyBookReview(uid, bookId)).toEqual(markers[0])
    await denied(sdk.update(ref(clients[1].database, `users/${uid}`), writes))
    await denied(set(noteRef('legacy-review-v1'), rawNote()))
    expect((await service.getBookNotesForDisplay(uid, bookId)).legacyReview).toEqual({ status: 'processed' })
    expect(await service.getBookNotes(uid, bookId)).toHaveLength(0)
    expect(await readReviewMarker()).toEqual(markers[0])
    expect(await readBook()).toEqual(original)
  })

  it.each([null, ''])('marks an absent/empty review without affecting the note contract: %j', async (review) => {
    await update(bookRef(), { review })
    await service.migrateLegacyBookReview(uid, bookId)
    const marker = await readReviewMarker()
    expect(marker).toMatchObject({ outcome: 'empty', version: 1, sourceHtml: '' })
    expect(await readMarker()).toBeNull()
    await update(bookRef(), { review: 'A later review' })
    expect(await service.migrateLegacyBookReview(uid, bookId)).toEqual(marker)
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookNote(uid, bookId)
    expect((await get(noteRef('legacy-note-v1'))).val().contentHtml).toBe(original.note)
  })

  it('rejects a source changed since display and succeeds only after an explicit refresh', async () => {
    const display = await service.getBookNotesForDisplay(uid, bookId)
    await update(bookRef(), { review: '<i>New review</i>' })
    await expect(service.migrateLegacyBookReview(uid, bookId, { expectedVersion: display.legacyReview.sourceVersion })).rejects.toMatchObject({ code: 'book-notes/legacy-source-changed' })
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    const refreshed = await service.getBookNotesForDisplay(uid, bookId)
    await service.migrateLegacyBookReview(uid, bookId, { expectedVersion: refreshed.legacyReview.sourceVersion })
    expect((await get(noteRef('legacy-review-v1'))).val().contentHtml).toBe('<i>New review</i>')
    expect(await readBook()).toEqual({ ...original, review: '<i>New review</i>' })
  })

  it('atomically rejects source changes between preflight and commit', async () => {
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      await sdk.update(bookRef(), { review: '<b>Concurrent source</b>' })
      return sdk.update(...args)
    })
    await expect(service.migrateLegacyBookReview(uid, bookId)).rejects.toMatchObject({ code: 'book-notes/legacy-conflict' })
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookReview(uid, bookId)
    expect((await get(noteRef('legacy-review-v1'))).val().contentHtml).toBe('<b>Concurrent source</b>')
  })

  it('preserves a pre-contract review ID collision and reports it without a marker', async () => {
    const existing = { ...input, title: 'Occupied', createdAt: 100, updatedAt: 100 }
    const response = await fetch(`http://${emulator.host}:${emulator.database}/${notesPath()}/legacy-review-v1.json?ns=${emulator.projectId}`, {
      method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(existing),
    })
    expect(response.ok).toBe(true)
    expect((await service.getBookNotesForDisplay(uid, bookId)).legacyReview).toEqual({ status: 'conflict' })
    await expect(service.migrateLegacyBookReview(uid, bookId)).rejects.toMatchObject({ code: 'book-notes/legacy-conflict' })
    expect((await get(noteRef('legacy-review-v1'))).val()).toEqual(existing)
    expect(await readReviewMarker()).toBeNull()
    expect(await readBook()).toEqual(original)
  })

  it('recovers before commit and after a lost acknowledgement, including a deletion before retry', async () => {
    update.mockRejectedValueOnce(new Error('network interruption before commit'))
    await expect(service.migrateLegacyBookReview(uid, bookId)).rejects.toThrow('network interruption')
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => { await sdk.update(...args); throw new Error('lost acknowledgement') })
    await expect(service.migrateLegacyBookReview(uid, bookId)).rejects.toThrow('lost acknowledgement')
    const committed = await readReviewMarker()
    await sdk.remove(noteRef('legacy-review-v1'))
    await service.migrateLegacyBookReview(uid, bookId)
    expect(await readReviewMarker()).toEqual(committed)
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    expect(await readBook()).toEqual(original)
  })

  it('rejects an offline conversion if the book was removed before server commit', async () => {
    const sdk = await vi.importActual('firebase/database')
    update.mockImplementationOnce(async (...args) => {
      goOffline(clients[0].database)
      const result = sdk.update(...args).then(() => null, (error) => error)
      await sdk.remove(bookRef())
      goOnline(clients[0].database)
      const error = await result
      if (error) throw error
    })
    await denied(service.migrateLegacyBookReview(uid, bookId))
    await set(bookRef(), original)
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookReview(uid, bookId)
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(true)
  })

  it('enforces schema, owner isolation, atomic creation, immutable markers and ancestor protection', async () => {
    const user = ref(clients[1].database, `users/${uid}`)
    const marker = { version: 1, outcome: 'copied', sourceHtml: original.review, processedAt: serverTimestamp() }
    const writes = { [`bookReviewsLegacy/${bookId}`]: marker, [`bookNotes/${bookId}/legacy-review-v1`]: rawNote() }
    for (const index of [2, 3]) {
      await denied(get(reviewMarkerRef(index)))
      await denied(update(ref(clients[index].database, `users/${uid}`), writes))
    }
    await denied(set(reviewMarkerRef(), marker))
    await denied(set(noteRef('legacy-review-v1'), rawNote()))
    for (const patch of [{ version: 2 }, { outcome: 'empty' }, { sourceHtml: original.note }, { processedAt: 1 }, { extra: true }, { sourceHtml: null }]) {
      await denied(update(user, { ...writes, [`bookReviewsLegacy/${bookId}`]: { ...marker, ...patch } }))
    }
    for (const patch of [{ extra: true }, { contentHtml: '<script>bad()</script>' }, { date: '1900-02-29' }, { title: null }]) {
      await denied(update(user, { ...writes, [`bookNotes/${bookId}/legacy-review-v1`]: { ...rawNote(), ...patch } }))
    }
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    await service.migrateLegacyBookReview(uid, bookId)
    for (const index of [1, 2, 3]) {
      await denied(remove(reviewMarkerRef(index)))
      await denied(update(reviewMarkerRef(index), { outcome: 'empty' }))
    }
    for (const path of [`users/${uid}`, `users/${uid}/bookReviewsLegacy`]) {
      await denied(remove(ref(clients[1].database, path)))
      await denied(set(ref(clients[1].database, path), {}))
    }
    await remove(bookRef())
    await denied(get(reviewMarkerRef()))
    await set(bookRef(), original)
    expect((await readReviewMarker()).outcome).toBe('copied')
    expect(await readBook()).toEqual(original)
  })

  it.each([42, 'A\u0001B', 'x'.repeat(200001)])('keeps invalid historical reviews untouched: %#', async (review) => {
    await update(bookRef(), { review })
    expect((await service.getBookNotesForDisplay(uid, bookId)).legacyReview).toEqual({ status: 'invalid' })
    await expect(service.migrateLegacyBookReview(uid, bookId)).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
    expect(await readReviewMarker()).toBeNull()
    expect((await get(noteRef('legacy-review-v1'))).exists()).toBe(false)
    expect(await readBook()).toEqual({ ...original, review })
  })

  it('converts a review when the old note was already converted, edited and deleted, without reviving that note', async () => {
    await service.migrateLegacyBookNote(uid, bookId)
    const originalMarker = await readMarker()
    await service.updateBookNote(uid, bookId, 'legacy-note-v1', { contentHtml: '<b>Edited note</b>' })
    await service.deleteBookNote(uid, bookId, 'legacy-note-v1')
    await service.migrateLegacyBookReview(uid, bookId)
    expect(await readMarker()).toEqual(originalMarker)
    expect((await get(noteRef('legacy-note-v1'))).exists()).toBe(false)
    expect((await get(noteRef('legacy-review-v1'))).val().contentHtml).toBe(original.review)
    expect(await readBook()).toEqual(original)
  })
})

 describe('note pins', () => {
  it('pins independently, preserves timestamps, merges concurrent edits and sorts', async () => {
    const a = await service.createBookNote(uid, bookId, input)
    const b = await service.createBookNote(uid, bookId, { ...input, date: '2025-01-01' })
    const before = (await get(noteRef(a))).val()
    await service.updateBookNotePinned(uid, bookId, a, true)
    expect(update).toHaveBeenLastCalledWith(expect.anything(), { isPinned: true })
    expect((await get(noteRef(a))).val()).toEqual({ ...before, isPinned: true })
    await Promise.all([service.updateBookNotePinned(uid, bookId, b, true), service.updateBookNote(uid, bookId, b, { title: 'Concurrent' })])
    expect((await service.getBookNotes(uid, bookId)).map(n => n.id)).toEqual([b, a])
    expect((await get(noteRef(b))).val()).toMatchObject({ title: 'Concurrent', isPinned: true })
    await service.updateBookNotePinned(uid, bookId, b, false)
    expect((await service.getBookNotes(uid, bookId)).map(n => n.id)).toEqual([a, b])
    await denied(update(noteRef(a, 2), { isPinned: false }))
    await denied(update(noteRef(a), { isPinned: 'true' }))
    await denied(update(noteRef(a), { isPinned: false, title: 'No fresh timestamp', updatedAt: before.updatedAt }))
    await service.deleteBookNote(uid, bookId, a)
    await expect(service.updateBookNotePinned(uid, bookId, a, true)).rejects.toMatchObject({ code: 'book-notes/note-not-found' })
    await denied(update(noteRef(a), { isPinned: true }))
    expect(await readBook()).toEqual(original)
  })
  it('supports old records and both converted origins, without resurrecting deleted copies', async () => {
    await set(noteRef('old'), rawNote())
    expect(await service.getBookNote(uid, bookId, 'old')).toMatchObject({ isPinned: false })
    await service.updateBookNotePinned(uid, bookId, 'old', true)
    await service.migrateLegacyBookNote(uid, bookId)
    await service.migrateLegacyBookReview(uid, bookId)
    for (const id of ['legacy-note-v1', 'legacy-review-v1']) {
      await service.updateBookNotePinned(uid, bookId, id, true)
      await service.updateBookNote(uid, bookId, id, { title: 'Edited pinned copy' })
      expect(await service.getBookNote(uid, bookId, id)).toMatchObject({ isPinned: true })
      await service.deleteBookNote(uid, bookId, id)
      await denied(update(noteRef(id), { isPinned: true }))
    }
    expect(await readBook()).toEqual(original)
  })
  it('rejects a pin deleted after preflight', async () => {
    const id = await service.createBookNote(uid, bookId, input)
    update.mockImplementationOnce(async (location, patch) => {
      await remove(noteRef(id))
      const sdk = await vi.importActual('firebase/database')
      return sdk.update(location, patch)
    })
    await denied(service.updateBookNotePinned(uid, bookId, id, true))
    expect((await get(noteRef(id))).exists()).toBe(false)
  })
})
