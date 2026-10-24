import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator, ref, set, get, goOffline } from 'firebase/database'
import { emulator, emulatorEnv } from '../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady } from './emulatorSafety.mjs'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'

await assertEmulatorProject()
await assertEmulatorsReady()
const server = await createServer({ mode: 'emulator' })
await server.listen()
try {
  assert.equal(server.config.env.VITE_FIREBASE_PROJECT_ID, emulator.projectId)
  assert.equal(server.config.env.VITE_GOOGLE_BOOKS_API_KEY, undefined)
  assert.equal(server.config.env.VITE_GOOGLE_TRANSLATION_API_KEY, undefined)
  const page = await fetch(`http://${emulator.host}:${emulator.vite}`)
  const csp = page.headers.get('content-security-policy')
  assert.ok(csp.includes('connect-src'))
  assert.ok(!csp.includes('googleapis.com'))
  const health = await fetch(`http://${emulator.host}:${emulator.vite}/__emulator_health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).projectId, emulator.projectId)
  console.log('PASS: isolated Vite environment, CSP, local health endpoint')
} finally {
  await server.close()
}
const app = initializeApp({
  apiKey: emulatorEnv.VITE_FIREBASE_API_KEY,
  projectId: emulator.projectId,
  databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL,
})
const auth = getAuth(app)
connectAuthEmulator(auth, `http://${emulator.host}:${emulator.auth}`)
const database = getDatabase(app)
connectDatabaseEmulator(database, emulator.host, emulator.database)
const timeout = setTimeout(() => { console.error('Emulator integration timeout'); process.exit(1) }, 25000)
try {
  const { user } = await createUserWithEmailAndPassword(auth, `local-${Date.now()}@example.test`, 'local-only-password')
  const own = ref(database, `users/${user.uid}/emulatorSmoke`)
  await set(own, { isolated: true })
  assert.deepEqual((await get(own)).val(), { isolated: true })
  await assert.rejects(set(ref(database, 'users/another-local-user/emulatorSmoke'), true), /PERMISSION_DENIED|permission_denied/i)
  await assert.rejects(get(ref(database, 'users/another-local-user')), /permission[ _]denied/i)
  const response = await fetch(`http://${emulator.host}:${emulator.database}/users/${user.uid}.json?ns=${emulator.projectId}`)
  assert.equal(response.status, 401)
  const token = JSON.parse(Buffer.from((await user.getIdToken()).split('.')[1], 'base64url'))
  assert.equal(token.aud, emulator.projectId)
  assert.equal(token.iss, `https://securetoken.google.com/${emulator.projectId}`)
  console.log('PASS: local SDK Auth + RTDB, demo token, owner read/write, cross-user and anonymous denial')
} finally {
  clearTimeout(timeout)
  goOffline(database)
  await deleteApp(app)
}
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.rtdb.config.js'], {
    stdio: 'inherit', env: { ...process.env, CI: 'true' },
  })
  child.once('error', reject)
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`RTDB tests failed: ${code}`)))
})
// SDK background retry timers can outlive deleteApp in Node. All checks and cleanup
// above are awaited; explicitly finish so emulators:exec can stop its processes.
process.exit(0)
