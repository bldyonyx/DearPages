import { it, expect } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { emulatorEnv } from '../../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { createGenerationLibraryService } from '../../src/services/generationLibraryService.js'
import { createGenerationCollectionCatalogService } from '../../src/services/generationCollectionCatalogService.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext } from '../../src/utils/generationCollectionContracts.js'
import { prototype, captureBatch } from './prototype.mjs'

it('C boundary profile: final two counter commits succeed; overflow and old replay fail', async () => {
  await assertEmulatorProject(); await assertEmulatorsReady()
  const app = initializeApp({ projectId: 'demo-dear-pages', apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, 'feasibility-boundary')
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000)
  try {
    const uid = (await createUserWithEmailAndPassword(auth, `boundary-${Date.now()}@example.test`, 'fictional-password')).user.uid
    const base = `users/${uid}`, p = prototype(db)
    await set(ref(db, `accountControl/${uid}`), { state: 'active', legacyClosed: false })
    await update(ref(db), { [`accountControl/${uid}/legacyClosed`]: true, [`${base}/bookProtocol`]: { version: 2, state: 'migrating' }, [`${base}/bookMigration`]: { id: 'boundary', version: 1 } })
    await set(ref(db, `${base}/bookProtocol/state`), 'ready')
    const context = createBookMutationContext({ uid, bookId: 'book', generation: 1 })
    const life = createBookLifecycleService(db), lib = createGenerationLibraryService(db)
    await life.initializeGeneration(context); await lib.initializeLibrary(context, { id: 'book', title: 'Boundary fixture', status: 'to-read', addedAt: 1 }); await life.activateGeneration(context)
    const collection = createCollectionContext({ uid, collectionId: 'collection', epoch: 1 })
    await createGenerationCollectionCatalogService(db).createCollection(collection, { name: 'Boundary collection' })
    const meta = await p.read(uid, `${base}/collectionCatalog/collection`)
    const row = { bookId: 'book', generation: 1, collectionId: 'collection', epoch: 1, catalogCreatedAt: meta.createdAt, before: { exists: false }, desired: true }
    const first = captureBatch(uid, 'near-limit', 2147483646, [row])
    await p.execute(first)
    const last = captureBatch(uid, 'last', 2147483647, [{ ...row, before: { exists: true, epoch: 1, present: true, revision: 1 }, desired: false }])
    await p.execute(last)
    expect((await p.read(uid, `${base}/batchHead`)).sequence).toBe(2147483647)
    const before = await p.read(uid, base)
    const forged = structuredClone(last); forged.sequence = 2147483648; forged.intent = 'overflow'
    await expect(update(ref(db), p.writes(forged))).rejects.toThrow(/permission[ _-]?denied/i)
    await expect(update(ref(db), p.writes(first))).rejects.toThrow(/permission[ _-]?denied/i)
    expect(await p.read(uid, base)).toEqual(before)
  } finally { goOffline(db); await deleteApp(app) }
})
