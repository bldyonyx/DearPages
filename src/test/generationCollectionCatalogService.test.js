import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { runTransaction } from 'firebase/database'
import { createGenerationCollectionCatalogService } from '../services/generationCollectionCatalogService.js'
import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { createCatalogOperation, CATALOG_LAST_LIVE_REVISION, CATALOG_MAX_COUNTER } from '../utils/generationCollectionCatalogModel.js'
const fake=vi.hoisted(()=>({uid:'u',records:{}}))
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:{uid:fake.uid,getIdToken:async()=> 'demo-token'}})}))
vi.mock('../services/bookLifecycleService.js',()=>({createBookLifecycleService:()=>({})}))
vi.mock('firebase/database',()=>({ref:(_db,path)=>path,serverTimestamp:()=>100,
 runTransaction:vi.fn(async(path,change)=>{const value=change(fake.records[path]??null);if(value!==undefined)fake.records[path]=value;return {committed:value!==undefined}}),
}))
const context=(epoch=1)=>createCollectionContext({uid:'u',collectionId:'c',epoch})
const path='users/u/collectionCatalog/c',opId='-1234567890123456789',otherId='-2234567890123456789'
const service=()=>createGenerationCollectionCatalogService({})
beforeEach(()=>{
 vi.clearAllMocks();Object.assign(fake,{uid:'u',records:{'users/u/bookProtocol':{version:2,state:'ready'}}})
 Object.defineProperty(globalThis.crypto,'subtle',{value:webcrypto.subtle,configurable:true})
 vi.stubGlobal('fetch',vi.fn(async url=>{const u=new URL(url),key=u.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/');return {ok:true,status:200,json:async()=>fake.records[key]??null}}))
})
afterEach(()=>vi.unstubAllGlobals())
const make=async svc=>{await svc.createCollection(context(),{name:' Name '});return svc.getCollection(context())}
it('creates normalized metadata once with no book list and reconciles its stable initial hash',async()=>{
 const svc=service();await make(svc);await svc.createCollection(context(),{name:' Name '})
 expect(runTransaction).toHaveBeenCalledTimes(1);expect(fake.records[path]).toMatchObject({name:'Name',description:'',icon:'library',pinned:false,membershipEpoch:1});expect(fake.records[path]).not.toHaveProperty('books')
})
it('rejects incompatible creation',async()=>{
 const svc=service();await make(svc);await expect(svc.createCollection(context(),{name:'Other'})).rejects.toThrow('creation-conflict')
 expect(fake.records[path].name).toBe('Name')
})
it('merges disjoint field intents and rejects stale same-field tokens',async()=>{
 const svc=service(),r=await make(svc)
 await svc.updateMetadata(context(),{name:'New'},r.token);await svc.setPinned(context(),true,r.token);await svc.updateMetadata(context(),{description:'Independent'},r.token)
 await expect(svc.updateMetadata(context(),{name:'Stale'},r.token)).rejects.toThrow('field-conflict')
 expect(fake.records[path]).toMatchObject({name:'New',pinned:true,description:'Independent',revision:4})
})
it('strict execution rejects a repeated field token while readonly reconcile confirms the intended effect',async()=>{
 const svc=service(),r=await make(svc),op=createCatalogOperation({type:'catalog.pin',context:r.context,payload:{pinned:true},expected:r.token})
 await svc.execute(op);await expect(svc.execute(op)).rejects.toThrow('field-conflict');await svc.reconcile(op)
 expect(fake.records[path].fieldRevisions.pinned).toBe(2)
})
it('returns a new explicit successor context for clear and never mutates the captured context',async()=>{
 const svc=service(),r=await make(svc),op=createCatalogOperation({type:'catalog.clear',context:r.context,payload:{},expected:r.token,operationId:opId})
 const result=await svc.execute(op);expect(result.context.epoch).toBe(2);expect(op.context.epoch).toBe(1)
 await svc.updateMetadata(result.context,{name:'Recent'},result.collection.token);const before=structuredClone(fake.records[path]);await svc.execute(op)
 expect(fake.records[path]).toEqual(before);expect(fake.records[path].membershipEpoch).toBe(2)
})
it('rejects old clear after a new clear and never computes a successor from current state',async()=>{
 const svc=service(),r=await make(svc),op=createCatalogOperation({type:'catalog.clear',context:r.context,payload:{},expected:r.token,operationId:opId})
 const next=await svc.execute(op);await svc.clearCollection(next.context,otherId,next.collection.token)
 await expect(svc.execute(op)).rejects.toThrow('stale-epoch');expect(fake.records[path].membershipEpoch).toBe(3)
})
it('does not retarget old metadata to a cleared epoch',async()=>{
 const svc=service(),r=await make(svc);await svc.clearCollection(context(),opId,r.token)
 await expect(svc.updateMetadata(context(),{name:'Old'},r.token)).rejects.toThrow('stale-epoch');expect(fake.records[path].name).toBe('Name')
})
it('writes a minimal terminal trace and permits readonly deletion retries',async()=>{
 const svc=service(),r=await make(svc);await svc.deleteCollection(context(),r.token);await svc.deleteCollection(context(),r.token)
 expect(fake.records[path]).toEqual({deleted:true,createdAt:100,membershipEpoch:1,revision:2});expect(await svc.getCollection(context())).toBeNull()
 await expect(svc.createCollection(context(),{name:'Name'})).rejects.toThrow('creation-conflict')
})
it('requires exact global revision for deletion after metadata changes',async()=>{
 const svc=service(),r=await make(svc);await svc.updateMetadata(context(),{name:'New'},r.token)
 await expect(svc.deleteCollection(context(),r.token)).rejects.toThrow('revision-conflict');expect(fake.records[path].deleted).not.toBe(true)
})
it('confirms committed create/clear after caller acknowledgement failures',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{fake.records[path]=change(null);throw new Error('lost acknowledgement')})
 const svc=service(),r=await make(svc)
 runTransaction.mockImplementationOnce(async(path,change)=>{fake.records[path]=change(fake.records[path]);throw new Error('lost acknowledgement')})
 await svc.clearCollection(context(),opId,r.token);expect(fake.records[path].membershipEpoch).toBe(2)
})
it('aborts conflicting SDK retry callbacks without throwing into the SDK',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{const proposal=change(null);fake.records[path]={...proposal,creation:'0'.repeat(64)};expect(()=>change(fake.records[path])).not.toThrow();expect(change(fake.records[path])).toBeUndefined();return {committed:false}})
 await expect(service().createCollection(context(),{name:'Name'})).rejects.toThrow('creation-conflict')
})
it('never trusts cached state when server evidence is unavailable',async()=>{
 fetch.mockRejectedValueOnce(new Error('http://secret/?auth=token'));await expect(service().getCollection(context())).rejects.toThrow('collection-catalog/network-error')
 expect(runTransaction).not.toHaveBeenCalled()
})
it('checks protocol and owner before any write',async()=>{
 delete fake.records['users/u/bookProtocol'];await expect(service().createCollection(context(),{name:'Name'})).rejects.toThrow('protocol-not-ready')
 expect(runTransaction).not.toHaveBeenCalled();fake.uid='other';await expect(service().getCollection(context())).rejects.toThrow('owner-mismatch')
})
it('rejects malformed operation getters without invoking them',async()=>{
 const get=vi.fn();await expect(service().execute(Object.defineProperty({},'type',{get,enumerable:true}))).rejects.toThrow(TypeError)
 expect(get).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
})
it('keeps deletion possible at exhausted live revision and rejects edit overflow',async()=>{
 const svc=service();await make(svc);fake.records[path].revision=CATALOG_LAST_LIVE_REVISION;const r=await svc.getCollection(context())
 await expect(svc.setPinned(context(),true,r.token)).rejects.toThrow(RangeError);await svc.deleteCollection(context(),r.token)
 expect(fake.records[path].revision).toBe(CATALOG_MAX_COUNTER)
})
it('refuses exhausted epoch and field counters without resetting them',async()=>{
 const svc=service();await make(svc);fake.records[path].membershipEpoch=CATALOG_MAX_COUNTER
 const c=context(CATALOG_MAX_COUNTER),r=await svc.getCollection(c);await expect(svc.clearCollection(c,opId,r.token)).rejects.toThrow(RangeError)
 fake.records[path].fieldRevisions.name=CATALOG_MAX_COUNTER;const current=await svc.getCollection(c)
 await expect(svc.updateMetadata(c,{name:'Overflow'},current.token)).rejects.toThrow(RangeError)
})
it('freezes nested view counters without freezing or mutating server snapshot objects',async()=>{
 const svc=service(),r=await make(svc);expect(Object.isFrozen(r.fieldRevisions)).toBe(true);expect(Object.isFrozen(fake.records[path].fieldRevisions)).toBe(false)
 fake.records[path].fieldRevisions.name=4;expect(r.fieldRevisions.name).toBe(1)
})
it('encodes raw catalog segments exactly once at the REST boundary',async()=>{
 const c=createCollectionContext({uid:'u',collectionId:'c?%2F+&\\',epoch:1});await service().getCollection(c)
 expect(new URL(fetch.mock.calls[1][0]).pathname).toContain('c%3F%252F%2B%26%5C.json')
})
it('keeps clear out of activity ordering, matching existing clearCollectionBooks semantics',async()=>{
 const svc=service(),r=await make(svc);fake.records[path].updatedAt=142
 const current=await svc.getCollection(context());const result=await svc.clearCollection(context(),opId,current.token)
 expect(result.collection.updatedAt).toBe(142);expect(result.collection.createdAt).toBe(r.createdAt)
})
