import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { runTransaction } from 'firebase/database'
import { createGenerationCollectionMembershipService } from '../services/generationCollectionMembershipService.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createCollectionContext, createMembershipOperation, createCollectionSelection } from '../utils/generationCollectionContracts.js'
import { CATALOG_MAX_COUNTER } from '../utils/generationCollectionCatalogModel.js'
const fake=vi.hoisted(()=>({uid:'u',life:{generation:1,state:'active'},records:{}}))
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:{uid:fake.uid,getIdToken:async()=> 'demo-token'}})}))
vi.mock('../services/bookLifecycleService.js',()=>({createBookLifecycleService:()=>({readLifecycle:async()=>fake.life})}))
vi.mock('firebase/database',()=>({ref:(_db,path)=>path,runTransaction:vi.fn(async(path,change)=>{const value=change(fake.records[path]??null);if(value!==undefined)fake.records[path]=value;return {committed:value!==undefined}})}))
const ctx=(generation=1,bookId='b')=>createBookMutationContext({uid:'u',bookId,generation})
const col=(epoch=1,id='c')=>createCollectionContext({uid:'u',collectionId:id,epoch})
const path='users/u/bookData/b/1/collectionMemberships/c',catPath='users/u/collectionCatalog/c'
const svc=()=>createGenerationCollectionMembershipService({})
const op=(intent,expected=null,context=ctx(),collection=col())=>createMembershipOperation({context,collection,intent,expected})
function readTree(key){
 if(Object.hasOwn(fake.records,key))return JSON.parse(JSON.stringify(fake.records[key]))
 let found=false;const tree={}
 for(const [path,value] of Object.entries(fake.records))if(path.startsWith(key+'/')){found=true;const segments=path.slice(key.length+1).split('/');let node=tree;for(const part of segments.slice(0,-1))node=node[part]??={};node[segments.at(-1)]=JSON.parse(JSON.stringify(value))}
 return found?tree:null
}
beforeEach(()=>{
 vi.clearAllMocks();Object.assign(fake,{uid:'u',life:{generation:1,state:'active'},records:{'users/u/bookProtocol':{version:2,state:'ready'},'users/u/bookData/b/1/library':{id:'b',status:'reading'},[catPath]:{name:'C',membershipEpoch:1,createdAt:100,revision:1}}})
 vi.stubGlobal('fetch',vi.fn(async url=>{const u=new URL(url),key=u.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/');return {ok:true,status:200,json:async()=>readTree(key)}}))
})
afterEach(()=>vi.unstubAllGlobals())
it('uses the exact compact schema and freezes raw/token results',async()=>{
 const s=svc();const r=await s.addBook(ctx(),col());expect(r.effective).toBe(true);expect(r.raw).toEqual({epoch:1,present:true,revision:1});expect(Object.isFrozen(r.token.membership)).toBe(true)
 expect(Object.keys(fake.records[path]).sort()).toEqual(['epoch','present','revision'])
})
it('repeats a first add without another transaction and refuses it after removal',async()=>{
 const s=svc(),first=op('add');await s.execute(first);await s.execute(first);expect(runTransaction).toHaveBeenCalledTimes(1)
 await s.removeBook(ctx(),col(),(await s.getMembership(ctx(),col())).token);await expect(s.execute(first)).rejects.toThrow('membership-conflict')
 expect(fake.records[path]).toEqual({epoch:1,present:false,revision:2})
})
it('retries removal read-only and permits only an explicit new readd revision',async()=>{
 const s=svc(),r=await s.addBook(ctx(),col()),remove=op('remove',r.token);await s.execute(remove);await s.execute(remove)
 const absent=await s.getMembership(ctx(),col());expect(absent.effective).toBe(false);expect(absent.token.membership.present).toBe(false)
 await s.addBook(ctx(),col(),absent.token);await expect(s.execute(remove)).rejects.toThrow('revision-conflict');expect(fake.records[path].revision).toBe(3)
})
it('preserves no-op revision and refuses a no-op based on an obsolete snapshot',async()=>{
 const s=svc(),r=await s.addBook(ctx(),col()),noop=op('add',r.token);expect(noop.changes).toBe(false)
 await s.execute(noop);expect(runTransaction).toHaveBeenCalledTimes(1)
 await s.removeBook(ctx(),col(),r.token);await expect(s.execute(noop)).rejects.toThrow('revision-conflict')
})
it('keeps raw obsolete data but exposes effective absence after clear',async()=>{
 const s=svc();await s.addBook(ctx(),col());fake.records[catPath].membershipEpoch=2
 const old=await s.getMembership(ctx(),col());expect(old.raw.present).toBe(true);expect(old.effective).toBe(false);expect(old.reason).toBe('stale-epoch')
 const current=await s.getMembership(ctx(),col(2));expect(current.reason).toBeNull();expect(current.effective).toBe(false);expect(current.token).toBeNull()
 expect((await s.getBookMemberships(ctx())).effective).toEqual([])
})
it('requires an explicitly captured new epoch for reinitialization and never retargets old envelopes',async()=>{
 const s=svc(),first=op('add');await s.execute(first);fake.records[catPath].membershipEpoch=2
 await expect(s.execute(first)).rejects.toThrow('stale-epoch');await s.addBook(ctx(),col(2))
 expect(fake.records[path]).toEqual({epoch:2,present:true,revision:1});expect(first.collection.epoch).toBe(1)
})
it('makes residual nodes ineffective once a Collection is terminally deleted',async()=>{
 const s=svc(),r=await s.addBook(ctx(),col());fake.records[catPath]={deleted:true,membershipEpoch:1,createdAt:100,revision:2}
 expect((await s.getMembership(ctx(),col())).effective).toBe(false)
 await expect(s.removeBook(ctx(),col(),r.token)).rejects.toThrow('collection-deleted');expect(fake.records[path].present).toBe(true)
})
it.each([null,{generation:1,state:'creating'},{generation:1,state:'deleting'},{generation:1,state:'deleted'},{generation:2,state:'active'}])('fails closed for an unusable lifecycle %#',async life=>{
 fake.life=life;const s=svc();expect((await s.getMembership(ctx(),col())).effective).toBe(false)
 await expect(s.addBook(ctx(),col())).rejects.toThrow();expect(runTransaction).not.toHaveBeenCalled()
})
it('requires an existing library and Collection and a ready protocol',async()=>{
 const s=svc();delete fake.records['users/u/bookData/b/1/library'];await expect(s.addBook(ctx(),col())).rejects.toThrow('library-missing')
 fake.records['users/u/bookData/b/1/library']={id:'b'};delete fake.records[catPath];await expect(s.addBook(ctx(),col())).rejects.toThrow('collection-not-found')
 delete fake.records['users/u/bookProtocol'];await expect(s.addBook(ctx(),col())).rejects.toThrow('protocol-not-ready');expect(runTransaction).not.toHaveBeenCalled()
})
it('returns no old-generation membership for a new generation and never rewrites the old path',async()=>{
 const s=svc();await s.addBook(ctx(),col());fake.life={generation:2,state:'active'};fake.records['users/u/bookData/b/2/library']={id:'b'}
 expect((await s.getBookMemberships(ctx(2))).effective).toEqual([]);await expect(s.execute(op('add'))).rejects.toThrow('stale-generation')
 expect(fake.records[path].epoch).toBe(1);expect(fake.records['users/u/bookData/b/2/collectionMemberships/c']).toBeUndefined()
})
it('reconciles real desired state after a simulated lost SDK acknowledgement',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{fake.records[path]=change(null);throw new Error('lost acknowledgement')})
 const s=svc(),first=op('add');await s.execute(first);await s.reconcile(first);expect(fake.records[path].revision).toBe(1)
})
it('aborts conflicting SDK retries without throwing into the SDK event loop',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{change(null);fake.records[path]={epoch:1,present:false,revision:2};expect(()=>change(fake.records[path])).not.toThrow();expect(change(fake.records[path])).toBeUndefined();return {committed:false}})
 await expect(svc().execute(op('add'))).rejects.toThrow('membership-conflict');expect(fake.records[path].present).toBe(false)
})
it('does not trust cached data or leak credential URLs on unavailable server evidence',async()=>{
 fetch.mockRejectedValueOnce(new Error('http://unsafe/?auth=secret'));await expect(svc().getMembership(ctx(),col())).rejects.toThrow('collection-memberships/network-error')
 expect(runTransaction).not.toHaveBeenCalled()
})
it('rejects cross-owner scopes, malformed envelopes and getters before network access',async()=>{
 const get=vi.fn();await expect(svc().execute(Object.defineProperty({},'payload',{get,enumerable:true}))).rejects.toThrow(TypeError);expect(get).not.toHaveBeenCalled()
 const other=createCollectionContext({uid:'other',collectionId:'c',epoch:1});await expect(svc().getMembership(ctx(),other)).rejects.toThrow(TypeError)
 expect(fetch).not.toHaveBeenCalled();fake.uid='other';await expect(svc().getMembership(ctx(),col())).rejects.toThrow('owner-mismatch')
})
it('refuses changed operation intent, tuple identity and revisions',async()=>{
 const first=op('add');for(const changed of [{...first,entryId:'other'},{...first,payload:{epoch:1,present:true,revision:2}},{...first,changes:false}])await expect(svc().execute(changed)).rejects.toThrow(TypeError)
 expect(fetch).not.toHaveBeenCalled()
})
it('uses captured selection observations and refuses changed revisions',async()=>{
 const s=svc(),r=await s.addBook(ctx(),col()),selection=createCollectionSelection({collection:col(),entries:[{context:ctx(),expected:r.token}]})
 expect(await s.verifySelection(selection)).toEqual(selection);await s.removeBook(ctx(),col(),r.token);await expect(s.verifySelection(selection)).rejects.toThrow()
 expect(selection.entries[0].expected.membership.revision).toBe(1)
})
it('copies a caller-owned selection before awaits rather than rereading a mutable nested array',async()=>{
 const selection=Object.freeze({collection:col(),entries:[{context:ctx(),expected:null}]})
 const original=fetch.getMockImplementation();fetch.mockImplementationOnce(async(...args)=>{selection.entries.push({context:ctx(1,'other'),expected:null});return original(...args)})
 const verified=await svc().verifySelection(selection);expect(verified.entries).toHaveLength(1);expect(selection.entries).toHaveLength(2);expect(Object.isFrozen(verified.entries)).toBe(true)
})
it('checks an empty selection against the authoritative Collection epoch',async()=>{
 const selection=createCollectionSelection({collection:col(),entries:[]});fake.records[catPath].membershipEpoch=2
 await expect(svc().verifySelection(selection)).rejects.toThrow('stale-epoch')
})
it('fails effective reads closed when clear occurs between raw data and final guards',async()=>{
 const s=svc();await s.addBook(ctx(),col());const original=fetch.getMockImplementation();let triggered=false
 fetch.mockImplementation(async(...args)=>{const response=await original(...args);if(!triggered&&decodeURIComponent(new URL(args[0]).pathname).includes('/collectionMemberships/')){triggered=true;fake.records[catPath].membershipEpoch=2}return response})
 const result=await s.getMembership(ctx(),col());expect(result.raw.present).toBe(true);expect(result.effective).toBe(false);expect(result.reason).toBe('stale-epoch')
})
it('handles maximum scoped revision explicitly and never resets within the same epoch',async()=>{
 fake.records[path]={epoch:1,present:true,revision:CATALOG_MAX_COUNTER};const s=svc(),r=await s.getMembership(ctx(),col())
 await expect(s.removeBook(ctx(),col(),r.token)).rejects.toThrow(RangeError);expect(fake.records[path].revision).toBe(CATALOG_MAX_COUNTER)
 fake.records[catPath].membershipEpoch=2;await s.addBook(ctx(),col(2));expect(fake.records[path]).toEqual({epoch:2,present:true,revision:1})
})
it('rejects future or malformed raw rows rather than converting them implicitly',async()=>{
 fake.records[path]={epoch:2,present:true,revision:1};await expect(svc().getMembership(ctx(),col())).rejects.toThrow('contradictory-membership')
 fake.records[path]=true;await expect(svc().getRawMembership(ctx(),col())).rejects.toThrow(TypeError)
})
it('encodes every REST segment once without changing raw SDK path scopes',async()=>{
 const c=createCollectionContext({uid:'u',collectionId:'c?%2F+&\\',epoch:1});await svc().getRawMembership(ctx(),c)
 expect(new URL(fetch.mock.calls[0][0]).pathname).toContain('c%3F%252F%2B%26%5C.json')
})
it('exposes no batch mutation API and does not touch catalog metadata or other records',async()=>{
 const s=svc(),before=structuredClone(fake.records[catPath]);await s.addBook(ctx(),col());expect(fake.records[catPath]).toEqual(before)
 expect(Object.keys(s).sort()).toEqual(['addBook','execute','getBookMemberships','getMembership','getRawMembership','reconcile','removeBook','verifySelection'])
})
