import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { prototype } from './prototype.mjs'
import { createGenerationApplicationService } from '../../src/services/generationApplicationService.js'
import { createGenerationLibraryGateway } from '../../src/integration/generationLibraryGateway.js'
import { createGenerationCollectionsGateway } from '../../src/integration/generationCollectionsGateway.js'
import { createGenerationPersonalBackend } from '../../src/integration/generationPersonalBackend.js'
import Collections from '../../src/pages/Collections.jsx'
import CollectionPage from '../../src/pages/CollectionPage.jsx'
import BookPersonalSection from '../../src/components/books/BookPersonalSection.jsx'
import CollectionBooksModal from '../../src/components/collections/modals/CollectionBooksModal.jsx'
import BookCollectionsModal from '../../src/components/collections/modals/BookCollectionsModal.jsx'
import i18n from '../../src/i18n/index.js'

const injected = vi.hoisted(() => ({ db: null, user: null }))
vi.mock('../../src/services/firebase.js', () => ({ get database() { return injected.db }, isFirebaseEmulator: true }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ user: injected.user }) }))
vi.mock('../../src/services/collectionsService.js', () => ({ getUserCollections: vi.fn(), getUserCollection: vi.fn(), createCollection: vi.fn(), updateCollection: vi.fn(), deleteCollection: vi.fn(), updateCollectionPinned: vi.fn(), clearCollectionBooks: vi.fn(), removeBookFromCollection: vi.fn(), updateBookCollectionMembership: vi.fn(), updateCollectionBookMembership: vi.fn() }))
vi.mock('../../src/services/libraryService.js', () => ({ BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' }, getUserLibrary: vi.fn(), getLibraryBook: vi.fn(), updateBookRating: vi.fn() }))
vi.mock('../../src/services/bookNotesService.js', () => ({ isBookNotesUiEnabled: true, compareBookNotes: () => 0, getBookNotesForDisplay: vi.fn(), createBookNote: vi.fn(), updateBookNote: vi.fn(), updateBookNotePinned: vi.fn(), deleteBookNote: vi.fn(), getBookNote: vi.fn(), migrateLegacyBookNote: vi.fn(), migrateLegacyBookReview: vi.fn() }))
vi.mock('../../src/services/bookRatingsService.js', () => ({ isBookRatingsUiEnabled: true, compareBookRatings: () => 0, getBookRatingsForDisplay: vi.fn(), newBookRatingId: vi.fn(), createBookRating: vi.fn(), updateBookRatingEntry: vi.fn(), deleteBookRatingEntry: vi.fn(), migrateLegacyBookRating: vi.fn() }))
import * as oldCollections from '../../src/services/collectionsService.js'
import * as oldLibrary from '../../src/services/libraryService.js'

const clients = [], live = new Set()
let uid, serial = 0, facade, library, gateway, books
const password = 'fictional-password'
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const read = suffix => clients[1].observer.read(uid, path(suffix))
async function client() {
  const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `react-collections-${++serial}`)
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const current = { app, auth, db }; live.add(current); return current
}
async function close(current) { goOffline(current.db); await deleteApp(current.app); live.delete(current) }
async function createCollection(name) {
  const operation = gateway.catalogOperation('catalog.create', null, { name })
  await gateway.executeCatalog(operation)
  return (await gateway.load()).collections.find(item => item.id === operation.context.collectionId)
}
function noLegacy() {
  for (const module of [oldCollections, oldLibrary]) for (const value of Object.values(module)) if (vi.isMockFunction(value)) expect(value).not.toHaveBeenCalled()
}
const assertReady = () => waitFor(() => expect(screen.queryByText('Chargement de tes collections...')).not.toBeInTheDocument())
async function submitCreate(name) {
  fireEvent.click(screen.getByRole('button', { name: 'Nouvelle collection' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nom' }), { target: { value: name } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la collection' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  return screen.findByRole('link', { name: `Ouvrir la collection ${name}` })
}
beforeAll(async () => { await assertEmulatorProject(); await assertEmulatorsReady() })
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubEnv('MODE', 'emulator'); vi.stubEnv('VITE_GENERATION_LIBRARY', 'true'); await i18n.changeLanguage('fr')
  clients.push(await client(), await client())
  const email = `react-collections-${Date.now()}-${serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, password)
  clients[1].observer = prototype(clients[1].db)
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
  await update(ref(clients[0].db), { [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'collections-fixture', version: 1 }, [`accountControl/${uid}/legacyClosed`]: true })
  await set(ref(clients[0].db, path('bookProtocol/state')), 'ready')
  facade = createGenerationApplicationService(clients[0].db, { uid })
  library = createGenerationLibraryGateway(facade, uid); gateway = createGenerationCollectionsGateway(facade, library, uid)
  for (const [id, title] of [['first', 'First book'], ['second', 'Second book']]) await library.add(library.captureAddition({ id, title, authors: ['Fictional author'] }, 'to-read', null))
  books = await library.list()
  injected.db = clients[0].db; injected.user = clients[0].auth.currentUser
})
afterEach(async () => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const current of [...live]) await close(current); clients.length = 0 })

it('existing Collections pages create, edit, pin, add books, open details, remove and delete persistently', async () => {
  render(<MemoryRouter initialEntries={['/collections']}><Routes>
    <Route path="/collections" element={<Collections />} />
    <Route path="/collections/:id" element={<><CollectionPage /><Link to="/collections">List collections</Link></>} />
  </Routes></MemoryRouter>)
  await assertReady(); await submitCreate('Autumn')
  fireEvent.click(screen.getByRole('button', { name: 'Actions pour Autumn' }))
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
  let dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nom' }), { target: { value: 'Winter' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Actions pour Winter' }))
  fireEvent.click(screen.getByRole('button', { name: 'Épingler' }))
  await screen.findByText('Épinglée')
  fireEvent.click(screen.getByRole('link', { name: 'Ouvrir la collection Winter' }))
  const add = await screen.findAllByRole('button', { name: 'Ajouter des livres' }); fireEvent.click(add[0])
  dialog = await screen.findByRole('dialog')
  const first = await within(dialog).findByRole('checkbox', { name: /First book/ })
  fireEvent.click(first); fireEvent.click(within(dialog).getByRole('checkbox', { name: /Second book/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  await screen.findByRole('link', { name: /First book/ }); await screen.findByRole('link', { name: /Second book/ })
  fireEvent.click(screen.getAllByRole('button', { name: 'Retirer de la collection' })[0])
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  expect((await gateway.load()).collections[0].books).toEqual(expect.any(Object))
  expect(Object.keys((await gateway.load()).collections[0].books)).toHaveLength(1)
  fireEvent.click(screen.getByRole('link', { name: 'List collections' }))
  await screen.findByRole('link', { name: 'Ouvrir la collection Winter' })
  fireEvent.click(screen.getByRole('button', { name: 'Actions pour Winter' })); fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  expect((await gateway.load()).collections).toEqual([])
  expect((await library.list())).toHaveLength(2)
  noLegacy()
})
it('book page existing personal control assigns one book to multiple Collections and survives remount', async () => {
  await createCollection('One'); await createCollection('Two')
  const first = books.find(item => item.id === 'first')
  const personal = createGenerationPersonalBackend(facade, first.generationContext)
  const current = render(<BookPersonalSection userId={uid} bookId={first.id} libraryBook={first} personalBackend={personal} collectionsGateway={gateway} />)
  fireEvent.click(screen.getByRole('button', { name: 'Gérer les collections' }))
  let dialog = screen.getByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'One' })); fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Two' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
  expect(await gateway.bookCount(first.generationContext)).toBe(2)
  current.unmount()
  render(<BookCollectionsModal isOpen userId={uid} bookId="first" bookContext={first.generationContext} generationGateway={createGenerationCollectionsGateway(createGenerationApplicationService(clients[1].db, { uid }), createGenerationLibraryGateway(createGenerationApplicationService(clients[1].db, { uid }), uid), uid)} onClose={vi.fn()} onSaved={vi.fn()} />)
  expect(await screen.findByRole('checkbox', { name: 'One' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Two' })).toBeChecked()
  noLegacy()
})
it('clear advances epoch; captured selections cannot target a cleared or deleted Collection', async () => {
  const collection = await createCollection('Clear')
  const selection = await gateway.collectionSelection(collection)
  await gateway.saveSelection(selection, ['first', 'second'])
  const stale = await gateway.collectionSelection(collection)
  await gateway.executeCatalog(gateway.catalogOperation('catalog.clear', collection))
  await expect(gateway.saveSelection(stale, [])).rejects.toThrow('rejected')
  const cleared = (await gateway.load()).collections[0]
  expect(cleared.context.epoch).toBe(2); expect(cleared.books).toEqual({})
  const old = await gateway.collectionSelection(cleared)
  await gateway.executeCatalog(gateway.catalogOperation('catalog.delete', cleared))
  await expect(gateway.saveSelection(old, ['first'])).rejects.toThrow('rejected')
  expect((await library.list())).toHaveLength(2); noLegacy()
})
it('delete and readd book never resurrect membership, old generations cannot commit', async () => {
  const collection = await createCollection('Readd'), old = books.find(item => item.id === 'first')
  const initial = await gateway.collectionSelection(collection); await gateway.saveSelection(initial, ['first'])
  const stale = await gateway.bookSelection(old.generationContext)
  await facade.books.deleteGeneration(old.generationContext)
  const next = await library.add(library.captureAddition({ id: 'first', title: 'New first', authors: [] }, 'to-read', { context: old.generationContext, state: 'deleted' }))
  await expect(gateway.saveSelection(stale, [])).rejects.toThrow('rejected')
  expect(next.book.generationContext.generation).toBe(2)
  expect(await gateway.bookCount(next.book.generationContext)).toBe(0)
  expect((await gateway.load()).collections[0].books).toEqual({})
  expect(await read('bookData/first/1')).toBeNull(); noLegacy()
})
it('catalog metadata stale tokens cannot overwrite a newer field revision', async () => {
  const collection = await createCollection('Original')
  const old = gateway.catalogOperation('catalog.patch', collection, { name: 'Old intention' })
  await gateway.executeCatalog(gateway.catalogOperation('catalog.patch', collection, { name: 'New intention' }))
  await expect(gateway.executeCatalog(old)).rejects.toThrow('field-conflict')
  expect((await gateway.load()).collections[0].name).toBe('New intention')
})
it('single-book removal captures the displayed membership revision, not a later readd', async () => {
  let collection = await createCollection('Removal')
  await gateway.saveSelection(await gateway.collectionSelection(collection), ['first'])
  collection = (await gateway.load()).collections[0]
  const captured = await gateway.removeSelection(collection, books.find(item => item.id === 'first'))
  await gateway.saveSelection(await gateway.collectionSelection(collection), [])
  await gateway.saveSelection(await gateway.collectionSelection(collection), ['first'])
  await expect(gateway.saveSelection(captured, [])).rejects.toThrow('rejected')
  expect((await gateway.load()).collections[0].books).toEqual({ first: true })
})
it('lost batch confirmation is reconciled explicitly at the same sequence with no duplicate effects', async () => {
  const collection = await createCollection('Uncertain'); let unavailable = false, sends = 0
  const uncertainFacade = createGenerationApplicationService(clients[0].db, { uid,
    fetch: (...args) => { if (unavailable) throw new Error('lost evidence'); return fetch(...args) },
    update: async (...args) => { sends++; await update(...args); unavailable = true },
  })
  const uncertain = createGenerationCollectionsGateway(uncertainFacade, library, uid)
  const selection = await uncertain.collectionSelection(collection)
  await expect(uncertain.saveSelection(selection, ['first'])).rejects.toThrow('network-error')
  expect(sends).toBe(1)
  unavailable = false
  expect((await uncertain.saveSelection(selection, ['first'])).status).toBe('confirmed')
  expect(sends).toBe(1); expect((await facade.batches.getHead()).sequence).toBe(1)
  expect((await gateway.load()).collections[0].books).toEqual({ first: true })
})
it('an indeterminate batch after book purge is never replayed or allocated a new sequence', async () => {
  const collection = await createCollection('Lost receipt')
  const selection = await gateway.collectionSelection(collection)
  await gateway.saveSelection(selection, ['first'])
  await facade.books.deleteGeneration(books.find(item => item.id === 'first').generationContext)
  const before = await read('')
  await expect(gateway.saveSelection(selection, ['first'])).rejects.toThrow('indeterminate')
  expect(await read('')).toEqual(before); expect((await facade.batches.getHead()).sequence).toBe(1)
})
it('concurrent batches have one sequence winner and no partial losing rows', async () => {
  const a = await createCollection('A'), b = await createCollection('B')
  const first = await gateway.collectionSelection(a), second = await gateway.collectionSelection(b)
  // Freeze a common observed head without replacing the real commit/reconciliation.
  const sameHead = { ...facade, batches: { ...facade.batches, getHead: async () => null } }
  const worker = createGenerationCollectionsGateway(sameHead, library, uid)
  const result = await Promise.allSettled([worker.saveSelection(first, ['first']), worker.saveSelection(second, ['second'])])
  expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1)
  expect(Object.values(await read('batchReceipts')).filter(Boolean)).toHaveLength(1)
  expect(Object.keys((await gateway.load()).collections.flatMap(item => Object.keys(item.books)))).toHaveLength(1)
})
it('account isolation denies a previously captured selection after Auth switching', async () => {
  const collection = await createCollection('Private'), selection = await gateway.collectionSelection(collection)
  const other = await client(), email = `collections-other-${serial}@example.test`
  await createUserWithEmailAndPassword(other.auth, email, password)
  const before = await read('')
  await signInWithEmailAndPassword(clients[0].auth, email, password)
  await expect(gateway.saveSelection(selection, ['first'])).rejects.toThrow('owner-mismatch')
  expect(await read('')).toEqual(before); noLegacy()
})
it('33 guarded tuples are rejected before sending, with no automatic chunking', async () => {
  const collection = await createCollection('Bounds'), selection = await gateway.collectionSelection(collection)
  const oversized = { ...selection, rows: Array.from({ length: 33 }, (_, i) => ({ ...selection.rows[0], bookId: `b${i}` })) }
  await expect(gateway.saveSelection(oversized, [])).rejects.toThrow('bounds')
  expect(await read('batchHead')).toBeNull(); noLegacy()
})
it('all historical branches stay absent through generation-only Collection operations', async () => {
  const collection = await createCollection('No legacy')
  await gateway.saveSelection(await gateway.collectionSelection(collection), ['first', 'second'])
  await gateway.executeCatalog(gateway.catalogOperation('catalog.delete', collection))
  for (const branch of ['library', 'collections', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy']) expect(await read(branch)).toBeNull()
  noLegacy()
})

it('existing membership modal keeps uncertain confirmation open and reconciles the same receipt explicitly', async () => {
  const collection = await createCollection('Modal uncertainty')
  let unavailable = false, sends = 0
  const uncertainFacade = createGenerationApplicationService(clients[0].db, { uid,
    fetch: (...args) => { if (unavailable) throw new Error('lost evidence'); return fetch(...args) },
    update: async (...args) => { sends++; await update(...args); unavailable = true },
  })
  const worker = createGenerationCollectionsGateway(uncertainFacade, library, uid), saved = vi.fn(), closed = vi.fn()
  render(<CollectionBooksModal isOpen userId={uid} collection={collection} libraryBooks={books} generationGateway={worker} onClose={closed} onSaved={saved} />)
  fireEvent.click(await screen.findByRole('checkbox', { name: /First book/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText(/Confirmation indisponible/)
  expect(sends).toBe(1); expect(saved).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled()
  unavailable = false
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
  expect(sends).toBe(1); expect((await facade.batches.getHead()).sequence).toBe(1)
  expect(await read('bookData/first/1/collectionMemberships/' + collection.id)).toMatchObject({ revision: 1, present: true })
  noLegacy()
})
