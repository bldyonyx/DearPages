import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, serverTimestamp, goOffline, goOnline } from 'firebase/database'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { emulator, emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { bookDataPath, bookLibraryPath, bookLifecyclePath } from '../../src/utils/bookGenerationPaths.js'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationBookRatingsService } from '../../src/services/generationBookRatingsService.js'
import { createRatingCreateOperation, createRatingUpdateOperation, createRatingDeleteOperation, createRatingConversionOperation } from '../../src/utils/generationRatingContracts.js'
import { bookRatingsPath, bookRatingsLegacyPath } from '../../src/utils/bookGenerationPaths.js'
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
const ratings = (client = 0) => clients[client].ratings
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
  const email = `generation-ratings-${Date.now()}@example.test`, password = 'fictional-emulator-password'
  for (let index = 0; index < 5; index++) {
    const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
      databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, `generation-ratings-${index}`)
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, '127.0.0.1', 9000)
    if (index === 0) uid = (await createUserWithEmailAndPassword(auth, email, password)).user.uid
    if ([1, 4].includes(index)) await signInWithEmailAndPassword(auth, email, password)
    if (index === 2) otherUid = (await createUserWithEmailAndPassword(auth, `other-${email}`, password)).user.uid
    clients.push({ app, auth, database, ratings: createGenerationBookRatingsService(database), library: createGenerationLibraryService(database), lifecycle: createBookLifecycleService(database) })
  }
  await life().initializeProtocol(ctx(1, uid, 'bootstrap'))
  await life(2).initializeProtocol(ctx(1, otherUid, 'bootstrap'))
})
beforeEach(() => {
  bookId = `fictional-ratings-${++sequence}`
  runTransaction.mockReset().mockImplementation(sdk.runTransaction)
})
afterEach(() => { vi.unstubAllGlobals(); for (const client of clients) goOnline(client.database) })
afterAll(async () => { for (const client of clients) { goOffline(client.database); await deleteApp(client.app) } })

const id = '-1234567890123456789', secondId = '-2234567890123456789'
const payload = extras => ({ value:4, date:'2024-02-29', ...extras })
const path = (entryId=id, context=ctx()) => bookRatingsPath(context,entryId)
const make = async (entryId=id, extras={}) => { await ratings().createRating(ctx(),entryId,payload(extras));return ratings().getRating(ctx(),entryId) }
const conversion = async () => createRatingConversionOperation({context:ctx(),expected:(await ratings().getLegacySource(ctx())).token})

it('fails closed for non-demo databases',()=>{
 expect(()=>createGenerationBookRatingsService({app:{options:{projectId:'other'}}})).toThrow('emulator-only')
})
it('creates once at a stable ID with acknowledged identity and revision one',async()=>{
 await active();const r=await make();expect(r).toMatchObject({value:4,date:'2024-02-29',revision:1})
 expect(Object.isFrozen(r.token)).toBe(true);expect(Number.isSafeInteger(r.createdAt)).toBe(true)
 expect(await observed(path())).toEqual({value:4,date:'2024-02-29',revision:1,createdAt:r.createdAt,updatedAt:r.updatedAt})
})
it('replays identical creation including normalized empty impressions and rejects incompatible content',async()=>{
 await active();const first=await make();await ratings(1).createRating(ctx(),id,payload({impression:'   '}))
 await expect(ratings().createRating(ctx(),id,payload({impression:'Different'}))).rejects.toThrow('creation-conflict')
 expect(await observed(path())).not.toHaveProperty('impression');expect((await observed(path())).createdAt).toBe(first.createdAt)
})
it('rejects recreation intent after the rating has been edited',async()=>{
 await active();const r=await make();await ratings().updateRating(ctx(),id,payload(),r.token)
 await expect(ratings().createRating(ctx(),id,payload())).rejects.toThrow('creation-conflict')
 expect((await observed(path())).revision).toBe(2)
})
it('chooses one incompatible concurrent creation and preserves its entire payload',async()=>{
 await active();const result=await Promise.allSettled([ratings().createRating(ctx(),id,payload()),ratings(1).createRating(ctx(),id,payload({value:2,impression:'Other'}))])
 expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1)
 const stored=await observed(path());expect(stored.revision).toBe(1);expect([2,4]).toContain(stored.value)
})
it('converges identical concurrent creations',async()=>{
 await active();await Promise.all([ratings().createRating(ctx(),id,payload()),ratings(1).createRating(ctx(),id,payload())])
 expect(await ratings().getRatings(ctx())).toHaveLength(1);expect((await observed(path())).revision).toBe(1)
})
it('updates conditionally, preserves omitted impression and clears explicit whitespace',async()=>{
 await active();let r=await make(id,{impression:'Keep'})
 await ratings().updateRating(ctx(),id,payload({value:5}),r.token)
 expect(await observed(path())).toMatchObject({value:5,impression:'Keep',createdAt:r.createdAt,revision:2})
 r=await ratings().getRating(ctx(),id);await ratings().updateRating(ctx(),id,payload({impression:'  '}),r.token)
 expect(await observed(path())).not.toHaveProperty('impression');expect((await observed(path())).revision).toBe(3)
})
it('rejects stale CAS and identity tokens',async()=>{
 await active();const r=await make();await ratings().updateRating(ctx(),id,payload({value:5}),r.token)
 await expect(ratings(1).updateRating(ctx(),id,payload({value:1}),r.token)).rejects.toThrow('revision-conflict')
 await expect(ratings().deleteRating(ctx(),id,Object.freeze({...r.token,revision:2,createdAt:r.createdAt+1}))).rejects.toThrow('revision-conflict')
 expect((await observed(path())).value).toBe(5)
})
it('allows exactly one conflicting concurrent transaction',async()=>{
 await active();const r=await make()
 const result=await Promise.allSettled([ratings().updateRating(ctx(),id,payload({value:1}),r.token),ratings(1).updateRating(ctx(),id,payload({value:2}),r.token)])
 expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await observed(path())).revision).toBe(2)
})
it.each(['to-read','reading','abandoned'])('rejects creation/update in %s but permits terminal deletion',async status=>{
 await active();const r=await make();await svc().updateBookStatus(ctx(),status)
 await expect(ratings().createRating(ctx(),secondId,payload())).rejects.toThrow('status-conflict')
 await expect(ratings().updateRating(ctx(),id,payload({value:5}),r.token)).rejects.toThrow('status-conflict')
 await denied(update(location(path()),{value:5,revision:2,updatedAt:serverTimestamp()}))
 await ratings().deleteRating(ctx(),id,r.token)
 expect(await observed(path())).toMatchObject({deleted:true,revision:2,createdAt:r.createdAt})
})
it('writes a minimal terminal tombstone and reconciles identical delete retries',async()=>{
 await active();const r=await make(id,{impression:'Private'}),op=createRatingDeleteOperation({context:ctx(),entryId:id,expected:r.token})
 await ratings().execute(op);await ratings(1).execute(op);await ratings().reconcile(op)
 const stored=await observed(path());expect(Object.keys(stored).sort()).toEqual(['createdAt','deleted','revision','updatedAt'])
 expect(await ratings().getRating(ctx(),id)).toBeNull();expect(await ratings().getRatings(ctx())).toEqual([])
 await expect(ratings().createRating(ctx(),id,payload())).rejects.toThrow('creation-conflict')
 await expect(ratings().updateRating(ctx(),id,payload(),r.token)).rejects.toThrow('deleted')
})
it('denies tombstone mutation, deletion by null and raw delayed resurrection',async()=>{
 await active();const r=await make(),original=await observed(path());await denied(remove(location(path())))
 await ratings().deleteRating(ctx(),id,r.token);const tombstone=await observed(path())
 await denied(remove(location(path())));await denied(set(location(path()),original));await denied(update(location(path()),{revision:3,updatedAt:serverTimestamp()}))
 expect(await observed(path())).toEqual(tombstone)
})
it('enforces revision increments at the record boundary for direct SDK patches',async()=>{
 await active();await make();const original=await observed(path())
 for(const patch of [{value:5,updatedAt:serverTimestamp()},{revision:0,updatedAt:serverTimestamp()},{revision:3,updatedAt:serverTimestamp()},{createdAt:0,revision:2,updatedAt:serverTimestamp()}]) await denied(update(location(path()),patch))
 await update(location(path()),{value:5,revision:2,updatedAt:serverTimestamp()})
 await denied(set(location(path()),{...original,updatedAt:serverTimestamp()}))
 expect(await observed(path())).toMatchObject({value:5,revision:2,createdAt:original.createdAt})
})
it.each([{value:0},{value:6},{value:2.5},{date:'1900-02-29'},{date:''},{impression:'x'.repeat(161)},{impression:'bad\ntext'},{extra:true}])('rejects invalid raw rating fields %#',async patch=>{
 await active();await make();const original=await observed(path())
 await denied(update(location(path()),{...patch,revision:2,updatedAt:serverTimestamp()}));expect(await observed(path())).toEqual(original)
})
it('requires an atomic conversion marker and does not convert during reads',async()=>{
 await active();expect(await ratings().getRatings(ctx())).toEqual([]);expect((await ratings().getLegacySource(ctx())).status).toBe('unprocessed')
 expect(await observed(bookRatingsLegacyPath(ctx()))).toBeNull()
 await denied(set(location(path('legacy-rating-v1')),{value:4,date:'',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await denied(set(location(bookRatingsLegacyPath(ctx())),{version:1,sourceValue:4,processedAt:serverTimestamp()}))
 expect(await observed(bookRatingsLegacyPath(ctx()))).toBeNull()
})
it('converts a historical value once with unknown date and no invented impression',async()=>{
 await active();const op=await conversion();await ratings().convertLegacy(op);await ratings(1).convertLegacy(op)
 const raw=await observed(path('legacy-rating-v1'));expect(raw).toMatchObject({value:4,date:'',revision:1});expect(raw).not.toHaveProperty('impression')
 expect(await observed(bookRatingsLegacyPath(ctx()))).toMatchObject({version:1,sourceValue:4,processedAt:raw.createdAt})
 expect((await ratings().getLegacySource(ctx())).status).toBe('processed')
})
it('keeps unknown date only until explicitly replaced with a real civil date',async()=>{
 await active();await ratings().convertLegacy(await conversion());let r=await ratings().getRating(ctx(),'legacy-rating-v1')
 await ratings().updateRating(ctx(),r.id,payload({date:'',value:5}),r.token)
 r=await ratings().getRating(ctx(),r.id);await ratings().updateRating(ctx(),r.id,payload({date:'0001-01-01'}),r.token)
 r=await ratings().getRating(ctx(),r.id);await expect(ratings().updateRating(ctx(),r.id,payload({date:''}),r.token)).rejects.toThrow(TypeError)
 await denied(update(location(path(r.id)),{date:'',revision:4,updatedAt:serverTimestamp()}))
 expect((await observed(path(r.id))).date).toBe('0001-01-01')
})
it('keeps historical markers terminal after destination deletion',async()=>{
 await active();const op=await conversion();await ratings().convertLegacy(op)
 const r=await ratings().getRating(ctx(),'legacy-rating-v1');await ratings().deleteRating(ctx(),r.id,r.token)
 await ratings().convertLegacy(op);await denied(remove(location(bookRatingsLegacyPath(ctx()))))
 await denied(update(location(bookRatingsLegacyPath(ctx())),{sourceValue:5}))
 expect(await ratings().getRatings(ctx())).toEqual([]);expect((await observed(path(r.id))).deleted).toBe(true)
})
it('rejects changed sources and hostile source+conversion multipath',async()=>{
 await active();const op=await conversion();await svc().updateBookRating(ctx(),5)
 await expect(ratings().convertLegacy(op)).rejects.toThrow('source-conflict')
 await denied(update(location(bookDataPath(ctx())),{'library/rating':4,'bookRatingsLegacy':{version:1,sourceValue:4,processedAt:serverTimestamp()},'bookRatings/legacy-rating-v1':{value:4,date:'',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}}))
 expect(await observed(bookRatingsLegacyPath(ctx()))).toBeNull();expect((await observed(bookLibraryPath(ctx()))).rating).toBe(5)
})
it('rejects conversion outside finished and processes empty source read-only',async()=>{
 await active(ctx(),0,{rating:null});expect(await ratings().getLegacySource(ctx())).toEqual({status:'empty'})
 await svc().updateBookRating(ctx(),4);const op=await conversion();await svc().updateBookStatus(ctx(),'reading')
 await expect(ratings().convertLegacy(op)).rejects.toThrow('status-conflict');expect(await observed(bookRatingsLegacyPath(ctx()))).toBeNull()
})
it('reconciles concurrent conversions with the same source',async()=>{
 await active();const op=await conversion();await Promise.all([ratings().convertLegacy(op),ratings(1).convertLegacy(op)])
 expect(await ratings().getRatings(ctx())).toHaveLength(1);expect((await observed(path('legacy-rating-v1'))).revision).toBe(1)
})
it('never redirects captured operations to a readded generation',async()=>{
 await active();const r=await make(),old=ctx(),op=createRatingUpdateOperation({context:old,entryId:id,payload:payload({value:1}),expected:r.token})
 await life().deleteGeneration(old);const next=await life().beginNextGeneration(old);await svc().initializeLibrary(next,record(next));await life().activateGeneration(next)
 await ratings().createRating(next,id,payload({value:5}));await expect(ratings(1).execute(op)).rejects.toThrow('stale-generation')
 expect(await observed(bookDataPath(old))).toBeNull();expect((await observed(path(id,next))).value).toBe(5)
})
it('rejects an actual queued offline SDK write after purge and readd',async()=>{
 await active();await make();const raw=await observed(path());await get(location(path(),1));goOffline(clients[1].database)
 const rejection=denied(update(location(path(),1),{value:1,revision:2,updatedAt:serverTimestamp()}))
 await life().deleteGeneration(ctx());const next=await life().beginNextGeneration(ctx());await svc().initializeLibrary(next,record(next));await life().activateGeneration(next)
 await ratings().createRating(next,id,payload({value:5}));goOnline(clients[1].database);await rejection
 expect(await observed(bookDataPath(ctx()))).toBeNull();expect((await observed(path(id,next))).value).toBe(5);expect(raw.revision).toBe(1)
})
it('uses server evidence on a cold cache and after lost creation/update/delete acknowledgements',async()=>{
 await active();const create=createRatingCreateOperation({context:ctx(),entryId:id,payload:payload()})
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await ratings(1).execute(create);await ratings().reconcile(create);const r=await ratings(1).getRating(ctx(),id)
 const change=createRatingUpdateOperation({context:ctx(),entryId:id,payload:payload({value:5}),expected:r.token})
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await ratings().execute(change);await expect(ratings(1).execute(change)).rejects.toThrow('revision-conflict');await ratings(1).reconcile(change);expect((await observed(path())).revision).toBe(2)
 const remove=createRatingDeleteOperation({context:ctx(),entryId:id,expected:(await ratings().getRating(ctx(),id)).token})
 runTransaction.mockImplementationOnce(async(...args)=>{await sdk.runTransaction(...args);throw new Error('lost acknowledgement')})
 await ratings().execute(remove);expect(await observed(path())).toMatchObject({deleted:true,revision:3})
})
it('fails closed on missing server evidence and definite write failures without replacing IDs',async()=>{
 await active();runTransaction.mockRejectedValueOnce(new Error('simulated write failure'))
 await expect(ratings().createRating(ctx(),id,payload())).rejects.toThrow('simulated write failure');expect(await observed(path())).toBeNull()
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
 await expect(ratings().getRating(ctx(),id)).rejects.toThrow('network-error')
})
it('isolates users and preserves other books during generation purge',async()=>{
 await active();await make();const other=ctx(1,uid,`${bookId}-other`);await active(other);await ratings().createRating(other,id,payload())
 await expect(ratings(2).getRatings(ctx())).rejects.toThrow('owner-mismatch');await denied(update(location(path(),2),{revision:2,value:1,updatedAt:serverTimestamp()}))
 await life().deleteGeneration(ctx());expect((await observed(path(id,other))).value).toBe(4)
})
it('rejects ancestor replacement and hostile status/lifecycle changes before and after writes',async()=>{
 await active();await make();const before=await observed(bookDataPath(ctx()))
 await denied(set(location(bookDataPath(ctx())),before))
 await denied(update(location(bookDataPath(ctx())),{'library/status':'reading',[`bookRatings/${id}/value`]:1,[`bookRatings/${id}/revision`]:2,[`bookRatings/${id}/updatedAt`]:serverTimestamp()}))
 await denied(update(location(`users/${uid}`),{[`bookLifecycle/${bookId}/state`]:'deleting',[`bookData/${bookId}/1/bookRatings/${id}/revision`]:2,[`bookData/${bookId}/1/bookRatings/${id}/value`]:1,[`bookData/${bookId}/1/bookRatings/${id}/updatedAt`]:serverTimestamp()}))
 expect(await observed(bookDataPath(ctx()))).toEqual(before);expect((await observed(bookLifecyclePath(ctx()))).state).toBe('active')
})
it('requires finished both before and after a hostile atomic status change',async()=>{
 await active();await make();await svc().updateBookStatus(ctx(),'reading')
 await denied(update(location(bookDataPath(ctx())),{'library/status':'finished',[`bookRatings/${id}/revision`]:2,[`bookRatings/${id}/value`]:1,[`bookRatings/${id}/updatedAt`]:serverTimestamp()}))
 expect((await observed(bookLibraryPath(ctx()))).status).toBe('reading');expect((await observed(path())).revision).toBe(1)
})
it('rejects writes once locked and purges live ratings, tombstones and conversion markers completely',async()=>{
 await active();const r=await make();await make(secondId);await ratings().deleteRating(ctx(),secondId,(await ratings().getRating(ctx(),secondId)).token);await ratings().convertLegacy(await conversion())
 await life().lockDeletion(ctx());await denied(update(location(path()),{value:1,revision:2,updatedAt:serverTimestamp()}))
 await expect(ratings().deleteRating(ctx(),id,r.token)).rejects.toThrow('not-active')
 await life().purgeGeneration(ctx());expect(await observed(bookDataPath(ctx()))).toBeNull()
})
it('refuses revision overflow in service and raw SDK without resetting identity',async()=>{
 await active();await make();const raw=await observed(path()),token=await clients[0].auth.currentUser.getIdToken()
 // Only a local Emulator admin fixture can seed an unreachable boundary quickly.
 const url=`http://127.0.0.1:9000/${path()}.json?ns=demo-dear-pages`
 const response=await fetch(url,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({...raw,revision:Number.MAX_SAFE_INTEGER})})
 expect(response.ok).toBe(true);expect(token).toBeTruthy()
 const r=await ratings().getRating(ctx(),id);await expect(ratings().deleteRating(ctx(),id,r.token)).rejects.toThrow(RangeError)
 await denied(update(location(path()),{revision:Number.MAX_SAFE_INTEGER+1,updatedAt:serverTimestamp()}))
 expect((await observed(path())).revision).toBe(Number.MAX_SAFE_INTEGER)
})
it('orders known dates before unknown, then creation and ID without implicit conversion',async()=>{
 await active();await make(id,{date:'2024-01-01'});await make(secondId,{date:'9999-12-31'});await ratings().convertLegacy(await conversion())
 expect((await ratings().getRatings(ctx())).map(r=>r.id)).toEqual([secondId,id,'legacy-rating-v1'])
})
