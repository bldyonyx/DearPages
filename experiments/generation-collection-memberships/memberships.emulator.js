import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { bookDataPath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationCollectionMembershipService } from '../../src/services/generationCollectionMembershipService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { CATALOG_MAX_COUNTER } from '../../src/utils/generationCollectionCatalogModel.js'
import { createCollectionContext, createCollectionSelection, createMembershipOperation } from '../../src/utils/generationCollectionContracts.js'
import { collectionCatalogPath, bookCollectionMembershipsPath } from '../../src/utils/bookGenerationPaths.js'
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
const catalog = (client = 0) => clients[client].catalog
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
  await assertEmulatorProject()
  await assertEmulatorsReady()
  const email = `generation-memberships-${Date.now()}@example.test`, password = 'fictional-emulator-password'
  for (let index = 0; index < 5; index++) {
    const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
      databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `generation-memberships-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, '127.0.0.1', 9000)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if ([1, 4].includes(index)) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid
    clients.push({ app, auth, database, members: createGenerationCollectionMembershipService(database), catalog: createGenerationCollectionCatalogService(database), library: createGenerationLibraryService(database), lifecycle: createBookLifecycleService(database) })
  }
  await life().initializeProtocol(ctx(1, uid, 'bootstrap'))
  await life(2).initializeProtocol(ctx(1, otherUid, 'bootstrap'))
})
beforeEach(() => {
  bookId = `fictional-memberships-${++sequence}`
  runTransaction.mockReset().mockImplementation(sdk.runTransaction)
})
afterEach(() => { vi.unstubAllGlobals(); for (const client of clients) goOnline(client.database) })
afterAll(async () => { for (const client of clients) { goOffline(client.database); await deleteApp(client.app) } })

const members=(client=0)=>clients[client].members
const scope=(epoch=1,id=`c-${bookId}`,owner=uid)=>createCollectionContext({uid:owner,collectionId:id,epoch})
const path=(context=ctx(),collection=scope())=>bookCollectionMembershipsPath(context,collection.collectionId)
const intent=(kind,expected=null,context=ctx(),collection=scope())=>createMembershipOperation({context,collection,intent:kind,expected})
const opId='-1234567890123456789'
const setup=async()=>{await active();await catalog().createCollection(scope(),{name:'Collection'});return {context:ctx(),collection:scope()}}
const current=()=>members().getMembership(ctx(),scope())
const add=async()=>{await members().addBook(ctx(),scope());return current()}
const clear=async()=>{const r=await catalog().getCollection(scope());return catalog().clearCollection(r.context,opId,r.token)}
const removeCollection=async()=>{const r=await catalog().getCollection(scope());return catalog().deleteCollection(r.context,r.token)}
async function adminPut(target,value){
 const response=await fetch(`http://127.0.0.1:9000/${target.split('/').map(encodeURIComponent).join('/')}.json?ns=demo-dear-pages`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(value),redirect:'error'})
 expect(response.ok).toBe(true)
}
it('fails closed for non-demo construction',()=>expect(()=>createGenerationCollectionMembershipService({app:{options:{projectId:'other'}}})).toThrow('emulator-only'))
it('adds only the compact membership schema and exposes a frozen acknowledged token',async()=>{
 await setup();const r=await add();expect(r.effective).toBe(true);expect(Object.isFrozen(r.token.membership)).toBe(true)
 expect(await observed(path())).toEqual({epoch:1,present:true,revision:1});expect((await members().getBookMemberships(ctx())).effective).toHaveLength(1)
})
it('repeats the original add without incrementing revision or allocating any new identity',async()=>{
 await setup();const op=intent('add');await members().execute(op);await members(1).execute(op);await members().reconcile(op)
 expect(await observed(path())).toEqual({epoch:1,present:true,revision:1})
})
it('converges two simultaneous first adds',async()=>{
 await setup();await Promise.all([members().execute(intent('add')),members(1).execute(intent('add'))]);expect(await observed(path())).toEqual({epoch:1,present:true,revision:1})
})
it('removes logically, reconciles the same removal, and preserves the node',async()=>{
 await setup();const r=await add(),op=intent('remove',r.token);await members().execute(op);await members(1).execute(op)
 const raw=await observed(path());expect(raw).toEqual({epoch:1,present:false,revision:2});const now=await current();expect(now.effective).toBe(false);expect(now.token.membership).toEqual(raw)
})
it('refuses a delayed initial add after removal and permits explicit readd with a fresh token',async()=>{
 await setup();const old=intent('add'),r=await add();await members().removeBook(ctx(),scope(),r.token)
 await expect(members(1).execute(old)).rejects.toThrow('membership-conflict');expect((await observed(path())).present).toBe(false)
 const removed=await current();await members().addBook(ctx(),scope(),removed.token);expect(await observed(path())).toEqual({epoch:1,present:true,revision:3})
})
it('refuses stale removal after readd, even though boolean presence returned to true',async()=>{
 await setup();const r=await add(),old=intent('remove',r.token);await members().execute(old)
 await members().addBook(ctx(),scope(),(await current()).token)
 await expect(members(1).execute(old)).rejects.toThrow('revision-conflict');expect(await observed(path())).toEqual({epoch:1,present:true,revision:3})
})
it('keeps no-op assignments at the same revision and validates their captured snapshot',async()=>{
 await setup();const r=await add();const noOp=intent('add',r.token);expect(noOp.changes).toBe(false);await members().execute(noOp)
 await members().removeBook(ctx(),scope(),r.token);await expect(members().execute(noOp)).rejects.toThrow('revision-conflict')
 expect(await observed(path())).toEqual({epoch:1,present:false,revision:2})
})
it('converges two removals from the same acknowledged revision',async()=>{
 await setup();const r=await add();await Promise.all([members().execute(intent('remove',r.token)),members(1).execute(intent('remove',r.token))])
 expect(await observed(path())).toEqual({epoch:1,present:false,revision:2})
})
it('races an add no-op with removal without reactivating the removed row',async()=>{
 await setup();const r=await add();const results=await Promise.allSettled([members().execute(intent('add',r.token)),members(1).execute(intent('remove',r.token))])
 expect(results[1].status).toBe('fulfilled');expect(await observed(path())).toEqual({epoch:1,present:false,revision:2})
})
it('races a remove no-op with an explicit readd without losing the new revision',async()=>{
 await setup();const r=await add();await members().removeBook(ctx(),scope(),r.token);const removed=await current()
 const results=await Promise.allSettled([members().execute(intent('remove',removed.token)),members(1).execute(intent('add',removed.token))])
 expect(results[1].status).toBe('fulfilled');expect(await observed(path())).toEqual({epoch:1,present:true,revision:3})
})
it.each(['to-read','reading','abandoned'])('permits membership writes in book status %s',async status=>{
 await setup();await svc().updateBookStatus(ctx(),status);await add();expect((await observed(path())).present).toBe(true)
})
it('requires real book and Collection scopes and never creates a missing Collection implicitly',async()=>{
 await active();const result=await current();expect(result.reason).toBe('collection-not-found');expect(result.effective).toBe(false)
 await expect(members().execute(intent('add'))).rejects.toThrow('collection-not-found');expect(await observed(path())).toBeNull()
})
it('refuses an absent book even for an existing Collection',async()=>{
 await catalog().createCollection(scope(),{name:'Collection'});expect((await current()).reason).toBe('book-not-found')
 await expect(members().execute(intent('add'))).rejects.toThrow('book-not-found');expect(await observed(path())).toBeNull()
})
it('refuses a creating book before and after library initialization, including hostile atomic activation',async()=>{
 await catalog().createCollection(scope(),{name:'Collection'});await creating();await expect(members().execute(intent('add'))).rejects.toThrow('book-not-active')
 await svc().initializeLibrary(ctx(),record());await expect(members().execute(intent('add'))).rejects.toThrow('book-not-active')
 await denied(update(location(`users/${uid}`),{[`bookLifecycle/${bookId}/state`]:'active',[`bookData/${bookId}/1/collectionMemberships/${scope().collectionId}`]:{epoch:1,present:true,revision:1}}))
 expect(await observed(path())).toBeNull();await life().activateGeneration(ctx());await add();expect((await observed(path())).present).toBe(true)
})
it('fails closed on an active but missing library fixture',async()=>{
 await setup();await adminPut(`${bookDataPath(ctx())}/library`,null)
 await expect(members().execute(intent('add'))).rejects.toThrow('library-missing');await denied(set(location(path()),{epoch:1,present:true,revision:1}));expect(await observed(path())).toBeNull()
})
it('blocks writes after durable deleting lock and purges all membership nodes with the book',async()=>{
 await setup();const r=await add();await life().lockDeletion(ctx());expect((await current()).effective).toBe(false)
 await expect(members().removeBook(ctx(),scope(),r.token)).rejects.toThrow('book-not-active')
 await denied(update(location(path()),{present:false,revision:2}));await life().purgeGeneration(ctx())
 expect(await observed(bookDataPath(ctx()))).toBeNull();expect((await current()).effective).toBe(false)
})
it('never copies memberships after deleting and readding the same book',async()=>{
 await setup();const r=await add(),old=intent('remove',r.token),previous=ctx();await life().deleteGeneration(previous)
 const next=await life().beginNextGeneration(previous);await svc().initializeLibrary(next,record(next));await life().activateGeneration(next)
 expect((await members().getBookMemberships(next)).effective).toEqual([]);expect((await members().getMembership(previous,scope())).reason).toBe('stale-generation')
 await expect(members(1).execute(old)).rejects.toThrow('stale-generation');expect(await observed(path(next))).toBeNull();expect(await observed(bookDataPath(previous))).toBeNull()
})
it('treats old-epoch stored presence as absent after logical clear without physical cleanup',async()=>{
 await setup();await add();const before=await observed(path()),cleared=await clear()
 expect(await observed(path())).toEqual(before);expect((await current()).effective).toBe(false)
 const fresh=await members().getMembership(ctx(),cleared.context);expect(fresh.reason).toBeNull();expect(fresh.token).toBeNull();expect(fresh.raw).toEqual(before);expect(fresh.effective).toBe(false)
 expect((await members().getBookMemberships(ctx())).effective).toEqual([])
})
it('requires an explicit new-epoch add, with a revision scoped to the new epoch',async()=>{
 await setup();const original=intent('add'),r=await add();await members().removeBook(ctx(),scope(),r.token);const cleared=await clear()
 await expect(members().execute(original)).rejects.toThrow('stale-epoch')
 await members().addBook(ctx(),cleared.context,null);expect(await observed(path())).toEqual({epoch:2,present:true,revision:1})
 expect((await members().getMembership(ctx(),cleared.context)).effective).toBe(true)
})
it('never reactivates residual memberships after terminal Collection deletion',async()=>{
 await setup();const r=await add(),before=await observed(path());await removeCollection()
 expect((await current()).reason).toBe('collection-deleted');expect((await current()).effective).toBe(false)
 await expect(members().removeBook(ctx(),scope(),r.token)).rejects.toThrow('collection-deleted');await denied(update(location(path()),{present:false,revision:2}))
 expect(await observed(path())).toEqual(before);expect((await members().getBookMemberships(ctx())).effective).toEqual([])
})
it('cannot bootstrap Collection and membership in one hostile multipath request',async()=>{
 await active();const catalogBody={name:'Collection',description:'',icon:'library',pinned:false,revision:1,membershipEpoch:1,fieldRevisions:{name:1,description:1,icon:1,pinned:1},creation:'a'.repeat(64),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}
 await denied(update(location(`users/${uid}`),{[`collectionCatalog/${scope().collectionId}`]:catalogBody,[`bookData/${bookId}/1/collectionMemberships/${scope().collectionId}`]:{epoch:1,present:true,revision:1}}))
 expect(await observed(path())).toBeNull();expect(await observed(collectionCatalogPath(uid,scope().collectionId))).toBeNull()
})
it('races first add with logical clear and reports only effective memberships under the current epoch',async()=>{
 await setup();const r=await catalog().getCollection(scope());await Promise.allSettled([members().execute(intent('add')),catalog(1).clearCollection(scope(),opId,r.token)])
 const catalogNow=await catalog().getCatalog(uid);const c=catalogNow.find(c=>c.id===scope().collectionId);expect(c.membershipEpoch).toBe(2)
 const raw=await observed(path());expect(raw===null||raw.epoch===1).toBe(true);expect((await members().getMembership(ctx(),c.context)).effective).toBe(false)
})
it('races first add with Collection deletion without an active residual membership',async()=>{
 await setup();const c=await catalog().getCollection(scope());await Promise.allSettled([members().execute(intent('add')),catalog(1).deleteCollection(c.context,c.token)])
 expect((await observed(collectionCatalogPath(uid,c.id))).deleted).toBe(true);expect((await current()).effective).toBe(false)
 const raw=await observed(path());expect(raw===null||sameRow(raw,{epoch:1,present:true,revision:1})).toBe(true)
})
function sameRow(a,b){return a.epoch===b.epoch&&a.present===b.present&&a.revision===b.revision}
it('rejects clear+new-epoch membership and deletion+membership mutation in atomic hostile updates',async()=>{
 await setup();await add();const c=await catalog().getCollection(scope()),before=await observed(path())
 await denied(update(location(`users/${uid}`),{[`collectionCatalog/${c.id}/membershipEpoch`]:2,[`collectionCatalog/${c.id}/lastClearId`]:opId,[`collectionCatalog/${c.id}/lastClearFrom`]:1,[`collectionCatalog/${c.id}/revision`]:2,[`bookData/${bookId}/1/collectionMemberships/${c.id}`]:{epoch:2,present:true,revision:1}}))
 await denied(update(location(`users/${uid}`),{[`collectionCatalog/${c.id}`]:{deleted:true,createdAt:c.createdAt,membershipEpoch:1,revision:2},[`bookData/${bookId}/1/collectionMemberships/${c.id}`]:{epoch:1,present:false,revision:2}}))
 expect(await observed(path())).toEqual(before);expect((await catalog().getCollection(scope())).membershipEpoch).toBe(1)
})
it('rejects lock+membership mutation and active ancestor replacement',async()=>{
 await setup();await add();const before=await observed(path())
 await denied(update(location(`users/${uid}`),{[`bookLifecycle/${bookId}/state`]:'deleting',[`bookData/${bookId}/1/collectionMemberships/${scope().collectionId}`]:{epoch:1,present:false,revision:2}}))
 await denied(set(location(bookDataPath(ctx())),await observed(bookDataPath(ctx()))));await denied(set(location(bookCollectionMembershipsPath(ctx())),{[scope().collectionId]:before}))
 expect(await observed(path())).toEqual(before)
})
it.each([{revision:0},{revision:3},{present:false},{epoch:2},{revision:2},{metadata:{name:'private'}}])('enforces schema and exact CAS at the row boundary for SDK patches %#',async patch=>{
 await setup();await add();const before=await observed(path());await denied(update(location(path()),patch));expect(await observed(path())).toEqual(before)
})
it('refuses null deletion and delayed revival, while permitting a genuine newer readd',async()=>{
 await setup();await add();await denied(remove(location(path())));await update(location(path()),{present:false,revision:2})
 await denied(remove(location(path())));await denied(set(location(path()),{epoch:1,present:true,revision:1}))
 await update(location(path()),{present:true,revision:3});expect(await observed(path())).toEqual({epoch:1,present:true,revision:3})
})
it('rejects a multi-book hostile update atomically when one target book is locked',async()=>{
 await setup();const other=ctx(1,uid,`${bookId}-other`);await active(other);await life().lockDeletion(other)
 await denied(update(location(`users/${uid}`),{[path().slice(`users/${uid}/`.length)]:{epoch:1,present:true,revision:1},[path(other).slice(`users/${uid}/`.length)]:{epoch:1,present:true,revision:1}}))
 expect(await observed(path())).toBeNull();expect(await observed(path(other))).toBeNull()
})
it('checks selections with immutable original scopes and detects changed revisions',async()=>{
 await setup();const r=await add();const selection=createCollectionSelection({collection:scope(),entries:[{context:ctx(),expected:r.token}]})
 expect(await members().verifySelection(selection)).toEqual(selection);await members().removeBook(ctx(),scope(),r.token)
 await expect(members().verifySelection(selection)).rejects.toThrow();expect(selection.entries[0].expected.membership.revision).toBe(1)
})
it('invalidates even an empty selection after clear and a book selection after readd',async()=>{
 await setup();const empty=createCollectionSelection({collection:scope(),entries:[]});await clear();await expect(members().verifySelection(empty)).rejects.toThrow('stale-epoch')
})
it('rejects a selection whose captured book generation was deleted and readded',async()=>{
 await setup();const r=await add(),selection=createCollectionSelection({collection:scope(),entries:[{context:ctx(),expected:r.token}]})
 await life().deleteGeneration(ctx());const next=await life().beginNextGeneration(ctx());await svc().initializeLibrary(next,record(next));await life().activateGeneration(next)
 await expect(members().verifySelection(selection)).rejects.toThrow('stale-generation');expect((await members().getBookMemberships(next)).effective).toEqual([])
})
it('reconciles lost add/remove acknowledgements on independent cold SDK clients',async()=>{
 await setup();const first=intent('add')
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await members(1).execute(first);await members().reconcile(first);const r=await current(),last=intent('remove',r.token)
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await members().execute(last);await members(1).reconcile(last);expect(await observed(path())).toEqual({epoch:1,present:false,revision:2})
})
it('never substitutes an ID/context or trusts cached data after a definite network error',async()=>{
 await setup();runTransaction.mockRejectedValueOnce(new Error('simulated write failure'))
 await expect(members().execute(intent('add'))).rejects.toThrow('simulated write failure');expect(await observed(path())).toBeNull()
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(current()).rejects.toThrow('network-error')
})
it('rejects a real offline queued old-generation write after readd',async()=>{
 await setup();const r=await add();await get(location(path(),1));goOffline(clients[1].database)
 const rejection=denied(update(location(path(),1),{present:false,revision:2}));await life().deleteGeneration(ctx())
 const next=await life().beginNextGeneration(ctx());await svc().initializeLibrary(next,record(next));await life().activateGeneration(next);goOnline(clients[1].database);await rejection
 expect(await observed(path())).toBeNull();expect(await observed(path(next))).toBeNull();expect(r.context.generation).toBe(1)
})
it('rejects a real offline queued add after logical clear',async()=>{
 await setup();goOffline(clients[1].database);const rejection=denied(set(location(path(),1),{epoch:1,present:true,revision:1}))
 await clear();goOnline(clients[1].database);await rejection;expect(await observed(path())).toBeNull()
})
it('rejects a real offline queued add after terminal Collection deletion',async()=>{
 await setup();goOffline(clients[1].database);const rejection=denied(set(location(path(),1),{epoch:1,present:true,revision:1}))
 await removeCollection();goOnline(clients[1].database);await rejection;expect(await observed(path())).toBeNull()
})
it('isolates owners and preserves other books and Collections during purge',async()=>{
 await setup();await add();const otherBook=ctx(1,uid,`${bookId}-other`),otherCollection=scope(1,`other-${bookId}`)
 await active(otherBook);await catalog().createCollection(otherCollection,{name:'Other'});await members().addBook(otherBook,otherCollection)
 await expect(members(2).getMembership(ctx(),scope())).rejects.toThrow('owner-mismatch');await denied(set(location(path(),2),{epoch:1,present:true,revision:1}))
 const before=await observed(path(otherBook,otherCollection));await life().deleteGeneration(ctx());expect(await observed(path(otherBook,otherCollection))).toEqual(before)
 expect((await catalog().getCollection(otherCollection)).name).toBe('Other')
})
it('detects a raced clear during a multi-node effective read instead of treating old raw presence as active',async()=>{
 await setup();await add();const originalFetch=globalThis.fetch;let triggered=false
 vi.stubGlobal('fetch',async(...args)=>{const response=await originalFetch(...args);const url=new URL(args[0]);if(!triggered&&decodeURIComponent(url.pathname).includes('/collectionMemberships/')){triggered=true;await clear()}return response})
 const result=await current();expect(result.raw.present).toBe(true);expect(result.effective).toBe(false);expect(result.reason).toBe('stale-epoch')
})
it('handles maximum scoped revision without resetting, but permits an explicit new-epoch initialization',async()=>{
 await setup();await add();await adminPut(path(),{epoch:1,present:true,revision:CATALOG_MAX_COUNTER})
 const r=await current();await expect(members().removeBook(ctx(),scope(),r.token)).rejects.toThrow(RangeError)
 await denied(update(location(path()),{present:false,revision:CATALOG_MAX_COUNTER+1}));expect((await observed(path())).revision).toBe(CATALOG_MAX_COUNTER)
 const next=await clear();await members().addBook(ctx(),next.context,null);expect(await observed(path())).toEqual({epoch:2,present:true,revision:1})
})
it('requires owner protocol ready before and after SDK writes',async()=>{
 await setup();const before=await observed(path())
 await denied(update(location(`users/${uid}`),{'bookProtocol/state':'blocked',[`bookData/${bookId}/1/collectionMemberships/${scope().collectionId}`]:{epoch:1,present:true,revision:1}}))
 expect(await observed(path())).toEqual(before)
})
