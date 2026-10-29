import { expect, it, vi } from 'vitest'
import { CATALOG_DEFAULT_ICON, catalogMetadata, createCatalogToken, createCatalogOperation, compareCatalogEntries, CATALOG_LAST_LIVE_REVISION, CATALOG_MAX_COUNTER, nextCatalogCounter } from '../utils/generationCollectionCatalogModel.js'
import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { DEFAULT_COLLECTION_ICON } from '../data/collectionIcons.js'
const context=(epoch=1)=>createCollectionContext({uid:'u',collectionId:'c',epoch})
const token=(ctx=context(),extra={})=>createCatalogToken({context:ctx,createdAt:1,revision:1,fieldRevisions:{name:1,description:1,icon:1,pinned:1},...extra})
const opId='-1234567890123456789'
it('preserves existing defaults, trimming, custom icon strings and unbounded metadata',()=>{
 expect(CATALOG_DEFAULT_ICON).toBe(DEFAULT_COLLECTION_ICON)
 expect(catalogMetadata({name:' Name ',description:' Text ',icon:''},true)).toEqual({name:'Name',description:'Text',icon:'library'})
 expect(catalogMetadata({name:'x'.repeat(5000),icon:'old-custom'},true).name).toHaveLength(5000)
 expect(catalogMetadata({name:'Name'},true)).toEqual({name:'Name',description:'',icon:'library'})
})
it.each([{name:''},{name:'  '},{name:3},{name:'n',books:{}},{name:'n',description:null},{name:'n',icon:42}])('rejects malformed metadata %#',value=>expect(()=>catalogMetadata(value,true)).toThrow(TypeError))
it('validates descriptors before accessing malicious metadata fields',()=>{
 const get=vi.fn();expect(()=>catalogMetadata(Object.defineProperty({},'name',{get,enumerable:true}),true)).toThrow(TypeError);expect(get).not.toHaveBeenCalled()
})
it('copies and deeply freezes tokens without freezing caller-owned counter objects',()=>{
 const fields={name:1,description:1,icon:1,pinned:1},input={context:context(),createdAt:1,revision:1,fieldRevisions:fields}
 const t=createCatalogToken(input);fields.name=7;expect(t.fieldRevisions.name).toBe(1);expect(Object.isFrozen(fields)).toBe(false);expect(Object.isFrozen(t.fieldRevisions)).toBe(true)
})
it('captures deterministic successor and stable intent without mutating the old epoch',()=>{
 const c=context(),t=token(c),input={type:'catalog.clear',context:c,payload:{},expected:t,operationId:opId}
 const a=createCatalogOperation(input),b=createCatalogOperation(input)
 expect(a).toEqual(b);expect(a.nextEpoch).toBe(2);expect(a.context.epoch).toBe(1);expect(Object.isFrozen(a.expected.fieldRevisions)).toBe(true)
})
it('refuses a token from another Collection epoch',()=>{
 expect(()=>createCatalogOperation({type:'catalog.pin',context:context(2),payload:{pinned:true},expected:token()})).toThrow(TypeError)
})
it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER+1])('rejects invalid counters %s',revision=>expect(()=>token(context(),{revision})).toThrow())
it('reserves the final safe revision for deletion and refuses clear overflow',()=>{
 expect(()=>token(context(),{revision:Number.MAX_SAFE_INTEGER})).toThrow(RangeError)
 expect(()=>createCatalogOperation({type:'catalog.delete',context:context(),payload:{},expected:token(context(),{revision:CATALOG_LAST_LIVE_REVISION})})).not.toThrow()
 const c=context(Number.MAX_SAFE_INTEGER);expect(()=>createCatalogOperation({type:'catalog.clear',context:c,payload:{},expected:token(c),operationId:opId})).toThrow(RangeError)
})
it('requires frozen contexts, explicit pin booleans and a stable clear ID',()=>{
 expect(()=>createCatalogOperation({type:'catalog.create',context:{uid:'u',collectionId:'c',epoch:1},payload:{name:'n'}})).toThrow(TypeError)
 expect(()=>createCatalogOperation({type:'catalog.pin',context:context(),payload:{pinned:1},expected:token()})).toThrow(TypeError)
 expect(()=>createCatalogOperation({type:'catalog.clear',context:context(),payload:{},expected:token()})).toThrow(TypeError)
})
it('keeps prior activity ordering: pinned, then updatedAt with createdAt fallback',()=>{
 const items=[{id:'a',pinned:false,updatedAt:3},{id:'b',pinned:true,updatedAt:1},{id:'c',pinned:false,createdAt:5}]
 expect(items.sort(compareCatalogEntries).map(i=>i.id)).toEqual(['b','c','a'])
})
it('requires an explicit epoch-one stable scope for creation without allocating IDs',()=>{
 expect(()=>createCatalogOperation({type:'catalog.create',context:context(2),payload:{name:'n'}})).toThrow(TypeError)
 const op=createCatalogOperation({type:'catalog.create',context:context(),payload:{name:'n'}});expect(op.context.collectionId).toBe('c')
 expect(Object.isFrozen(op.payload)).toBe(true)
})
it('uses an explicit SDK-tested bounded counter profile without narrowing generic Collection contexts',()=>{
 expect(CATALOG_MAX_COUNTER).toBe(2147483647)
 expect(nextCatalogCounter(CATALOG_MAX_COUNTER-1)).toBe(CATALOG_MAX_COUNTER)
 expect(()=>nextCatalogCounter(CATALOG_MAX_COUNTER)).toThrow(RangeError)
 const generic=context(Number.MAX_SAFE_INTEGER);expect(generic.epoch).toBe(Number.MAX_SAFE_INTEGER)
 expect(()=>token(generic)).toThrow(RangeError)
 expect(()=>token(context(),{fieldRevisions:{name:Number.MAX_SAFE_INTEGER,description:1,icon:1,pinned:1}})).toThrow(RangeError)
})
