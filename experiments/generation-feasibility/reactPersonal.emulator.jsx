import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { prototype } from './prototype.mjs'
import { createGenerationApplicationService } from '../../src/services/generationApplicationService.js'
import { createGenerationPersonalBackend } from '../../src/integration/generationPersonalBackend.js'
import { createGenerationLibraryGateway } from '../../src/integration/generationLibraryGateway.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import BookPage from '../../src/pages/BookPage.jsx'
import BookPersonalSection from '../../src/components/books/BookPersonalSection.jsx'
import BookNotesSection from '../../src/components/books/BookNotesSection.jsx'
import BookRatingsSection from '../../src/components/books/BookRatingsSection.jsx'
import useBookNotes from '../../src/hooks/useBookNotes.js'
import useBookRatings from '../../src/hooks/useBookRatings.js'
import i18n from '../../src/i18n/index.js'

const injected = vi.hoisted(() => ({ database: null, user: null, notes: null, ratings: null }))
vi.mock('../../src/services/firebase.js', () => ({ get database() { return injected.database }, isFirebaseEmulator: true }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ user: injected.user }) }))
vi.mock('../../src/services/libraryService.js', () => ({ BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' },
  getLibraryBook: vi.fn(), addBookToLibrary: vi.fn(), removeBookFromLibrary: vi.fn(), updateBookStatus: vi.fn(), updateBookFinishedAt: vi.fn(), updateBookAbandonedAt: vi.fn(), updateBookRating: vi.fn() }))
vi.mock('../../src/services/bookNotesService.js', () => ({ isBookNotesUiEnabled: true, compareBookNotes: (a,b) => Number(b.isPinned) - Number(a.isPinned) || a.id.localeCompare(b.id),
  getBookNotesForDisplay: vi.fn(), createBookNote: vi.fn(), updateBookNote: vi.fn(), updateBookNotePinned: vi.fn(), deleteBookNote: vi.fn(), getBookNote: vi.fn(), migrateLegacyBookNote: vi.fn(), migrateLegacyBookReview: vi.fn() }))
vi.mock('../../src/services/bookRatingsService.js', () => ({ isBookRatingsUiEnabled: true, compareBookRatings: (a,b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt,
  getBookRatingsForDisplay: vi.fn(), newBookRatingId: vi.fn(), createBookRating: vi.fn(), updateBookRatingEntry: vi.fn(), deleteBookRatingEntry: vi.fn(), migrateLegacyBookRating: vi.fn() }))
vi.mock('../../src/services/collectionsService.js', () => ({ getUserCollections: vi.fn() }))
vi.mock('../../src/components/collections/modals/BookCollectionsModal.jsx', () => ({ default: vi.fn(() => null) }))
import * as oldNotes from '../../src/services/bookNotesService.js'
import * as oldRatings from '../../src/services/bookRatingsService.js'
import * as oldLibrary from '../../src/services/libraryService.js'
import { getUserCollections } from '../../src/services/collectionsService.js'

const clients = [], live = new Set()
let uid, serial = 0, facade, backend, book
const password = 'fictional-password'
const context = (generation = 1) => createBookMutationContext({ uid, bookId: 'generation-demo-book', generation })
const path = suffix => `users/${uid}/${suffix}`
const read = suffix => clients[1].observer.read(uid, path(suffix))
async function client() {
  const sdk = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `react-personal-${++serial}`)
  const auth = getAuth(sdk); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(sdk); connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const current = { sdk, auth, db }; live.add(current); return current
}
async function close(current) { goOffline(current.db); await deleteApp(current.sdk); live.delete(current) }
async function createBook(generation = 1) {
  const gateway = createGenerationLibraryGateway(facade, uid)
  const previous = generation === 1 ? null : { context: context(generation - 1), state: 'deleted' }
  const result = await gateway.add(gateway.captureAddition({ id: 'generation-demo-book', title: 'Fictional personal book', authors: ['Author'] }, 'finished', previous))
  book = result.book
  backend = createGenerationPersonalBackend(facade, book.generationContext)
}
export function Models({ current = backend, userId = uid }) {
  const notes = useBookNotes(userId, 'generation-demo-book', current)
  const ratings = useBookRatings(userId, 'generation-demo-book', current)
  useEffect(() => { injected.notes = notes; injected.ratings = ratings })
  return <><BookPersonalSection userId={userId} bookId="generation-demo-book" libraryBook={book} personalBackend={current} />
    <output data-testid="notes">{JSON.stringify(notes.notes)}</output><output data-testid="ratings">{JSON.stringify(ratings.ratings)}</output></>
}
const noteInput = (title = 'First note') => ({ title, contentHtml: 'Private text', date: '2026-11-06' })
async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une note' })).toBeEnabled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une évaluation' })).toBeEnabled())
}
async function addNote(title) {
  await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }))
  const form = screen.getByRole('textbox', { name: 'Titre (facultatif)' }).closest('form')
  fireEvent.change(within(form).getByRole('textbox', { name: 'Titre (facultatif)' }), { target: { value: title } })
  const editor = within(form).getByRole('textbox', { name: 'Contenu de la note' })
  editor.innerHTML = `<b>Private ${title}</b>`; fireEvent.input(editor)
  fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
  await screen.findByRole('article', { name: title })
}
function noHistoricalCalls() {
  for (const module of [oldNotes, oldRatings, oldLibrary]) for (const value of Object.values(module)) if (vi.isMockFunction(value)) expect(value).not.toHaveBeenCalled()
  expect(getUserCollections).not.toHaveBeenCalled()
}
beforeAll(async () => { await assertEmulatorProject(); await assertEmulatorsReady() })
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubEnv('MODE', 'emulator'); vi.stubEnv('VITE_GENERATION_LIBRARY', 'true'); await i18n.changeLanguage('fr')
  clients.push(await client(), await client())
  const email = `react-personal-${Date.now()}-${serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, password)
  clients[1].observer = prototype(clients[1].db)
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
  await update(ref(clients[0].db), { [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'personal-fixture', version: 1 }, [`accountControl/${uid}/legacyClosed`]: true })
  await set(ref(clients[0].db, path('bookProtocol/state')), 'ready')
  injected.database = clients[0].db; injected.user = clients[0].auth.currentUser
  facade = createGenerationApplicationService(clients[0].db, { uid })
  await createBook()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(async () => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const current of [...live]) await close(current); clients.length = 0 })

it('BookPage displays the existing personal sections with the authorized facade, without historical calls', async () => {
  render(<MemoryRouter initialEntries={['/books/generation-demo-book']}><Routes><Route path="/books/:id" element={<BookPage />} /></Routes></MemoryRouter>)
  await ready()
  await addNote('From actual page')
  expect(screen.getByRole('heading', { name: 'Mon évaluation' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gérer mes collections/ })).not.toBeInTheDocument()
  noHistoricalCalls()
})
it('existing note forms create several notes, edit, pin, delete and persist after remount', async () => {
  const current = render(<BookPersonalSection userId={uid} bookId="generation-demo-book" libraryBook={book} personalBackend={backend} />)
  await addNote('First note'); await addNote('Second note')
  const first = screen.getByRole('article', { name: 'First note' })
  fireEvent.click(within(first).getByRole('button', { name: 'Épingler la note' }))
  await waitFor(() => expect(within(first).getByRole('button', { name: 'Désépingler la note' })).toBeEnabled())
  fireEvent.click(within(first).getByRole('button', { name: /First note ·/ }))
  fireEvent.click(within(first).getByRole('button', { name: 'Modifier' }))
  fireEvent.change(within(first).getByRole('textbox', { name: 'Titre (facultatif)' }), { target: { value: 'Edited first' } })
  fireEvent.click(within(first).getByRole('button', { name: 'Enregistrer' }))
  const edited = await screen.findByRole('article', { name: 'Edited first' })
  await waitFor(() => expect(within(edited).getByRole('button', { name: 'Supprimer' })).toBeEnabled())
  const second = screen.getByRole('article', { name: 'Second note' })
  fireEvent.click(within(second).getByRole('button', { name: /Second note ·/ }))
  fireEvent.click(within(second).getByRole('button', { name: 'Supprimer' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  await waitFor(() => expect(screen.queryByRole('article', { name: 'Second note' })).not.toBeInTheDocument())
  const raw = await read('bookData/generation-demo-book/1/bookNotes')
  expect(Object.values(raw).some(note => note.deleted)).toBe(true)
  expect(Object.values(raw).find(note => note.title === 'Edited first')).toMatchObject({ isPinned: true, fieldRevisions: { title: 2 } })
  current.unmount()
  const fresh = createGenerationPersonalBackend(clients[1].facade || createGenerationApplicationService(clients[1].db, { uid }), context())
  render(<BookPersonalSection userId={uid} bookId="generation-demo-book" libraryBook={book} personalBackend={fresh} />)
  await ready(); expect(screen.getByRole('article', { name: 'Edited first' })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Second note' })).not.toBeInTheDocument()
  noHistoricalCalls()
})
it('existing rating form creates, updates and deletes with revisions and persists after reload', async () => {
  render(<BookPersonalSection userId={uid} bookId="generation-demo-book" libraryBook={book} personalBackend={backend} />); await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter une évaluation' }))
  let dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '4 étoiles' }))
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Petite phrase (facultative)' }), { target: { value: 'First impression' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Modifier l’évaluation' })); dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '5 étoiles' }))
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Petite phrase (facultative)' }), { target: { value: 'Updated impression' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const persisted = await backend.ratings.load()
  expect(persisted.ratings[0]).toMatchObject({ value: 5, revision: 2, impression: 'Updated impression' })
  cleanup()
  render(<BookRatingsSection userId={uid} bookId="generation-demo-book" personalBackend={createGenerationPersonalBackend(createGenerationApplicationService(clients[1].db, { uid }), context())} />)
  await waitFor(() => expect(screen.getByText('Updated impression')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Supprimer l’évaluation' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  await waitFor(() => expect(screen.queryByRole('article', { name: 'Évaluation' })).not.toBeInTheDocument())
  expect(Object.values(await read('bookData/generation-demo-book/1/bookRatings'))[0]).toMatchObject({ deleted: true, revision: 3 })
  noHistoricalCalls()
})
it('deletion/readd rejects old notes and ratings and the new sections start empty', async () => {
  const old = backend
  await old.notes.create(noteInput()); await old.ratings.create(old.ratings.allocate(), { value: 4, date: '2026-11-06' })
  await facade.books.deleteGeneration(context()); await createBook(2)
  await expect(old.notes.create(noteInput('Stale'))).rejects.toThrow('stale-generation')
  await expect(old.ratings.create(old.ratings.allocate(), { value: 3, date: '2026-11-06' })).rejects.toThrow('stale-generation')
  render(<BookPersonalSection userId={uid} bookId="generation-demo-book" libraryBook={book} personalBackend={backend} />); await ready()
  expect(screen.queryAllByRole('article')).toHaveLength(0)
  expect(await read('bookData/generation-demo-book/1')).toBeNull()
  expect(await read('library')).toBeNull(); expect(await read('bookNotes')).toBeNull(); expect(await read('bookRatings')).toBeNull()
  noHistoricalCalls()
})
it('note edits keep the token captured before refresh and report a real concurrent conflict', async () => {
  await backend.notes.create(noteInput())
  render(<BookNotesSection userId={uid} bookId="generation-demo-book" personalBackend={backend} />)
  const card = await screen.findByRole('article', { name: 'First note' })
  fireEvent.click(within(card).getByRole('button', { name: /First note ·/ })); fireEvent.click(within(card).getByRole('button', { name: 'Modifier' }))
  fireEvent.change(within(card).getByRole('textbox', { name: 'Titre (facultatif)' }), { target: { value: 'Local draft' } })
  const entry = (await backend.notes.load()).notes[0]
  const other = createGenerationApplicationService(clients[1].db, { uid })
  await other.notes.saveNote(context(), entry.id, { title: 'Other client', contentHtml: entry.contentHtml, date: entry.date }, entry.token)
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les notes' }))
  await waitFor(() => expect(screen.getByRole('article', { name: 'Other client' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText(/Cette note a changé/)
  expect((await backend.notes.load()).notes[0].title).toBe('Other client')
  noHistoricalCalls()
})
it('rating stale revisions are rejected rather than overwriting another client', async () => {
  const id = backend.ratings.allocate(); await backend.ratings.create(id, { value: 4, date: '2026-11-06' })
  const original = (await backend.ratings.load()).ratings[0]
  const other = createGenerationPersonalBackend(createGenerationApplicationService(clients[1].db, { uid }), context())
  await other.ratings.save(original, { value: 5, date: original.date })
  await expect(backend.ratings.save(original, { value: 2, date: original.date })).rejects.toThrow('revision-conflict')
  expect((await backend.ratings.load()).ratings[0].value).toBe(5)
})
it('a lost note response is uncertain; only an explicit retry reuses the identical creation ID', async () => {
  const real = facade.notes.execute; let fail = true, sends = 0
  const uncertain = createGenerationPersonalBackend({ notes: { ...facade.notes, execute: async op => { sends++; const result = await real(op); if (fail) throw new Error('lost response'); return result } }, ratings: facade.ratings }, context())
  render(<BookNotesSection userId={uid} bookId="generation-demo-book" personalBackend={uncertain} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une note' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }))
  const form = screen.getByRole('textbox', { name: 'Titre (facultatif)' }).closest('form')
  fireEvent.change(within(form).getByRole('textbox', { name: 'Titre (facultatif)' }), { target: { value: 'Uncertain note' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText(/Confirmation indisponible/)
  expect(sends).toBe(1)
  expect(Object.keys(await read('bookData/generation-demo-book/1/bookNotes'))).toHaveLength(1)
  fail = false
  fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
  await screen.findByRole('article', { name: 'Uncertain note' })
  expect(sends).toBe(2); expect(Object.keys(await read('bookData/generation-demo-book/1/bookNotes'))).toHaveLength(1)
  noHistoricalCalls()
})
it('account switching refuses the old adapter without writing personal data for either owner', async () => {
  const stranger = await client(), email = `personal-other-${serial}@example.test`
  await createUserWithEmailAndPassword(stranger.auth, email, password)
  const before = await read('')
  await signInWithEmailAndPassword(clients[0].auth, email, password)
  await expect(backend.notes.create(noteInput())).rejects.toThrow('owner-mismatch')
  await expect(backend.ratings.create(backend.ratings.allocate(), { value: 4, date: '2026-11-06' })).rejects.toThrow('owner-mismatch')
  expect(await read('')).toEqual(before); noHistoricalCalls()
})
it('a lost rating response is displayed as uncertain and never retried by a render or refresh', async () => {
  let fail = true, sends = 0
  const uncertain = createGenerationPersonalBackend({ notes: facade.notes, ratings: { ...facade.ratings, execute: async op => {
    sends++; const result = await facade.ratings.execute(op); if (fail) throw new Error('lost response'); return result
  } } }, context())
  render(<BookRatingsSection userId={uid} bookId="generation-demo-book" personalBackend={uncertain} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une évaluation' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter une évaluation' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '4 étoiles' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await screen.findAllByText(/Confirmation indisponible/)
  expect(sends).toBe(1)
  fail = false
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sends).toBe(2)
  expect(Object.values(await read('bookData/generation-demo-book/1/bookRatings'))).toEqual([expect.objectContaining({ revision: 1, value: 4 })])
  noHistoricalCalls()
})
it('an in-flight old-user mutation cannot update the next user or write after account switching', async () => {
  let release, started = false
  const gate = new Promise(resolve => { release = resolve })
  const delayed = createGenerationPersonalBackend({ notes: { ...facade.notes, execute: async op => { started = true; await gate; return facade.notes.execute(op) } }, ratings: facade.ratings }, context())
  const { rerender } = render(<Models current={delayed} />)
  await waitFor(() => expect(injected.notes.loaded).toBe(true))
  let pending
  act(() => { pending = injected.notes.create(noteInput()) })
  expect(started).toBe(true)
  const stranger = await client(), email = `personal-switch-${serial}@example.test`
  const otherUid = (await createUserWithEmailAndPassword(stranger.auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[0].auth, email, password)
  rerender(<Models current={delayed} userId={otherUid} />)
  await act(async () => { release(); expect(await pending).toBe(false) })
  expect(screen.getByTestId('notes')).toHaveTextContent('[]')
  expect(await read('bookData/generation-demo-book/1/bookNotes')).toBeNull()
  noHistoricalCalls()
})
it('a server-locked generation reports refusal in the existing form without a legacy fallback', async () => {
  render(<BookNotesSection userId={uid} bookId="generation-demo-book" personalBackend={backend} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter une note' })).toBeEnabled())
  await facade.books.lockDeletion(context())
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }))
  const form = screen.getByRole('textbox', { name: 'Titre (facultatif)' }).closest('form')
  fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText(/Opération refusée/)
  expect(await read('bookData/generation-demo-book/1/bookNotes')).toBeNull()
  noHistoricalCalls()
})
