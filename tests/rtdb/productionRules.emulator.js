// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, get, goOffline, ref, remove, set } from 'firebase/database'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'

const candidate = process.env.DEAR_PAGES_PRODUCTION_RULES === '1'
const run = candidate ? it : it.skip
const clients = []
const password = 'emulator-only-password'
const denied = promise => expect(promise).rejects.toThrow(/permission[ _]denied/i)

vi.mock('../../src/services/firebase.js', () => ({
  auth: clients[0].auth,
  database: clients[0].database,
  isFirebaseEmulator: false,
}))

function client(name, options) {
  const app = initializeApp({
    apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
    projectId: emulator.projectId,
    databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL,
  }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
  const database = getDatabase(app)
  connectDatabaseEmulator(database, emulator.host, emulator.database, options)
  const value = { app, auth, database }
  clients.push(value)
  return value
}

beforeAll(async () => {
  if (!candidate) return
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_LEGACY_BOOK_HISTORY', 'true')
  await assertEmulatorProject()
  await assertEmulatorsReady()
  client('production-rules-owner')
})

afterAll(async () => {
  vi.unstubAllEnvs()
  for (const { app, database } of clients) {
    goOffline(database)
    await deleteApp(app)
  }
})

run('preserves historical data, restricts ordinary writes, and allows complete deletion after reauthentication', async () => {
  const accounts = await import('../../src/services/authService.js')
  const books = await import('../../src/services/libraryService.js')
  const collections = await import('../../src/services/collectionsService.js')
  const preferences = await import('../../src/services/preferencesService.js')
  const notes = await import('../../src/services/bookNotesService.js')
  const ratings = await import('../../src/services/bookRatingsService.js')
  const { database, auth } = clients[0]
  const email = `candidate-${Date.now()}@example.test`
  await accounts.signUpWithEmail(email, password, 'Reader', 'fr')
  const uid = auth.currentUser.uid
  const path = `users/${uid}`
  const own = suffix => ref(database, `${path}/${suffix}`)

  await accounts.logOut()
  expect((await accounts.signInWithEmail(email, password)).uid).toBe(uid)
  await accounts.updateUserDisplayName(auth.currentUser, 'Historical reader')
  expect((await get(own('profile/displayName'))).val()).toBe('Historical reader')
  expect(await preferences.getUserPreferences(uid)).toMatchObject({ language: 'fr' })
  await remove(own('preferences'))
  expect(await preferences.getUserPreferences(uid)).toBeNull()
  await preferences.updateReadingPreferences(uid, { annualGoal: 12 })
  expect(await preferences.getUserPreferences(uid)).toMatchObject({ annualGoal: 12 })

  const bookId = 'legacy-book'
  const source = { note: '<b>Source</b>', review: 'Old review', rating: 4 }
  const original = { googleBooksId: bookId, title: 'Book', status: 'reading', note: '', review: '', rating: 0, metadata: { retained: true } }
  await set(own(`library/${bookId}`), original)
  expect(await books.getUserLibrary(uid)).toEqual([{ ...original, id: bookId }])
  await books.updateBookStatus(uid, bookId, 'finished')
  await books.updateBookNote(uid, bookId, source.note)
  await books.updateBookReview(uid, bookId, source.review)
  await books.updateBookRating(uid, bookId, source.rating)
  const historicalBook = await books.getLibraryBook(uid, bookId)
  expect(historicalBook).toMatchObject({ ...original, ...source, status: 'finished' })
  expect(historicalBook).not.toHaveProperty('id')
  const collection = await collections.createCollection(uid, { name: 'My collection' })
  await collections.updateCollection(uid, collection, { name: 'History' })
  await collections.addBookToCollection(uid, collection, bookId)
  expect(await collections.getUserCollection(uid, collection)).toMatchObject({ name: 'History', books: { [bookId]: expect.anything() } })

  const noteId = await notes.createBookNote(uid, bookId, { title: 'Title', contentHtml: '<p>New note</p>', date: '2024-02-29' })
  await notes.updateBookNotePinned(uid, bookId, noteId, true)
  await notes.updateBookNote(uid, bookId, noteId, { title: 'Edited' })
  const ratingId = ratings.newBookRatingId(uid, bookId)
  const rating = await ratings.createBookRating(uid, bookId, ratingId, { value: 5, date: '2025-01-01', impression: 'Loved it' })
  await ratings.updateBookRatingEntry(uid, bookId, rating, { value: 3, date: '2025-01-02' })

  await accounts.logOut()
  await accounts.signInWithEmail(email, password)
  expect(await notes.getBookNotesForDisplay(uid, bookId)).toMatchObject({
    notes: [{ id: noteId, title: 'Edited', isPinned: true, date: '2024-02-29' }],
    legacy: { status: 'unprocessed', contentHtml: source.note },
    legacyReview: { status: 'unprocessed', contentHtml: source.review },
  })
  const ratingsDisplay = await ratings.getBookRatingsForDisplay(uid, bookId)
  expect(ratingsDisplay).toMatchObject({
    ratings: [{ id: ratingId, value: 3, revision: 2, date: '2025-01-02', impression: 'Loved it' }],
    legacy: { status: 'unprocessed', value: 4 },
  })
  expect(await books.getLibraryBook(uid, bookId)).toEqual(historicalBook)

  const other = client('production-rules-other')
  const { createUserWithEmailAndPassword } = await import('firebase/auth')
  const otherUid = (await createUserWithEmailAndPassword(other.auth, `other-${email}`, password)).user.uid
  await set(ref(other.database, `users/${otherUid}/profile`), { displayName: 'Other reader' })
  for (const branch of ['profile', 'preferences', 'library', 'collections', `bookNotes/${bookId}`, `bookRatings/${bookId}`]) {
    await denied(get(ref(other.database, `${path}/${branch}`)))
    await denied(set(ref(other.database, `${path}/${branch}`), { invalid: true }))
  }
  await denied(remove(ref(other.database, path)))
  await denied(set(ref(database, path), { profile: { displayName: 'Replacement' } }))
  await denied(set(own(`bookNotesLegacy/${bookId}`), { outcome: 'copied' }))
  await denied(set(own(`bookReviewsLegacy/${bookId}`), { outcome: 'copied' }))
  await denied(set(own(`bookRatingsLegacy/${bookId}`), { sourceValue: 4 }))

  const stale = client('production-rules-expired-auth', {
    mockUserToken: { sub: uid, auth_time: Math.floor(Date.now() / 1000) - 3600 },
  })
  expect((await get(ref(stale.database, `${path}/profile/displayName`))).val()).toBe('Historical reader')
  await denied(remove(ref(stale.database, path)))
  await expect(notes.migrateLegacyBookNote(uid, bookId, {})).rejects.toMatchObject({ code: 'book-notes/emulator-only' })
  await expect(ratings.migrateLegacyBookRating(uid, bookId, 4)).rejects.toMatchObject({ code: 'book-ratings/emulator-only' })
  await notes.deleteBookNote(uid, bookId, noteId)
  await ratings.deleteBookRatingEntry(uid, bookId, ratingsDisplay.ratings[0])
  expect(await books.getLibraryBook(uid, bookId)).toEqual(historicalBook)
  await books.removeBookFromLibrary(uid, bookId)
  expect(await books.getLibraryBook(uid, bookId)).toBeNull()
  expect((await collections.getUserCollection(uid, collection)).books?.[bookId]).toBeUndefined()
  await collections.deleteCollection(uid, collection)

  await accounts.deleteCurrentUserAccount(auth.currentUser, { password })
  expect(auth.currentUser).toBeNull()
  await expect(accounts.signInWithEmail(email, password)).rejects.toMatchObject({ code: expect.stringMatching(/user-not-found|invalid-credential/) })
  expect((await get(ref(stale.database, `${path}/profile`))).exists()).toBe(false)
  expect((await get(ref(stale.database, `${path}/preferences`))).exists()).toBe(false)
  expect((await get(ref(other.database, `users/${otherUid}/profile/displayName`))).val()).toBe('Other reader')
})
