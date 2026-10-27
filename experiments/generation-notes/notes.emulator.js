import { webcrypto } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { bookDataPath, bookLibraryPath, bookLifecyclePath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationBookNotesService } from '../../src/services/generationBookNotesService.js'
import { createNoteCreateOperation, createNotePatchOperation, createNoteConversionOperation } from '../../src/utils/generationNoteContracts.js'
import { bookNotesPath, bookNotesLegacyPath, bookReviewsLegacyPath } from '../../src/utils/bookGenerationPaths.js'
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
const notes = (client = 0) => clients[client].notes
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
beforeAll(async () => {
  Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true })
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
    clients.push({ app, auth, database, notes: createGenerationBookNotesService(database), library: createGenerationLibraryService(database), lifecycle: createBookLifecycleService(database) })
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

const payload = (extras = {}) => ({ title: 'Title', contentHtml: 'Text', date: '2024-02-29', ...extras })
const make = async (id = 'n', extras = {}, context = ctx()) => { await notes().createNote(context, id, payload(extras)); return notes().getNote(context, id) }
const field = (id = 'n') => bookNotesPath(ctx(), id)

it('fails closed outside local demo emulators', () => {
  expect(() => createGenerationBookNotesService({ app: { options: { projectId: 'other' } } })).toThrow('emulator-only')
})
it('creates with a stable ID and returns a sanitized frozen view and token', async () => {
  await active(); const note = await make()
  expect(note.title).toBe('Title'); expect(Object.isFrozen(note.token)).toBe(true)
  expect((await notes().getNotes(ctx())).map(n => n.id)).toEqual(['n'])
  expect(await observed(field())).toMatchObject({ title: 'Title', isPinned: false })
})
it('replays identical creation but rejects a different payload', async () => {
  await active(); await make()
  await notes(1).createNote(ctx(), 'n', payload())
  await expect(notes().createNote(ctx(), 'n', payload({ title: 'Other' }))).rejects.toThrow('creation-conflict')
  expect((await observed(field())).title).toBe('Title')
})
it('chooses exactly one incompatible concurrent creator', async () => {
  await active()
  const result = await Promise.allSettled([notes().createNote(ctx(), 'n', payload()), notes(1).createNote(ctx(), 'n', payload({ title: 'Other' }))])
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(['Title', 'Other']).toContain((await observed(field())).title)
})
it('merges independent targeted field patches', async () => {
  await active(); const n = await make()
  await Promise.all([notes().patchNote(ctx(), 'n', { title: 'Changed' }, n.token), notes(1).patchNote(ctx(), 'n', { contentHtml: 'Changed text' }, n.token)])
  expect(await observed(field())).toMatchObject({ title: 'Changed', contentHtml: 'Changed text' })
})
it('rejects a stale full save while allowing an independent patch', async () => {
  await active(); const n = await make()
  await notes().patchNote(ctx(), 'n', { title: 'New' }, n.token)
  await expect(notes(1).saveNote(ctx(), 'n', payload(), n.token)).rejects.toThrow('field-conflict')
  await notes(1).patchNote(ctx(), 'n', { date: '0001-01-01' }, n.token)
  expect(await observed(field())).toMatchObject({ title: 'New', date: '0001-01-01' })
})
it('pin assignment and content patch coexist and pin preserves timestamps', async () => {
  await active(); const n = await make()
  await notes().setPinned(ctx(), 'n', true, n.token)
  expect((await observed(field())).updatedAt).toBe(n.updatedAt)
  await Promise.all([notes().setPinned(ctx(), 'n', false, n.token), notes(1).patchNote(ctx(), 'n', { title: 'New' }, n.token)])
  expect(await observed(field())).toMatchObject({ title: 'New', isPinned: false })
})
it('deletion leaves only a terminal content-free tombstone and can be retried', async () => {
  await active(); const n = await make()
  await notes().deleteNote(ctx(), 'n', n.token); await notes(1).deleteNote(ctx(), 'n', n.token)
  expect(await observed(field())).toEqual({ deleted: true, createdAt: n.createdAt })
  expect(await notes().getNote(ctx(), 'n')).toBeNull(); expect(await notes().getNotes(ctx())).toEqual([])
  await expect(notes().createNote(ctx(), 'n', payload())).rejects.toThrow('creation-conflict')
  await expect(notes().setPinned(ctx(), 'n', true, n.token)).rejects.toThrow('deleted')
  await expect(notes().patchNote(ctx(), 'n', { title: 'Resurrection' }, n.token)).rejects.toThrow('deleted')
})
it('rejects direct tombstone mutation, null deletion and resurrection', async () => {
  await active(); const n = await make(), original = await observed(field())
  await denied(remove(location(field())))
  await notes().deleteNote(ctx(), 'n', n.token)
  await denied(set(location(field()), original)); await denied(remove(location(field())))
  await denied(update(location(field()), { isPinned: true }))
  expect(await observed(field())).toEqual({ deleted: true, createdAt: n.createdAt })
})
it('rejects malformed HTML, impossible dates, immutable identity and unknown fields directly', async () => {
  await active(); await make()
  for (const patch of [{ title: '<tag>' }, { contentHtml: '<script>x</script>' }, { date: '1900-02-29' }, { createdAt: 0 }, { creation: 'a'.repeat(64) }, { extra: true }]) await denied(update(location(field()), patch))
  expect((await observed(field())).date).toBe('2024-02-29')
})
it('converts both historical sources independently and never from a read', async () => {
  await active()
  expect(await notes().getNotes(ctx())).toEqual([]); expect(await observed(bookNotesLegacyPath(ctx()))).toBeNull()
  for (const kind of ['note','review']) {
    const source = await notes().getLegacySource(ctx(), kind)
    const op = createNoteConversionOperation({ context: ctx(), expected: source.token, date: '2024-01-01' })
    await notes().convertLegacy(op); await notes(1).convertLegacy(op)
    const path = kind === 'note' ? bookNotesLegacyPath(ctx()) : bookReviewsLegacyPath(ctx())
    expect(await observed(path)).toMatchObject({ outcome: 'copied', sourceHtml: `Keep ${kind}` })
    expect(await observed(field(`legacy-${kind}-v1`))).toMatchObject({ contentHtml: `Keep ${kind}` })
  }
  expect(await notes().getNotes(ctx())).toHaveLength(2)
})
it('historical markers remain terminal after note deletion and reject incompatible retry', async () => {
  await active(); const source = await notes().getLegacySource(ctx(), 'note')
  const op = createNoteConversionOperation({ context: ctx(), expected: source.token, date: '2024-01-01' })
  await notes().convertLegacy(op)
  const n = await notes().getNote(ctx(), 'legacy-note-v1'); await notes().deleteNote(ctx(), n.id, n.token)
  await notes(1).convertLegacy(op)
  await expect(notes().convertLegacy(createNoteConversionOperation({ context: ctx(), expected: source.token, date: '2024-01-02' }))).rejects.toThrow('conversion-conflict')
  expect(await notes().getNotes(ctx())).toEqual([])
  await denied(remove(location(bookNotesLegacyPath(ctx()))))
  await denied(set(location(field('legacy-note-v1')), { ...n, token: null, id: null }))
})
it('handles empty sources once without creating a destination', async () => {
  await active(ctx(), 0, { note: '' })
  const source = await notes().getLegacySource(ctx(), 'note')
  await notes().convertLegacy(createNoteConversionOperation({ context: ctx(), expected: source.token, date: '2024-01-01' }))
  expect(await observed(bookNotesLegacyPath(ctx()))).toMatchObject({ outcome: 'empty' })
  expect(await observed(field('legacy-note-v1'))).toBeNull()
})
it('rejects changed source tokens and freezes legacy sources after activation', async () => {
  await active(); const source = await notes().getLegacySource(ctx(), 'note')
  const op = createNoteConversionOperation({ context: ctx(), expected: Object.freeze({ ...source.token, sourceVersion: '0'.repeat(64) }), date: '2024-01-01' })
  await expect(notes().convertLegacy(op)).rejects.toThrow('source-conflict')
  await denied(update(location(bookLibraryPath(ctx())), { note: 'Changed' }))
  await denied(update(location(bookLibraryPath(ctx())), { note: null }))
})
it('rejects reserved destinations without an atomic marker and source changes with conversion', async () => {
  await active(); await make(); const raw = await observed(field())
  await denied(set(location(field('legacy-note-v1')), raw))
  await denied(update(location(bookDataPath(ctx())), { 'bookNotesLegacy': { version: 1, sourceHtml: 'Keep note', outcome: 'copied', intent: raw.creation, processedAt: Date.now() }, 'bookNotes/legacy-note-v1': raw, 'library/note': 'Forged' }))
  expect(await observed(bookNotesLegacyPath(ctx()))).toBeNull()
})
it('keeps old operations in their captured generation after purge and readd', async () => {
  await active(); const n = await make(), old = ctx()
  const op = createNotePatchOperation({ context: old, entryId: 'n', payload: { title: 'Old write' }, expected: n.token })
  await life().deleteGeneration(old)
  expect(await observed(bookDataPath(old))).toBeNull()
  const next = await life().beginNextGeneration(old)
  await svc().initializeLibrary(next, record(next)); await life().activateGeneration(next)
  await notes().createNote(next, 'n', payload({ title: 'Next' }))
  await expect(notes(1).execute(op)).rejects.toThrow('stale-generation')
  expect((await observed(bookNotesPath(next, 'n'))).title).toBe('Next')
  expect(await observed(bookDataPath(old))).toBeNull()
})
it('durable lock rejects note writes and purge removes notes, tombstones and markers', async () => {
  await active(); const n = await make(); await make('t'); await notes().deleteNote(ctx(), 't', (await notes().getNote(ctx(),'t')).token)
  const source = await notes().getLegacySource(ctx(),'note')
  await notes().convertLegacy(createNoteConversionOperation({ context: ctx(), expected: source.token, date:'2024-01-01' }))
  await life().lockDeletion(ctx())
  await denied(update(location(field()), { isPinned: true }))
  await expect(notes().setPinned(ctx(), 'n', true, n.token)).rejects.toThrow('not-active')
  await life().purgeGeneration(ctx()); expect(await observed(bookDataPath(ctx()))).toBeNull()
})
it('isolates users and preserves other books', async () => {
  await active(); await make(); const another = ctx(1, uid, `${bookId}-other`)
  await active(another); await notes().createNote(another,'n',payload())
  await expect(notes(2).getNotes(ctx())).rejects.toThrow('owner-mismatch')
  await denied(set(location(field(),2), { deleted: true, createdAt: 0 }))
  await life().deleteGeneration(ctx()); expect((await observed(bookNotesPath(another,'n'))).title).toBe('Title')
})
it('denies ancestor writes and hostile atomic lock+note mutation', async () => {
  await active(); await make(); const before = await observed(bookDataPath(ctx()))
  await denied(set(location(bookDataPath(ctx())), before))
  await denied(update(location(`users/${uid}`), { [`bookLifecycle/${bookId}/state`]: 'deleting', [`bookData/${bookId}/1/bookNotes/n/isPinned`]: true }))
  expect(await observed(bookDataPath(ctx()))).toEqual(before)
  expect((await observed(bookLifecyclePath(ctx()))).state).toBe('active')
})
it('reconciles a lost creation acknowledgement by server evidence using the original ID', async () => {
  await active(); runTransaction.mockImplementationOnce(async (...args) => { await sdk.runTransaction(...args); throw new Error('simulated lost acknowledgement') })
  const op = createNoteCreateOperation({ context: ctx(), entryId:'stable', payload:payload() })
  await notes().execute(op); await notes(1).execute(op)
  expect((await notes().getNotes(ctx())).map(n=>n.id)).toEqual(['stable'])
})
it('does not replace IDs on a definite network error', async () => {
  await active(); runTransaction.mockRejectedValueOnce(new Error('simulated network failure'))
  await expect(notes().createNote(ctx(),'stable',payload())).rejects.toThrow('simulated network failure')
  expect(await notes().getNotes(ctx())).toEqual([])
})
it('rejects unavailable server evidence without trusting cached notes', async () => {
  await active(); await make(); vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
  await expect(notes().getNote(ctx(),'n')).rejects.toThrow('network-error')
})
it('rejects a queued SDK offline write after lock and purge', async () => {
  await active(); await make(); await get(location(field(),1))
  goOffline(clients[1].database)
  const queued = update(location(field(),1),{ isPinned:true }); const rejection = denied(queued)
  await life().deleteGeneration(ctx())
  const next=await life().beginNextGeneration(ctx()); await svc().initializeLibrary(next,record(next)); await life().activateGeneration(next)
  await notes().createNote(next,'n',payload({title:'New generation'}))
  goOnline(clients[1].database); await rejection
  expect(await observed(bookDataPath(ctx()))).toBeNull()
  expect((await observed(bookNotesPath(next,'n'))).isPinned).toBe(false)
})
it('reads and retries through a cold independent SDK cache', async () => {
  await active(); await make()
  await notes(1).createNote(ctx(),'n',payload())
  const n = await notes(1).getNote(ctx(),'n'); await notes(1).patchNote(ctx(),'n',{title:'Cold'},n.token)
  expect((await observed(field())).title).toBe('Cold')
})
it('sorts pin, civil date, creation and ID, with no 100-note cap', async () => {
  await active()
  for(let i=0;i<101;i++) await notes().createNote(ctx(),`n${String(i).padStart(3,'0')}`,payload())
  const first = await notes().getNote(ctx(),'n000'); await notes().setPinned(ctx(),'n000',true,first.token)
  const list=await notes().getNotes(ctx()); expect(list).toHaveLength(101); expect(list[0].id).toBe('n000')
},30000)
it('allows only one concurrent conflicting field patch', async()=>{
 await active();const n=await make()
 const results=await Promise.allSettled([notes().patchNote(ctx(),'n',{title:'A'},n.token),notes(1).patchNote(ctx(),'n',{title:'B'},n.token)])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
 expect(['A','B']).toContain((await observed(field())).title)
})
it('concurrent deletions converge on a single minimal tombstone',async()=>{
 await active();const n=await make()
 await Promise.all([notes().deleteNote(ctx(),'n',n.token),notes(1).deleteNote(ctx(),'n',n.token)])
 expect(await observed(field())).toEqual({deleted:true,createdAt:n.createdAt})
})
it('concurrent conversions converge and retain independent markers',async()=>{
 await active();const source=await notes().getLegacySource(ctx(),'note')
 const op=createNoteConversionOperation({context:ctx(),expected:source.token,date:'2024-01-01'})
 await Promise.all([notes().convertLegacy(op),notes(1).convertLegacy(op)])
 expect(await notes().getNotes(ctx())).toHaveLength(1)
 expect(await observed(bookReviewsLegacyPath(ctx()))).toBeNull()
})
it('rejects mutation plus purge in one multipath before the durable lock',async()=>{
 await active();await make()
 await denied(update(location(`users/${uid}`),{[`bookData/${bookId}/1`]:null,[`bookLifecycle/${bookId}`]:{generation:1,state:'deleted'}}))
 expect((await observed(field())).title).toBe('Title')
})
it('rejects creating state and protocol mutation in a note multipath',async()=>{
 await creating();await svc().initializeLibrary(ctx(),record())
 await expect(notes().createNote(ctx(),'n',payload())).rejects.toThrow('not-active')
 await life().activateGeneration(ctx());await make()
 await denied(update(location(`users/${uid}`),{'bookProtocol/state':'blocked',[`bookData/${bookId}/1/bookNotes/n/isPinned`]:true}))
 expect((await observed(field())).isPinned).toBe(false)
})
it('sanitizes formatted historical HTML using the existing runtime sanitizer',async()=>{
 await active(ctx(),0,{note:'<b>Bold</b><br>Text'})
 const storedSource=(await observed(bookLibraryPath(ctx()))).note
 const source=await notes().getLegacySource(ctx(),'note')
 await notes().convertLegacy(createNoteConversionOperation({context:ctx(),expected:source.token,date:'2024-01-01'}))
 expect((await observed(field('legacy-note-v1'))).contentHtml).toBe('BoldText')
 expect((await observed(bookNotesLegacyPath(ctx()))).sourceHtml).toBe(storedSource)
})
it('supports valid digit, Unicode and URL-looking note IDs without REST retargeting',async()=>{
 await active()
 for(const id of ['n000','note😀','n?%2F+&\\']) {
  await notes().createNote(ctx(),id,payload())
  expect((await notes().getNote(ctx(),id)).id).toBe(id)
  expect((await observed(bookNotesPath(ctx(),id))).title).toBe('Title')
 }
})
it('processes an absent historical source once without manufacturing content',async()=>{
 await active(ctx(),0,{note:null})
 const source=await notes().getLegacySource(ctx(),'note')
 await notes().convertLegacy(createNoteConversionOperation({context:ctx(),expected:source.token,date:'2024-01-01'}))
 expect(await observed(field('legacy-note-v1'))).toBeNull()
 expect(await observed(bookNotesLegacyPath(ctx()))).toMatchObject({outcome:'empty',sourceHtml:''})
})
it('enforces field revisions in rules against direct SDK stale content overwrites',async()=>{
 await active();await make();const original=await observed(field())
 await notes().patchNote(ctx(),'n',{title:'New'},(await notes().getNote(ctx(),'n')).token)
 await denied(update(location(field()),{title:'Unconditional',updatedAt:serverTimestamp()}))
 await denied(set(location(field()),{...original,updatedAt:serverTimestamp()}))
 await denied(update(location(field()),{'fieldRevisions/title':1}))
 await denied(update(location(field()),{'fieldRevisions/title':3}))
 await update(location(field()),{title:'Conditional',updatedAt:serverTimestamp(),'fieldRevisions/title':3})
 expect(await observed(field())).toMatchObject({title:'Conditional',fieldRevisions:{title:3,contentHtml:1,date:1}})
})
