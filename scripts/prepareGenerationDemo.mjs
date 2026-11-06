import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, update, goOffline } from 'firebase/database'
import { emulator, emulatorEnv } from '../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from './emulatorSafety.mjs'
import { createGenerationApplicationService } from '../src/services/generationApplicationService.js'

// Explicit local FIXTURE creation, never an existing-account bootstrap/migration.
assert.equal(process.argv.length, 2, 'No account/project/config arguments accepted')
await assertEmulatorProject(); await assertEmulatorsReady()
const app = initializeApp({ projectId: emulator.projectId, apiKey: emulatorEnv.VITE_FIREBASE_API_KEY, databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }, 'generation-demo-preparation')
const auth = getAuth(app); connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`, { disableWarnings: true })
const db = getDatabase(app); connectDatabaseEmulator(db, emulator.host, emulator.database)
try {
  // A fresh Auth identity only. No sign-in/reuse path, even if signup conflicts.
  const email = `generation-demo-${Date.now()}@example.test`, password = 'local-only-generation-password'
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  const base = `users/${user.uid}`
  await set(ref(db, `accountControl/${user.uid}`), { state: 'active', legacyClosed: false })
  await set(ref(db, `${base}/profile`), { displayName: 'Lecteur fictif', email, createdAt: Date.now() })
  await set(ref(db, `${base}/preferences`), { language: 'fr', onboardingCompleted: true })
  // Reuse the existing proof's synthetic empty-account provisioning. This is NOT
  // an import, completeness witness, or permission to erase historical branches.
  await update(ref(db), { [`${base}/bookProtocol`]: { version: 2, state: 'migrating' }, [`${base}/bookMigration`]: { id: 'synthetic-ui-fixture', version: 1 }, [`accountControl/${user.uid}/legacyClosed`]: true })
  await set(ref(db, `${base}/bookProtocol/state`), 'ready')
  const facade = createGenerationApplicationService(db, { uid: user.uid })
  assert.deepEqual(await facade.library.getActiveBooks(), [])
  console.log(JSON.stringify({ fixture: 'local-demo-only', email, password, url: `http://${emulator.host}:${emulator.vite}/library` }, null, 2))
} finally { goOffline(db); await deleteApp(app) }
// Firebase's Node SDK can retain retry timers after deleteApp (as in testEmulators).
// All fixture writes, server verification and app cleanup above have completed.
process.exit(0)
