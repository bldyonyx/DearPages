import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, get, goOffline, goOnline } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

// Replace only application configuration. The service uses the real RTDB SDK.
vi.mock('../../src/services/firebase.js', () => ({ database: clients[0].database }))
const clients = []
let service
let uid
const email = `library-${Date.now()}@example.test`
const password = 'emulator-only-password'
const original = { id: 'book-1', title: 'Original', authors: ['Author'], status: 'finished', addedAt: 1, finishedAt: 2, note: 'Note', review: 'Review', rating: 4, metadata: { preserved: true } }
const path = () => `users/${uid}/library/book-1`
const read = async () => (await get(ref(clients[1].database, path()))).val()
const seed = async () => {
  await set(ref(clients[1].database, path()), original)
  await get(ref(clients[0].database, path()))
}

beforeAll(async () => {
  // Fail before initializing any SDK unless the fixed local demo services exist.
  expect(emulator.projectId).toBe('demo-dear-pages')
  await assertEmulatorProject()
  await assertEmulatorsReady()
  for (let index = 0; index < 2; index++) {
    const app = initializeApp({ apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, projectId: 'demo-dear-pages', databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `library-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, emulator.host, emulator.database)
    clients.push({ app, auth, database })
    const credentials = index === 0
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password)
    uid = credentials.user.uid
  }
  service = await import('../../src/services/libraryService.js')
})

afterAll(async () => {
  for (const client of clients) {
    goOnline(client.database)
  }
  if (clients[1] && uid) await set(ref(clients[1].database, `users/${uid}`), null)
  for (const client of clients) {
    goOffline(client.database)
    await deleteApp(client.app)
  }
})

describe('real RTDB library transactions with owner rules', () => {
  it('handles a cold cache and repeated adds without losing existing data', async () => {
    await set(ref(clients[1].database, path()), original)
    await service.updateBookReview(uid, 'book-1', 'Cold-cache review')
    await service.addBookToLibrary(uid, { id: 'book-1', title: 'Replacement', authors: [] }, 'to-read')
    expect(await read()).toEqual({ ...original, review: 'Cold-cache review', updatedAt: expect.any(Number) })
  })

  it('creates a complete book when concurrent adds compete', async () => {
    await set(ref(clients[1].database, path()), null)
    await Promise.all([
      service.addBookToLibrary(uid, { id: 'book-1', title: 'First', authors: ['A'] }, 'reading'),
      service.addBookToLibrary(uid, { id: 'book-1', title: 'Second', authors: ['B'] }, 'finished'),
    ])
    const stored = await read()
    expect(stored.id).toBe('book-1')
    expect(stored.addedAt).toEqual(expect.any(Number))
    expect(['First', 'Second']).toContain(stored.title)
    expect(stored.status).toBe(stored.title === 'First' ? 'reading' : 'finished')
  })

  it('preserves the other client entry if it wins an add race', async () => {
    await set(ref(clients[0].database, path()), null)
    goOffline(clients[0].database)
    const pending = service.addBookToLibrary(uid, { id: 'book-1', title: 'Replacement', authors: [] }, 'to-read')
    await set(ref(clients[1].database, path()), original)
    goOnline(clients[0].database)
    await pending
    expect(await read()).toEqual(original)
  })

  it('retries against another client without overwriting its personal data', async () => {
    await seed()
    goOffline(clients[0].database)
    const pending = service.updateBookReview(uid, 'book-1', 'New review')
    await set(ref(clients[1].database, path()), { ...original, note: 'Other client note', rating: 2, metadata: { concurrent: true } })
    goOnline(clients[0].database)
    await pending
    expect(await read()).toMatchObject({ note: 'Other client note', review: 'New review', rating: 2, metadata: { concurrent: true } })
  })

  it('merges concurrent saves to distinct fields', async () => {
    await seed()
    await Promise.all([
      service.updateBookNote(uid, 'book-1', 'New note'),
      service.updateBookReview(uid, 'book-1', 'New review'),
      service.updateBookRating(uid, 'book-1', 5),
    ])
    expect(await read()).toMatchObject({ ...original, note: 'New note', review: 'New review', rating: 5 })
  })

  it.each(['updateBookNote', 'updateBookReview', 'updateBookRating'])('%s cannot resurrect a deleted book, including a stale queued transaction', async (name) => {
    await seed()
    goOffline(clients[0].database)
    const pending = service[name](uid, 'book-1', name === 'updateBookRating' ? 3 : 'Late draft')
    const rejection = expect(pending).rejects.toMatchObject({ code: 'library/book-not-found' })
    await serviceDeleteFromOtherClient()
    goOnline(clients[0].database)
    await rejection
    expect(await read()).toBeNull()
    await expect(service[name](uid, 'book-1', name === 'updateBookRating' ? 3 : 'Late draft')).rejects.toMatchObject({ code: 'library/book-not-found' })
    expect(await read()).toBeNull()
  })

  it('deletes the book and collection references through the existing service', async () => {
    await seed()
    await set(ref(clients[0].database, `users/${uid}/collections/favorites`), { name: 'Favorites', books: { 'book-1': true, other: true } })
    await service.removeBookFromLibrary(uid, 'book-1')
    expect(await read()).toBeNull()
    expect((await get(ref(clients[1].database, `users/${uid}/collections/favorites/books`))).val()).toEqual({ other: true })
  })

  it('does not resurrect a book when same-client deletion cancels pending saves', async () => {
    await seed()
    goOffline(clients[0].database)
    const pending = service.updateBookNote(uid, 'book-1', 'Late note')
    const rejected = expect(pending).rejects.toThrow()
    const deletion = set(ref(clients[0].database, path()), null)
    goOnline(clients[0].database)
    await Promise.all([rejected, deletion])
    expect(await read()).toBeNull()
  })
})

async function serviceDeleteFromOtherClient() {
  // Same server deletion as the library's multi-location update, another SDK client.
  await set(ref(clients[1].database, path()), null)
}
