import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { emulator, validateEmulatorEnv } from '../config/firebaseEmulator.js'

const isolated = validateEmulatorEnv(import.meta.env, import.meta.env.MODE, import.meta.env.PROD)
// True only after the existing strict demo configuration/origin/health guards succeed.
export const isFirebaseEmulator = isolated
if (isolated) {
  if (globalThis.location?.origin !== `http://${emulator.host}:${emulator.vite}`) {
    throw new Error('Firebase emulator requires the dedicated local Vite origin')
  }
  const health = await fetch('/__emulator_health', {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
  })
  if (!health.ok || (await health.json()).projectId !== emulator.projectId) {
    throw new Error('Local Firebase emulators unavailable; refusing Firebase initialization')
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Firebase application instance used by Dear Pages.
 */
const app = initializeApp(firebaseConfig)

/**
 * Firebase Authentication instance.
 *
 * Handles account creation, login, logout and authentication providers
 * such as Google.
 */
export const auth = getAuth(app)
if (isolated) connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`)

/**
 * Firebase Realtime Database instance.
 *
 * Stores private user data such as library books, collections,
 * preferences and reviews.
 */
export const database = getDatabase(app)
if (isolated) connectDatabaseEmulator(database, emulator.host, emulator.database)

export default app
