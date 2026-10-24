export const emulator = Object.freeze({
  projectId: 'demo-dear-pages', host: '127.0.0.1',
  auth: 9099, database: 9000, hub: 4400, logging: 4500, vite: 5501,
})

export const emulatorEnv = Object.freeze({
  VITE_FIREBASE_USE_EMULATORS: 'true',
  VITE_FIREBASE_API_KEY: 'demo-only-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-dear-pages.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'http://127.0.0.1:9000?ns=demo-dear-pages',
  VITE_FIREBASE_PROJECT_ID: 'demo-dear-pages',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-dear-pages.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: 'demo-dear-pages-app',
  VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIREBASE_AUTH_EMULATOR_PORT: '9099',
  VITE_FIREBASE_DATABASE_EMULATOR_PORT: '9000',
})

export function validateEmulatorEnv(env, mode, production = false) {
  if (mode !== 'emulator') {
    if (env.VITE_FIREBASE_USE_EMULATORS === 'true') {
      throw new Error('Firebase emulator requires --mode emulator')
    }
    return false
  }
  if (production) throw new Error('Firebase emulator mode cannot be built for production')
  for (const [key, value] of Object.entries(emulatorEnv)) {
    if (env[key] !== value) throw new Error(`Invalid emulator environment: ${key}`)
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_FIREBASE_') && !(key in emulatorEnv)) {
      throw new Error(`Unexpected emulator variable: ${key}`)
    }
  }
  return true
}
