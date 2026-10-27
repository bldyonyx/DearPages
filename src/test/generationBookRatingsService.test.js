import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { runTransaction, update } from 'firebase/database'
import { createGenerationBookRatingsService } from '../services/generationBookRatingsService.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createRatingCreateOperation, createRatingUpdateOperation, createRatingDeleteOperation, createRatingConversionOperation } from '../utils/generationRatingContracts.js'
const fake=vi.hoisted(()=>({uid:'owner',generation:1,state:'active',records:{}}))
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:{uid:fake.uid,getIdToken:async()=> 'fictional'}})}))
vi.mock('../services/bookLifecycleService.js',()=>({createBookLifecycleService:()=>({readLifecycle:async()=>({generation:fake.generation,state:fake.state})})}))
vi.mock('firebase/database',()=>({ref:(_db,path)=>path,serverTimestamp:()=>1234,
 runTransaction:vi.fn(async(path,change)=>{const next=change(fake.records[path]??null);if(next!==undefined)fake.records[path]=next;return {committed:next!==undefined}}),
 update:vi.fn(async(_ref,writes)=>Object.assign(fake.records,writes)),
}))
const context=()=>createBookMutationContext({uid:'owner',bookId:'book',generation:1})
const id='-1234567890123456789',root='users/owner/bookData/book/1',path=`${root}/bookRatings/${id}`
const payload=extra=>({value:4,date:'2024-02-29',...extra})
const service=()=>createGenerationBookRatingsService({})
beforeEach(()=>{
 vi.clearAllMocks();Object.assign(fake,{uid:'owner',generation:1,state:'active',records:{[`${root}/library`]:{status:'finished',rating:4}}})
 vi.stubGlobal('fetch',vi.fn(async input=>{const url=new URL(input),key=url.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/');return {ok:true,status:200,json:async()=>fake.records[key]??null}}))
})
afterEach(()=>vi.unstubAllGlobals())
it('creates, captures acknowledged token and replays a normalized empty impression',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id)
 expect(r).toMatchObject({revision:1,createdAt:1234});expect(Object.isFrozen(r.token.context)).toBe(true)
 await svc.createRating(context(),id,payload({impression:'  '}));expect(runTransaction).toHaveBeenCalledTimes(1)
 expect(fake.records[path]).not.toHaveProperty('impression')
})
it('rejects incompatible creation and preserves the original payload',async()=>{
 const svc=service();await svc.createRating(context(),id,payload())
 await expect(svc.createRating(context(),id,payload({impression:'Different'}))).rejects.toThrow('creation-conflict')
 expect(fake.records[path].value).toBe(4)
})
it('updates with exact revision increments and preserves omission versus explicit clearing',async()=>{
 const svc=service();await svc.createRating(context(),id,payload({impression:'Keep'}));let r=await svc.getRating(context(),id)
 await svc.updateRating(context(),id,payload({value:5}),r.token);expect(fake.records[path]).toMatchObject({impression:'Keep',revision:2,createdAt:1234})
 r=await svc.getRating(context(),id);await svc.updateRating(context(),id,payload({impression:''}),r.token)
 expect(fake.records[path]).not.toHaveProperty('impression');expect(fake.records[path].revision).toBe(3)
})
it('rejects stale revision and identity without writing',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id)
 await svc.updateRating(context(),id,payload({value:5}),r.token)
 await expect(svc.updateRating(context(),id,payload({value:2}),r.token)).rejects.toThrow('revision-conflict')
 expect(runTransaction).toHaveBeenCalledTimes(2)
})
it.each(['reading','to-read','abandoned'])('refuses writes in %s but allows deletion',async status=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id);fake.records[`${root}/library`].status=status
 await expect(svc.updateRating(context(),id,payload(),r.token)).rejects.toThrow('status-conflict')
 await svc.deleteRating(context(),id,r.token);expect(Object.keys(fake.records[path]).sort()).toEqual(['createdAt','deleted','revision','updatedAt'])
})
it('retries deletion without incrementing a terminal tombstone or resurrecting it',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id)
 const op=createRatingDeleteOperation({context:context(),entryId:id,expected:r.token})
 await svc.execute(op);await svc.execute(op);expect(fake.records[path]).toEqual({deleted:true,createdAt:1234,revision:2,updatedAt:1234})
 expect(await svc.getRating(context(),id)).toBeNull()
 await expect(svc.createRating(context(),id,payload())).rejects.toThrow('creation-conflict')
})
it('does not resolve a newer generation on retry or reconcile',async()=>{
 const op=createRatingCreateOperation({context:context(),entryId:id,payload:payload()});fake.generation=2
 await expect(service().execute(op)).rejects.toThrow('stale-generation');await expect(service().reconcile(op)).rejects.toThrow('stale-generation')
 expect(runTransaction).not.toHaveBeenCalled()
})
it('reconciles server evidence after a lost acknowledgement using the same ID',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{fake.records[path]=change(null);throw new Error('lost acknowledgement')})
 const svc=service(),op=createRatingCreateOperation({context:context(),entryId:id,payload:payload()})
 await svc.execute(op);await svc.reconcile(op);expect(Object.keys(fake.records).filter(key=>key.includes('bookRatings/'))).toEqual([path])
})
it('aborts a conflicting SDK retry without throwing inside the SDK callback',async()=>{
 runTransaction.mockImplementationOnce(async(path,change)=>{
  const next=change(null);fake.records[path]={...next,value:1}
  expect(()=>change(fake.records[path])).not.toThrow();expect(change(fake.records[path])).toBeUndefined();return {committed:false}
 })
 await expect(service().createRating(context(),id,payload())).rejects.toThrow('creation-conflict')
})
it('keeps network failures visible without leaking credentials or allocating a new ID',async()=>{
 fetch.mockRejectedValueOnce(new Error('http://unsafe/?auth=private'))
 await expect(service().getRating(context(),id)).rejects.toThrow('generation-ratings/network-error');expect(runTransaction).not.toHaveBeenCalled()
})
it('rejects malicious getters and decorated operation fields before network access',async()=>{
 const getter=vi.fn();await expect(service().execute(Object.defineProperty({},'type',{get:getter,enumerable:true}))).rejects.toThrow(TypeError)
 expect(getter).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 const op=createRatingCreateOperation({context:context(),entryId:id,payload:payload()})
 await expect(service().execute({...op,extra:true})).rejects.toThrow(TypeError)
})
it('rejects forged next revisions before writing',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id)
 const op=createRatingUpdateOperation({context:context(),entryId:id,payload:payload(),expected:r.token})
 await expect(svc.execute({...op,nextRevision:7})).rejects.toThrow(TypeError);expect(runTransaction).toHaveBeenCalledTimes(1)
})
it('refuses overflowing revision without a write',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());fake.records[path].revision=Number.MAX_SAFE_INTEGER
 const r=await svc.getRating(context(),id);await expect(svc.deleteRating(context(),id,r.token)).rejects.toThrow(RangeError)
 expect(fake.records[path].revision).toBe(Number.MAX_SAFE_INTEGER)
})
it('returns an immutable captured token without changing previous snapshots',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const before=await svc.getRating(context(),id)
 await svc.updateRating(context(),id,payload({value:1}),before.token)
 expect(before.value).toBe(4);expect(before.token.revision).toBe(1);expect(Object.isFrozen(before)).toBe(true)
})
it('converts historical value without inventing date/impression and retains a terminal marker',async()=>{
 const svc=service(),op=createRatingConversionOperation({context:context(),expected:(await svc.getLegacySource(context())).token})
 await svc.convertLegacy(op);const dest=`${root}/bookRatings/legacy-rating-v1`
 expect(fake.records[dest]).toEqual({value:4,date:'',revision:1,createdAt:1234,updatedAt:1234})
 fake.records[dest]={deleted:true,revision:2,createdAt:1234,updatedAt:1234};await svc.convertLegacy(op)
 expect(fake.records[dest].deleted).toBe(true);expect(update).toHaveBeenCalledTimes(1)
})
it('rejects changed historical source and never converts on reads',async()=>{
 const svc=service(),op=createRatingConversionOperation({context:context(),expected:(await svc.getLegacySource(context())).token})
 fake.records[`${root}/library`].rating=5;await expect(svc.convertLegacy(op)).rejects.toThrow('source-conflict');expect(update).not.toHaveBeenCalled()
})
it('encodes REST segments once while retaining the captured generation',async()=>{
 const c=createBookMutationContext({uid:'owner',bookId:'b?%2F+&',generation:1});await service().getRating(c,id)
 expect(new URL(fetch.mock.calls[0][0]).pathname).toContain('b%3F%252F%2B%26/1/bookRatings/')
})
it('rejects cross-owner operations before accessing the network',async()=>{
 fake.uid='other';await expect(service().getRatings(context())).rejects.toThrow('owner-mismatch');expect(fetch).not.toHaveBeenCalled()
})
it.each([{value:0},{value:1.5},{date:''},{impression:null},{impression:'x'.repeat(161)},{impression:'bad\ntext'}])('rejects invalid raw convenience payloads asynchronously before reads %#',async patch=>{
 await expect(service().createRating(context(),id,payload(patch))).rejects.toThrow(TypeError)
 expect(fetch).not.toHaveBeenCalled();expect(runTransaction).not.toHaveBeenCalled()
})
it('keeps execute CAS strict even for identical desired content; reconciliation is explicit',async()=>{
 const svc=service();await svc.createRating(context(),id,payload());const r=await svc.getRating(context(),id)
 const op=createRatingUpdateOperation({context:context(),entryId:id,payload:payload({value:5}),expected:r.token})
 await svc.execute(op);await expect(svc.execute(op)).rejects.toThrow('revision-conflict')
 await svc.reconcile(op);expect(fake.records[path].revision).toBe(2);expect(runTransaction).toHaveBeenCalledTimes(2)
})
