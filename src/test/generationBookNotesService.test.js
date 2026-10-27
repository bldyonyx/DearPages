import { beforeEach, expect, it, vi } from 'vitest'
import { runTransaction } from 'firebase/database'
import { webcrypto } from 'node:crypto'
import { createGenerationBookNotesService } from '../services/generationBookNotesService.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createNoteCreateOperation, createNotePatchOperation, createNoteConversionOperation } from '../utils/generationNoteContracts.js'

const fake = vi.hoisted(() => ({ uid:'owner', generation:1, state:'active', records:{}, writes:0 }))
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser:{ uid:fake.uid, getIdToken:async()=> 'fictional' } }) }))
vi.mock('../services/bookLifecycleService.js', () => ({ createBookLifecycleService: () => ({ readLifecycle:async()=>({generation:fake.generation,state:fake.state}) }) }))
vi.mock('firebase/database', () => ({ ref:(_db,path)=>path, serverTimestamp:()=>1234,
  runTransaction:vi.fn(async(path,change)=> { fake.writes++; const next=change(fake.records[path]??null); if(next!==undefined) fake.records[path]=next; return {committed:next!==undefined} }),
  update:vi.fn(async(_ref,values)=> { fake.writes++; Object.assign(fake.records,values) }),
}))
const context=()=>createBookMutationContext({uid:'owner',bookId:'book',generation:1})
const path='users/owner/bookData/book/1/bookNotes/n'
const payload={ title:'Title',contentHtml:'<b>Text</b>',date:'2024-02-29' }
const service=()=>createGenerationBookNotesService({})
beforeEach(()=>{
  vi.clearAllMocks()
  Object.assign(fake,{uid:'owner',generation:1,state:'active',records:{},writes:0})
  Object.defineProperty(globalThis.crypto,'subtle',{value:webcrypto.subtle,configurable:true})
  vi.stubGlobal('fetch',vi.fn(async input=>{
    const url=new URL(input); const key=url.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/')
    return {ok:true,status:200,json:async()=>fake.records[key]??null}
  }))
})
it('creates and replays captured envelopes without changing identity',async()=>{
 const svc=service(),op=createNoteCreateOperation({context:context(),entryId:'n',payload})
 await svc.execute(op); const first={...fake.records[path]}; await svc.execute(op)
 expect(fake.records[path]).toEqual(first); expect(first).toMatchObject({title:'Title',isPinned:false,createdAt:1234})
})
it('returns a sanitized view while retaining byte-exact CAS fields',async()=>{
 const svc=service(); await svc.createNote(context(),'n',payload)
 fake.records[path].contentHtml='<script>unsafe</script><b>Safe</b>'
 const n=await svc.getNote(context(),'n')
 expect(n.contentHtml).toBe('<b>Safe</b>'); expect(n.token.fields.contentHtml).toContain('<script>')
})
it('does not redirect old envelopes to a new generation',async()=>{
 const op=createNoteCreateOperation({context:context(),entryId:'n',payload}); fake.generation=2
 await expect(service().execute(op)).rejects.toThrow('stale-generation'); expect(fake.writes).toBe(0)
})
it('rejects stale content but preserves independent patch and pin intentions',async()=>{
 const svc=service(); await svc.createNote(context(),'n',payload); const n=await svc.getNote(context(),'n')
 await svc.patchNote(context(),'n',{title:'New'},n.token)
 await svc.setPinned(context(),'n',true,n.token)
 await svc.patchNote(context(),'n',{date:'9999-12-31'},n.token)
 await expect(svc.saveNote(context(),'n',payload,n.token)).rejects.toThrow('field-conflict')
 expect(fake.records[path]).toMatchObject({title:'New',isPinned:true,date:'9999-12-31'})
})
it('deletes without retaining content and rejects every resurrection intention',async()=>{
 const svc=service(); await svc.createNote(context(),'n',payload); const n=await svc.getNote(context(),'n')
 await svc.deleteNote(context(),'n',n.token); expect(fake.records[path]).toEqual({deleted:true,createdAt:1234})
 await svc.deleteNote(context(),'n',n.token)
 await expect(svc.createNote(context(),'n',payload)).rejects.toThrow('creation-conflict')
 await expect(svc.setPinned(context(),'n',true,n.token)).rejects.toThrow('deleted')
})
it('refuses malformed top-level accessors without evaluating them',async()=>{
 const getter=vi.fn(); const op=Object.defineProperty({},'context',{get:getter,enumerable:true})
 await expect(service().execute(op)).rejects.toThrow(TypeError); expect(getter).not.toHaveBeenCalled(); expect(fake.writes).toBe(0)
})
it('rejects malformed nested pin payloads without invoking getters',async()=>{
 const svc=service(); await svc.createNote(context(),'n',payload); const n=await svc.getNote(context(),'n'), getter=vi.fn()
 const pin=Object.defineProperty({},'isPinned',{get:getter,enumerable:true})
 await expect(svc.execute({context:context(),type:'note.pin',entryId:'n',payload:pin,expected:n.token,comparisonFields:[]})).rejects.toThrow(TypeError)
 expect(getter).not.toHaveBeenCalled()
})
it('rejects altered or decorated canonical envelopes',async()=>{
 const op=createNoteCreateOperation({context:context(),entryId:'n',payload})
 await expect(service().execute({...op,extra:true})).rejects.toThrow(TypeError)
 await expect(service().execute({...op,type:'note.unknown'})).rejects.toThrow(TypeError)
 expect(fake.writes).toBe(0)
})
it('rejects a cross-owner context before any network request',async()=>{
 fake.uid='other'; await expect(service().getNotes(context())).rejects.toThrow('owner-mismatch')
 expect(fetch).not.toHaveBeenCalled()
})
it('redacts credential URLs from network errors and fails closed',async()=>{
 fetch.mockRejectedValueOnce(new Error('http://secret.invalid/?auth=private'))
 await expect(service().getNote(context(),'n')).rejects.toThrow('generation-notes/network-error')
 expect(fake.writes).toBe(0)
})
it('encodes each REST segment exactly once and keeps SDK paths raw',async()=>{
 const c=createBookMutationContext({uid:'owner',bookId:'b?%2F+&',generation:1})
 await service().getNote(c,'n%2F?')
 const url=new URL(fetch.mock.calls[0][0]); expect(url.pathname).toContain('b%3F%252F%2B%26/1/bookNotes/n%252F%3F.json')
})
it('returns terminal markers on retry even after converted destination deletion',async()=>{
 const svc=service(); fake.records['users/owner/bookData/book/1/library']={note:'Text'}
 const source=await svc.getLegacySource(context(),'note')
 const op=createNoteConversionOperation({context:context(),expected:source.token,date:'2024-01-01'})
 await svc.convertLegacy(op); const dest='users/owner/bookData/book/1/bookNotes/legacy-note-v1'
 fake.records[dest]={deleted:true,createdAt:1234}; await svc.convertLegacy(op)
 expect(fake.records[dest]).toEqual({deleted:true,createdAt:1234}); expect(fake.writes).toBe(1)
})
it('keeps a captured patch immutable after later reads',async()=>{
 const svc=service(); await svc.createNote(context(),'n',payload);const n=await svc.getNote(context(),'n')
 const op=createNotePatchOperation({context:context(),entryId:'n',expected:n.token,payload:{title:'New'}})
 await svc.execute(op);expect(op.expected.fields.title).toBe('Title');expect(Object.isFrozen(op.context)).toBe(true)
})
it('rejects accessor-bearing comparison arrays before serializing an envelope',async()=>{
 const svc=service();await svc.createNote(context(),'n',payload);const n=await svc.getNote(context(),'n')
 const op=createNotePatchOperation({context:context(),entryId:'n',payload:{title:'New'},expected:n.token})
 const getter=vi.fn();const comparisonFields=Object.defineProperty([],'0',{get:getter,enumerable:true});comparisonFields.length=1
 await expect(svc.execute({...op,comparisonFields})).rejects.toThrow(TypeError);expect(getter).not.toHaveBeenCalled()
})
it('rejects nonprimitive comparison entries without calling serialization hooks',async()=>{
 const svc=service();await svc.createNote(context(),'n',payload);const n=await svc.getNote(context(),'n')
 const op=createNotePatchOperation({context:context(),entryId:'n',payload:{title:'New'},expected:n.token}),toJSON=vi.fn()
 await expect(svc.execute({...op,comparisonFields:[{toJSON}]})).rejects.toThrow(TypeError);expect(toJSON).not.toHaveBeenCalled()
})
it('aborts an incompatible SDK retry callback without throwing into the SDK event loop',async()=>{
 const svc=service()
 runTransaction.mockImplementationOnce(async(_path,change)=>{
  const proposal=change(null); expect(proposal.title).toBe('Title')
  fake.records[path]={...proposal,creation:'0'.repeat(64),title:'Competitor',createdAt:1234,updatedAt:1234}
  let returned;expect(()=>{returned=change(fake.records[path])}).not.toThrow();expect(returned).toBeUndefined()
  return {committed:false}
 })
 await expect(svc.createNote(context(),'n',payload)).rejects.toThrow('creation-conflict')
 expect(fake.records[path].title).toBe('Competitor')
})
it('increments only changed field revisions, preserves them for pin, and refuses overflow',async()=>{
 const svc=service();await svc.createNote(context(),'n',payload);let n=await svc.getNote(context(),'n')
 expect(Object.isFrozen(n.fieldRevisions)).toBe(true)
 await svc.patchNote(context(),'n',{title:'New'},n.token); await svc.setPinned(context(),'n',true,n.token)
 expect(fake.records[path].fieldRevisions).toEqual({title:2,contentHtml:1,date:1})
 fake.records[path].fieldRevisions.title=Number.MAX_SAFE_INTEGER;n=await svc.getNote(context(),'n')
 await expect(svc.patchNote(context(),'n',{title:'Overflow'},n.token)).rejects.toThrow(RangeError)
 expect(fake.records[path].title).toBe('New')
})
