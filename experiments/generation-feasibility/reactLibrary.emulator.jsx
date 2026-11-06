import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { prototype } from './prototype.mjs'
import { resolveLibraryBackend } from '../../src/integration/libraryBackend.js'
import { createGenerationApplicationService } from '../../src/services/generationApplicationService.js'
import { createGenerationLibraryGateway } from '../../src/integration/generationLibraryGateway.js'
import { useBookLibraryState } from '../../src/hooks/useBookLibraryState.js'
import useLibraryBooks from '../../src/hooks/useLibraryBooks.js'
import BookPage from '../../src/pages/BookPage.jsx'
import MyLibrary from '../../src/pages/MyLibrary.jsx'
import i18n from '../../src/i18n/index.js'

const injected = vi.hoisted(() => ({ database: null, user: null, current: null }))
vi.mock('../../src/services/firebase.js', () => ({ get database() { return injected.database }, isFirebaseEmulator: true }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ user: injected.user }) }))
vi.mock('../../src/services/libraryService.js', () => ({
  BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' },
  getUserLibrary: vi.fn(async () => []), getLibraryBook: vi.fn(async () => null),
  addBookToLibrary: vi.fn(), updateBookStatus: vi.fn(), removeBookFromLibrary: vi.fn(),
  updateBookFinishedAt: vi.fn(), updateBookAbandonedAt: vi.fn(),
}))
vi.mock('../../src/services/booksApi.js', () => ({ getBookById: vi.fn(async () => ({ id: 'book', title: 'Fictional UI book', authors: ['Fictional author'], categories: [], description: 'Description' })) }))
vi.mock('../../src/components/books/BookPersonalSection.jsx', () => ({ default: vi.fn(() => <p>UNCONNECTED PERSONAL SECTION</p>) }))
import * as legacy from '../../src/services/libraryService.js'
import BookPersonalSection from '../../src/components/books/BookPersonalSection.jsx'

const clients = [], live = new Set()
let uid, email, serial = 0
const password = 'fictional-password'
const catalog = { id: 'book', title: 'Fictional UI book', authors: ['Fictional author'], categories: [], description: 'Description' }
const path = suffix => `users/${uid}${suffix ? `/${suffix}` : ''}`
const observed = suffix => clients[1].observer.read(uid, path(suffix))
async function client({ authEmulator = true, databaseEmulator = true, projectId = 'demo-dear-pages' } = {}) {
  const sdk = initializeApp({ projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `react-library-${++serial}`)
  const auth = getAuth(sdk); if (authEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(sdk); if (databaseEmulator) connectDatabaseEmulator(db, '127.0.0.1', 9000)
  const current = { sdk, auth, db }; live.add(current)
  return current
}
async function close(current) { goOffline(current.db); await deleteApp(current.sdk); live.delete(current) }
async function prepare(state = 'ready') {
  await update(ref(clients[0].db), { [path('bookProtocol')]: { version: 2, state: 'migrating' }, [path('bookMigration')]: { id: 'react-fixture', version: 1 }, [`accountControl/${uid}/legacyClosed`]: true })
  if (state === 'ready') await set(ref(clients[0].db, path('bookProtocol/state')), 'ready')
}
export function Harness({ userId = uid, routeKey = 'route' }) {
  const state = useBookLibraryState({ book: catalog, bookId: 'book', routeKey, userId })
  useEffect(() => { injected.current = state })
  return <><output data-testid="book">{JSON.stringify(state.libraryBook)}</output><p role="alert">{state.libraryError}</p>
    <button disabled={state.isLibraryLoading || state.isSaving} onClick={state.handleAddToLibrary}>Add</button>
    <button disabled={state.isLibraryLoading || state.isSaving} onClick={() => state.handleStatusChange('reading')}>Read</button>
    <button disabled={state.isLibraryLoading || state.isSaving} onClick={state.handleOpenRemoveModal}>Remove</button>
    {state.isRemoveModalOpen && <button disabled={state.isSaving} onClick={state.handleConfirmRemove}>Confirm</button>}</>
}
export function LibraryHarness({ userId = uid }) {
  const state = useLibraryBooks(userId)
  return <output data-testid="list">{JSON.stringify(state)}</output>
}
const ready = async () => { await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()) }
function noLegacyWrites() {
  for (const name of ['addBookToLibrary', 'updateBookStatus', 'removeBookFromLibrary', 'updateBookFinishedAt', 'updateBookAbandonedAt']) expect(legacy[name]).not.toHaveBeenCalled()
}
beforeAll(async () => { await assertEmulatorProject(); await assertEmulatorsReady() })
beforeEach(async () => {
  vi.clearAllMocks(); await i18n.changeLanguage('fr')
  vi.stubEnv('MODE', 'emulator'); vi.stubEnv('VITE_GENERATION_LIBRARY', 'true')
  clients.push(await client(), await client())
  email = `react-library-${Date.now()}-${serial}@example.test`
  uid = (await createUserWithEmailAndPassword(clients[0].auth, email, password)).user.uid
  await signInWithEmailAndPassword(clients[1].auth, email, password)
  clients[1].observer = prototype(clients[1].db)
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
  injected.database = clients[0].db; injected.user = clients[0].auth.currentUser; injected.current = null
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(async () => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const current of [...live]) await close(current); clients.length = 0 })

it.each([{ authEmulator: false }, { databaseEmulator: false }, { projectId: 'demo-other' }])('UI gate: missing or wrong SDK emulator blocks before any facade use: %j', async options => {
  const wrong = await client(options)
  expect((await resolveLibraryBackend(wrong.db, uid, { isolated: true })).mode).toBe('blocked')
})
it('UI gate: disabled isolation never enables the new path', async () => {
  await prepare()
  expect((await resolveLibraryBackend(clients[0].db, uid, { isolated: false })).mode).toBe('blocked')
})
it('UI gate: an unprepared historical account keeps legacy behavior and all data', async () => {
  await set(ref(clients[0].db, path('library/book')), { title: 'Historical', status: 'reading', note: 'Keep me' })
  const before = await observed('')
  render(<Harness />); await ready()
  expect(injected.current.libraryMode).toBe('legacy')
  expect(legacy.getLibraryBook).toHaveBeenCalledWith(uid, 'book')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await waitFor(() => expect(legacy.addBookToLibrary).toHaveBeenCalledTimes(1))
  expect(await observed('')).toEqual(before)
  expect(await observed('bookProtocol')).toBeNull()
})
it('UI gate: no protocol does not enable generation, even with no library data', async () => {
  expect((await resolveLibraryBackend(clients[0].db, uid, { isolated: true })).mode).toBe('legacy')
  expect(await observed('bookProtocol')).toBeNull()
})
it('UI gate: migrating and terminal states are blocked without a legacy fallback', async () => {
  await prepare('migrating'); render(<Harness />)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Impossible'))
  expect(legacy.getLibraryBook).not.toHaveBeenCalled(); noLegacyWrites()
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
})
it('UI gate: unavailable observations never select the historical backend', async () => {
  await prepare()
  const result = await resolveLibraryBackend(clients[0].db, uid, { isolated: true, fetch: () => { throw new Error('offline') } })
  expect(result.mode).toBe('blocked'); noLegacyWrites()
})
it('React hooks: add, read, status, delete and readd use captured generations without legacy writes', async () => {
  await prepare(); render(<Harness />); await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent('"generation":1'))
  fireEvent.click(screen.getByRole('button', { name: 'Read' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent('"status":"reading"'))
  fireEvent.click(screen.getByRole('button', { name: 'Remove' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent('null'))
  expect(await observed('bookData/book')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent('"generation":2'))
  expect(await observed('bookData/book/1')).toBeNull()
  expect(await observed('library')).toBeNull()
  expect(await observed('bookData/book/2/library')).not.toHaveProperty('note')
  noLegacyWrites(); expect(legacy.getLibraryBook).not.toHaveBeenCalled()
})
it('React list: library projects only generation books, with no historical read', async () => {
  await prepare()
  const facade = createGenerationApplicationService(clients[0].db, { uid })
  const gateway = createGenerationLibraryGateway(facade, uid)
  await gateway.add(gateway.captureAddition(catalog, 'to-read', null))
  render(<LibraryHarness />)
  await waitFor(() => expect(screen.getByTestId('list')).toHaveTextContent('Fictional UI book'))
  expect(screen.getByTestId('list')).toHaveTextContent('"generation":1')
  expect(legacy.getUserLibrary).not.toHaveBeenCalled()
})
it('Actual existing pages: library link, book consultation and mutations keep React Router and design', async () => {
  await prepare()
  render(<MemoryRouter initialEntries={['/library']}><Routes>
    <Route path="/library" element={<MyLibrary />} />
    <Route path="/books/:id" element={<><BookPage /><Link to="/library">Back to library</Link></>} />
  </Routes></MemoryRouter>)
  await screen.findByText('Ta bibliothèque est encore vide')
  fireEvent.click(screen.getByRole('link', { name: 'Découvrir des livres' }))
  const add = await screen.findByRole('button', { name: '+ Ajouter à ma bibliothèque' })
  await waitFor(() => expect(add).toBeEnabled()); fireEvent.click(add)
  await waitFor(() => expect(screen.getByRole('button', { name: 'À lire' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'À lire' }))
  fireEvent.click(await screen.findByRole('button', { name: 'En cours' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'En cours' })).toBeEnabled())
  fireEvent.click(screen.getByRole('link', { name: 'Back to library' }))
  await screen.findByRole('link', { name: /Le carnet des saisons/ })
  fireEvent.click(screen.getByRole('link', { name: /Le carnet des saisons/ }))
  const remove = await screen.findByRole('button', { name: 'Retirer de ma bibliothèque' })
  await waitFor(() => expect(remove).toBeEnabled()); fireEvent.click(remove)
  fireEvent.click(await screen.findByRole('button', { name: /^Retirer$/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: '+ Ajouter à ma bibliothèque' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: '+ Ajouter à ma bibliothèque' }))
  await waitFor(async () => expect((await observed('bookLifecycle/generation-demo-book')).generation).toBe(2))
  expect(BookPersonalSection).toHaveBeenCalled()
  await waitFor(() => expect(BookPersonalSection.mock.lastCall[0].personalBackend.context.generation).toBe(2))
  noLegacyWrites()
})
it('Gateway: uncertain purge preserves the book until the same context is explicitly reconciled', async () => {
  await prepare(); let failing = true
  const facade = createGenerationApplicationService(clients[0].db, { uid, update: (...args) => { if (failing) throw new Error('offline'); return update(...args) } })
  const gateway = createGenerationLibraryGateway(facade, uid)
  const plan = gateway.captureAddition(catalog, 'to-read', null)
  await gateway.add(plan)
  await expect(gateway.remove(plan.context)).rejects.toThrow('uncertain')
  expect((await observed('bookLifecycle/book')).state).toBe('deleting')
  failing = false
  const result = await gateway.remove(plan.context)
  expect(result.lifecycle.context).toEqual(plan.context)
  expect(await observed('bookData/book')).toBeNull(); noLegacyWrites()
})
it('Gateway: addition with lost activation response reconciles exactly its original captured plan', async () => {
  await prepare()
  const facade = createGenerationApplicationService(clients[0].db, { uid })
  const faulty = { ...facade, books: { ...facade.books, activateGeneration: async context => { await facade.books.activateGeneration(context); throw new Error('lost ack') } } }
  const gateway = createGenerationLibraryGateway(faulty, uid)
  const plan = gateway.captureAddition(catalog, 'to-read', null)
  await expect(gateway.add(plan)).rejects.toThrow('lost ack')
  const before = await observed('')
  expect((await gateway.add(plan)).book.generationContext).toEqual(plan.context)
  expect(await observed('')).toEqual(before); noLegacyWrites()
})
it('React: an old user operation cannot change state or write after a user switch', async () => {
  await prepare(); render(<Harness />); await ready()
  const old = injected.current
  const other = await client(), otherEmail = `react-other-${serial}@example.test`
  const otherUid = (await createUserWithEmailAndPassword(other.auth, otherEmail, password)).user.uid
  await signInWithEmailAndPassword(clients[0].auth, otherEmail, password)
  await act(async () => { await old.handleAddToLibrary() })
  expect(await observed('bookData')).toBeNull()
  expect(clients[0].auth.currentUser.uid).toBe(otherUid); noLegacyWrites()
})

it('UI gate: a terminal account and invalid protocol never fall back to legacy', async () => {
  await prepare()
  const invalid = await resolveLibraryBackend(clients[0].db, uid, { isolated: true, fetch: async (...args) => {
    if (new URL(args[0]).pathname.endsWith('/bookProtocol.json')) return { ok: true, json: async () => ({ version: 99, state: 'ready' }) }
    return fetch(...args)
  } })
  expect(invalid.mode).toBe('blocked')
  await set(ref(clients[0].db, `accountControl/${uid}`), { state: 'deleting', legacyClosed: true })
  expect((await resolveLibraryBackend(clients[0].db, uid, { isolated: true })).mode).toBe('blocked')
  noLegacyWrites()
})
it('Explicit demo preparation creates only a new fictitious ready account', async () => {
  const before = await observed('')
  const { stdout } = await promisify(execFile)(process.execPath, [resolve(process.cwd(), '../../scripts/prepareGenerationDemo.mjs')], { timeout: 15000 })
  const fixture = JSON.parse(stdout.slice(stdout.indexOf('{')))
  expect(fixture.fixture).toBe('local-demo-only')
  const fresh = await client()
  const signedIn = await signInWithEmailAndPassword(fresh.auth, fixture.email, fixture.password)
  expect(signedIn.user.uid).not.toBe(uid)
  expect((await resolveLibraryBackend(fresh.db, signedIn.user.uid, { isolated: true })).mode).toBe('generation')
  expect(await observed('')).toEqual(before)
})
