import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { bookDataPath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { createCatalogOperation, CATALOG_LAST_LIVE_REVISION, CATALOG_MAX_COUNTER } from '../../src/utils/generationCollectionCatalogModel.js'
import { createCollectionContext, createCollectionSelection, assertCollectionSelectionCurrent } from '../../src/utils/generationCollectionContracts.js'
import { collectionCatalogPath } from '../../src/utils/bookGenerationPaths.js'
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
  const email = `generation-catalog-${Date.now()}@example.test`, password = 'fictional-emulator-password'
  for (let index = 0; index < 5; index++) {
    const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
      databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `generation-catalog-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, '127.0.0.1', 9000)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if ([1, 4].includes(index)) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid
    clients.push({ app, auth, database, catalog: createGenerationCollectionCatalogService(database), library: createGenerationLibraryService(database), lifecycle: createBookLifecycleService(database) })
  }
  await life().initializeProtocol(ctx(1, uid, 'bootstrap'))
  await life(2).initializeProtocol(ctx(1, otherUid, 'bootstrap'))
})
beforeEach(() => {
  bookId = `fictional-catalog-${++sequence}`
  runTransaction.mockReset().mockImplementation(sdk.runTransaction)
})
afterEach(() => { vi.unstubAllGlobals(); for (const client of clients) goOnline(client.database) })
afterAll(async () => { for (const client of clients) { goOffline(client.database); await deleteApp(client.app) } })

const scope=(epoch=1,collectionId=bookId,owner=uid)=>createCollectionContext({uid:owner,collectionId,epoch})
const path=(context=scope())=>collectionCatalogPath(context.uid,context.collectionId)
const opId='-1234567890123456789',otherOpId='-2234567890123456789'
const metadata=extra=>({name:'  Favorites  ',description:'  Read again  ',icon:'heart',...extra})
const make=async(context=scope(),extra={})=>{await catalog().createCollection(context,metadata(extra));return catalog().getCollection(context)}
const clearIntent=r=>createCatalogOperation({type:'catalog.clear',context:r.context,payload:{},expected:r.token,operationId:opId})
async function adminSeed(context,record){
 const url=`http://127.0.0.1:9000/${path(context).split('/').map(encodeURIComponent).join('/')}.json?ns=demo-dear-pages`
 const response=await fetch(url,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(record),redirect:'error'})
 expect(response.ok).toBe(true)
}
it('refuses non-demo construction before references are opened',()=>{
 expect(()=>createGenerationCollectionCatalogService({app:{options:{projectId:'other'}}})).toThrow('emulator-only')
})
it('creates normalized metadata with no books and immutable acknowledged token',async()=>{
 const r=await make();expect(r).toMatchObject({name:'Favorites',description:'Read again',icon:'heart',pinned:false,membershipEpoch:1,revision:1})
 expect(await observed(path())).not.toHaveProperty('books');expect(Object.isFrozen(r.token.fieldRevisions)).toBe(true)
 expect((await catalog().getCatalog(uid)).some(c=>c.id===bookId)).toBe(true)
})
it('replays identical creation and refuses incompatible initial intent',async()=>{
 const r=await make();await catalog(1).createCollection(scope(),metadata())
 await expect(catalog().createCollection(scope(),metadata({name:'Other'}))).rejects.toThrow('creation-conflict')
 expect((await observed(path())).createdAt).toBe(r.createdAt);expect((await observed(path())).revision).toBe(1)
})
it('retains captured creation identity after metadata edits without restoring original metadata',async()=>{
 const r=await make();await catalog().updateMetadata(scope(),{name:'Edited'},r.token)
 await catalog(1).createCollection(scope(),metadata())
 expect((await observed(path())).name).toBe('Edited');expect((await observed(path())).revision).toBe(2)
})
it('chooses one incompatible concurrent creator',async()=>{
 const results=await Promise.allSettled([catalog().createCollection(scope(),metadata()),catalog(1).createCollection(scope(),metadata({name:'Other'}))])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(['Favorites','Other']).toContain((await observed(path())).name)
})
it('merges independent metadata changes using real SDK transactions',async()=>{
 const r=await make();await Promise.all([catalog().updateMetadata(scope(),{name:'New name'},r.token),catalog(1).updateMetadata(scope(),{description:'New description'},r.token)])
 expect(await observed(path())).toMatchObject({name:'New name',description:'New description',revision:3,fieldRevisions:{name:2,description:2,icon:1,pinned:1}})
})
it('allows concurrent pin and metadata changes and counts pin as activity',async()=>{
 const r=await make();await Promise.all([catalog().setPinned(scope(),true,r.token),catalog(1).updateMetadata(scope(),{description:'New'},r.token)])
 expect(await observed(path())).toMatchObject({pinned:true,description:'New',revision:3});expect((await observed(path())).updatedAt).toBeGreaterThanOrEqual(r.updatedAt)
})
it('refuses stale same-field edits even if content returns to its previous value',async()=>{
 const r=await make();await catalog().updateMetadata(scope(),{name:'Other'},r.token)
 const latest=await catalog().getCollection(scope());await catalog().updateMetadata(scope(),{name:r.name},latest.token)
 await expect(catalog(1).updateMetadata(scope(),{name:'Stale'},r.token)).rejects.toThrow('field-conflict')
 expect((await observed(path())).name).toBe(r.name)
})
it('allows one conflicting concurrent edit or pin per captured field revision',async()=>{
 const r=await make();const result=await Promise.allSettled([catalog().setPinned(scope(),true,r.token),catalog(1).setPinned(scope(),false,r.token)])
 expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await observed(path())).fieldRevisions.pinned).toBe(2)
})
it('guards partial SDK writes, counter resets and revision jumps at the record boundary',async()=>{
 await make();const before=await observed(path())
 for(const patch of [{name:'Unsafe',revision:2,updatedAt:serverTimestamp()},{revision:3,updatedAt:serverTimestamp()},{'fieldRevisions/name':0,revision:2,updatedAt:serverTimestamp()},{createdAt:0,revision:2,updatedAt:serverTimestamp()},{books:{book:true},revision:2,updatedAt:serverTimestamp()}]) await denied(update(location(path()),patch))
 expect(await observed(path())).toEqual(before)
})
it('accepts long metadata and unknown string icons without introducing business size limits',async()=>{
 await make(scope(),{name:'x'.repeat(1000),description:'y'.repeat(5000),icon:'historic-custom-icon'})
 expect((await observed(path())).name).toHaveLength(1000);expect((await observed(path())).icon).toBe('historic-custom-icon')
})
it.each([{name:''},{name:'   '},{description:42},{pinned:'yes'},{icon:''},{extra:true}])('rejects invalid metadata schema directly %#',async patch=>{
 await make();const before=await observed(path());await denied(update(location(path()),{...patch,revision:2,updatedAt:serverTimestamp(),'fieldRevisions/name':2}));expect(await observed(path())).toEqual(before)
})
it('clears once using the deterministic captured epoch successor',async()=>{
 const r=await make(),op=clearIntent(r);const result=await catalog().execute(op)
 expect(result.context.epoch).toBe(2);expect(op.context.epoch).toBe(1);expect(result.collection.updatedAt).toBe(r.updatedAt)
 expect(await observed(path())).toMatchObject({membershipEpoch:2,lastClearFrom:1,lastClearId:opId,revision:2,name:r.name})
 await catalog(1).execute(op);expect((await observed(path())).revision).toBe(2);expect((await observed(path())).membershipEpoch).toBe(2)
})
it('does not clear twice after newer metadata activity and invalidates captured old selections locally',async()=>{
 const r=await make(),op=clearIntent(r),oldSelection=createCollectionSelection({collection:r.context,entries:[]})
 const cleared=await catalog().execute(op);await catalog(1).updateMetadata(cleared.context,{name:'Recent activity'},cleared.collection.token)
 const before=await observed(path());await catalog().execute(op);expect(await observed(path())).toEqual(before)
 const newSelection=createCollectionSelection({collection:cleared.context,entries:[]});expect(()=>assertCollectionSelectionCurrent(oldSelection,newSelection)).toThrow()
})
it('allows one distinct concurrent clear intent and never skips epochs',async()=>{
 const r=await make();const results=await Promise.allSettled([catalog().clearCollection(scope(),opId,r.token),catalog(1).clearCollection(scope(),otherOpId,r.token)])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await observed(path())).membershipEpoch).toBe(2)
})
it('converges two executions of the same clear intent',async()=>{
 const r=await make(),op=clearIntent(r);await Promise.all([catalog().execute(op),catalog(1).execute(op)])
 expect(await observed(path())).toMatchObject({membershipEpoch:2,revision:2,lastClearId:opId})
})
it('rejects an old clear replay after a newer clear, with no counter change',async()=>{
 const r=await make(),old=clearIntent(r);const next=await catalog().execute(old)
 await catalog().clearCollection(next.context,otherOpId,next.collection.token);const before=await observed(path())
 await expect(catalog(1).execute(old)).rejects.toThrow('stale-epoch');expect(await observed(path())).toEqual(before)
})
it('preserves a concurrent metadata edit when clear commits afterwards',async()=>{
 const r=await make();await catalog(1).updateMetadata(scope(),{name:'Keep edit'},r.token)
 await catalog().execute(clearIntent(r));expect(await observed(path())).toMatchObject({name:'Keep edit',membershipEpoch:2,revision:3})
})
it('refuses old epoch metadata and deletion after a clear',async()=>{
 const r=await make();await catalog().execute(clearIntent(r));const before=await observed(path())
 await expect(catalog().updateMetadata(scope(),{name:'Old'},r.token)).rejects.toThrow('stale-epoch')
 await expect(catalog().deleteCollection(scope(),r.token)).rejects.toThrow('stale-epoch');expect(await observed(path())).toEqual(before)
})
it('enforces exact epoch, clear marker and metadata separation against hostile SDK writes',async()=>{
 await make();const before=await observed(path())
 for(const patch of [{membershipEpoch:2},{membershipEpoch:3,lastClearFrom:2,lastClearId:opId},{membershipEpoch:2,lastClearFrom:1,lastClearId:opId,name:'Hostile','fieldRevisions/name':2},{lastClearId:opId,lastClearFrom:1},{membershipEpoch:0}]) await denied(update(location(path()),{...patch,revision:2,updatedAt:serverTimestamp()}))
 expect(await observed(path())).toEqual(before)
})
it('makes terminal deletion content-free and prohibits reuse forever',async()=>{
 const r=await make();await catalog().deleteCollection(scope(),r.token);const tombstone={deleted:true,createdAt:r.createdAt,membershipEpoch:1,revision:2}
 expect(await observed(path())).toEqual(tombstone);expect(await catalog().getCollection(scope())).toBeNull()
 expect((await catalog().getCatalog(uid)).some(c=>c.id===bookId)).toBe(false)
 await catalog(1).deleteCollection(scope(),r.token)
 await expect(catalog().createCollection(scope(),metadata())).rejects.toThrow('creation-conflict')
 await denied(remove(location(path())));await denied(set(location(path()),{...tombstone,revision:3}));expect(await observed(path())).toEqual(tombstone)
})
it('rejects stale deletion after metadata changes and converges simultaneous deletion',async()=>{
 const r=await make();await catalog().updateMetadata(scope(),{name:'Updated'},r.token)
 await expect(catalog().deleteCollection(scope(),r.token)).rejects.toThrow('revision-conflict')
 const current=await catalog().getCollection(scope());await Promise.all([catalog().deleteCollection(scope(),current.token),catalog(1).deleteCollection(scope(),current.token)])
 expect((await observed(path())).deleted).toBe(true)
})
it('races deletion and clear without resurrecting metadata or losing terminal identity',async()=>{
 const r=await make();const results=await Promise.allSettled([catalog().deleteCollection(scope(),r.token),catalog(1).execute(clearIntent(r))])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const stored=await observed(path())
 expect(stored.deleted===true||stored.membershipEpoch===2).toBe(true)
 if(stored.deleted)expect(stored).not.toHaveProperty('name')
})
it('preserves other collections and all books when clearing and deleting',async()=>{
 const r=await make(),other=scope(1,`${bookId}-other`);await make(other)
 await active();const before=await observed(bookDataPath(ctx()))
 const cleared=await catalog().execute(clearIntent(r));await catalog().deleteCollection(cleared.context,cleared.collection.token)
 expect(await observed(bookDataPath(ctx()))).toEqual(before);expect((await catalog().getCollection(other)).name).toBe('Favorites')
})
it('does not implement or permit membership writes in this experiment',async()=>{
 await make();await active()
 await denied(set(location(`${bookDataPath(ctx())}/collectionMemberships/${bookId}`),{epoch:1,present:true,revision:1}))
 expect(await observed(`${bookDataPath(ctx())}/collectionMemberships`)).toBeNull()
})
it('reconciles lost create and clear acknowledgements using only the captured intent',async()=>{
 const create=createCatalogOperation({type:'catalog.create',context:scope(),payload:metadata()})
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await catalog(1).execute(create);const r=await catalog(1).getCollection(scope()),op=clearIntent(r)
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await catalog().execute(op);await catalog(1).execute(op);await catalog().reconcile(op)
 expect(await observed(path())).toMatchObject({membershipEpoch:2,revision:2})
})
it('keeps definite network errors visible and uses no replacement collection ID',async()=>{
 runTransaction.mockRejectedValueOnce(new Error('simulated write failure'))
 await expect(catalog().createCollection(scope(),metadata())).rejects.toThrow('simulated write failure');expect(await observed(path())).toBeNull()
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(catalog().getCollection(scope())).rejects.toThrow('network-error')
})
it('handles cold caches and independent patches without overwriting fields',async()=>{
 const r=await make();await catalog(1).updateMetadata(scope(),{icon:'moon'},r.token)
 await catalog().updateMetadata(scope(),{description:'Independent'},r.token)
 expect(await observed(path())).toMatchObject({icon:'moon',description:'Independent',revision:3})
})
it('denies a real offline queued edit after deletion and never resurrects its ID',async()=>{
 const r=await make();await get(location(path(),1));goOffline(clients[1].database)
 const rejection=denied(update(location(path(),1),{name:'Offline',revision:2,'fieldRevisions/name':2,updatedAt:serverTimestamp()}))
 await catalog().deleteCollection(scope(),r.token);goOnline(clients[1].database);await rejection
 expect((await observed(path())).deleted).toBe(true)
})
it('denies a real offline queued clear after an acknowledged newer clear',async()=>{
 const r=await make();await get(location(path(),1));goOffline(clients[1].database)
 const rejection=denied(update(location(path(),1),{membershipEpoch:2,lastClearFrom:1,lastClearId:opId,revision:2,updatedAt:serverTimestamp()}))
 await catalog().clearCollection(scope(),otherOpId,r.token);const before=await observed(path());goOnline(clients[1].database);await rejection
 expect(await observed(path())).toEqual(before)
})
it('isolates owners and denies ancestor replacement and protocol multipath attacks',async()=>{
 await make();const before=await observed(path())
 await expect(catalog(2).getCatalog(uid)).rejects.toThrow('owner-mismatch');await denied(get(location(path(),2)))
 await denied(set(location(path(),2),before));await denied(set(location(`users/${uid}/collectionCatalog`),{[bookId]:before}))
 await denied(update(location(`users/${uid}`),{'bookProtocol/state':'blocked',[`collectionCatalog/${bookId}/pinned`]:true,[`collectionCatalog/${bookId}/fieldRevisions/pinned`]:2,[`collectionCatalog/${bookId}/revision`]:2,[`collectionCatalog/${bookId}/updatedAt`]:serverTimestamp()}))
 expect(await observed(path())).toEqual(before)
})
it('requires a previously ready protocol and cannot bootstrap protocol and collection atomically',async()=>{
 await make();const valid=await observed(path())
 const newUid=(await createUserWithEmailAndPassword(clients[3].auth,`catalog-unready-${Date.now()}@example.test`,'fictional-emulator-password')).user.uid
 const c=scope(1,bookId,newUid)
 await expect(catalog(3).createCollection(c,metadata())).rejects.toThrow('protocol-not-ready')
 await denied(set(location(path(c),3),{...valid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await denied(update(location(`users/${newUid}`,3),{'bookProtocol':{version:2,state:'ready'},[`collectionCatalog/${bookId}`]:{...valid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}}))
 expect((await get(location(`users/${newUid}/bookProtocol`,3))).val()).toBeNull()
 await life(3).initializeProtocol(ctx(1,newUid,'bootstrap'))
 expect(await catalog(3).getCatalog(newUid)).toEqual([])
})
it('supports safe URL-looking and Unicode collection keys in raw SDK paths and REST reads',async()=>{
 const c=scope(1,`${bookId}?%2F+&\\😀`);await make(c);expect((await catalog(1).getCollection(c)).id).toBe(c.collectionId)
})
it('refuses epoch overflow but still permits metadata edits and terminal deletion',async()=>{
 await make();const raw=await observed(path());const c=scope(CATALOG_MAX_COUNTER)
 await adminSeed(c,{...raw,membershipEpoch:c.epoch,lastClearFrom:c.epoch-1,lastClearId:opId})
 const r=await catalog().getCollection(c);await expect(catalog().clearCollection(c,otherOpId,r.token)).rejects.toThrow(RangeError)
 await denied(update(location(path(c)),{membershipEpoch:CATALOG_MAX_COUNTER+1,lastClearFrom:CATALOG_MAX_COUNTER,lastClearId:otherOpId,revision:2,updatedAt:serverTimestamp()}))
 await catalog().updateMetadata(c,{name:'Still editable'},r.token);const latest=await catalog().getCollection(c)
 await catalog().deleteCollection(c,latest.token);expect((await observed(path(c))).deleted).toBe(true)
})
it('reserves the final global revision for deletion instead of making exhausted live metadata undeletable',async()=>{
 await make();const raw=await observed(path());await adminSeed(scope(),{...raw,revision:CATALOG_LAST_LIVE_REVISION})
 const r=await catalog().getCollection(scope());await expect(catalog().setPinned(scope(),true,r.token)).rejects.toThrow(RangeError)
 await denied(update(location(path()),{pinned:true,'fieldRevisions/pinned':2,revision:CATALOG_MAX_COUNTER,updatedAt:serverTimestamp()}))
 await catalog().deleteCollection(scope(),r.token);expect(await observed(path())).toEqual({deleted:true,createdAt:r.createdAt,membershipEpoch:1,revision:CATALOG_MAX_COUNTER})
})
it('refuses exhausted field counters without resetting them while preserving other fields',async()=>{
 await make();const raw=await observed(path());await adminSeed(scope(),{...raw,fieldRevisions:{...raw.fieldRevisions,name:CATALOG_MAX_COUNTER}})
 const r=await catalog().getCollection(scope());await expect(catalog().updateMetadata(scope(),{name:'Overflow'},r.token)).rejects.toThrow(RangeError)
 await catalog().setPinned(scope(),true,r.token);expect((await observed(path())).fieldRevisions.name).toBe(CATALOG_MAX_COUNTER)
})
it('sorts pinned first and then by server activity using the existing ordering convention',async()=>{
 const a=await make(),b=await make(scope(1,`${bookId}-b`));await catalog().setPinned(a.context,true,a.token)
 const relevant=(await catalog().getCatalog(uid)).filter(c=>[a.id,b.id].includes(c.id));expect(relevant.map(c=>c.id)).toEqual([a.id,b.id])
})
it('races metadata with clear and checks both legal serializations despite uncertain acknowledgement',async()=>{
 const r=await make(),before=await observed(path());const results=await Promise.allSettled([catalog().execute(clearIntent(r)),catalog(1).updateMetadata(scope(),{description:'Concurrent'},r.token)])
 expect(results[0].status).toBe('fulfilled');const raw=await observed(path());expect(raw.membershipEpoch).toBe(2)
 const metadataCommitted=raw.fieldRevisions.description===2
 const expected={...before,membershipEpoch:2,lastClearId:opId,lastClearFrom:1,revision:metadataCommitted?3:2}
 if(metadataCommitted){expected.description='Concurrent';expected.fieldRevisions={...before.fieldRevisions,description:2};expected.updatedAt=raw.updatedAt;expect(raw.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)}
 expect(raw).toEqual(expected)
 if(results[1].status==='fulfilled')expect(metadataCommitted).toBe(true)
 else expect(['collection-catalog/stale-epoch','collection-catalog/conflict']).toContain(results[1].reason.code)
})
it('races deletion with metadata without losing CAS or retaining private metadata in a tombstone',async()=>{
 const r=await make();const results=await Promise.allSettled([catalog().deleteCollection(scope(),r.token),catalog(1).updateMetadata(scope(),{name:'Concurrent'},r.token)])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const raw=await observed(path())
 if(raw.deleted)expect(Object.keys(raw).sort()).toEqual(['createdAt','deleted','membershipEpoch','revision']);else expect(raw.name).toBe('Concurrent')
})
it('leaves residual membership fixtures physically untouched on logical clear and terminal catalog deletion',async()=>{
 const r=await make();await active()
 const fixturePath=`${bookDataPath(ctx())}/collectionMemberships/${bookId}`
 const response=await fetch(`http://127.0.0.1:9000/${fixturePath.split('/').map(encodeURIComponent).join('/')}.json?ns=demo-dear-pages`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({epoch:1,present:true,revision:1}),redirect:'error'})
 expect(response.ok).toBe(true);const before=await observed(bookDataPath(ctx()))
 const cleared=await catalog().execute(clearIntent(r));expect(await observed(bookDataPath(ctx()))).toEqual(before)
 await catalog().deleteCollection(cleared.context,cleared.collection.token);expect(await observed(bookDataPath(ctx()))).toEqual(before)
})
it.each(['bad id','constructor','prototype','x'.repeat(129)])('rejects unsafe catalog IDs directly in rules: %#',async id=>{
 const valid=await make();const raw=await observed(path());const target=`users/${uid}/collectionCatalog/${id}`
 await denied(set(location(target),{...raw,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 expect(await observed(target)).toBeNull();expect(valid.name).toBe('Favorites')
})
it.each(['\t\r\n','\u00a0\u2003\ufeff'])('rejects whitespace-only names in rules without the unsupported shorthand: %#',async name=>{
 await make();const before=await observed(path())
 await denied(update(location(path()),{name,'fieldRevisions/name':2,revision:2,updatedAt:serverTimestamp()}));expect(await observed(path())).toEqual(before)
})
