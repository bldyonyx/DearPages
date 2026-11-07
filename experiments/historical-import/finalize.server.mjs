import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { verify as verifyRules } from './composeRules.mjs'
import { createHistoricalFinalizer } from './finalizationCore.server.mjs'

const failure = code => Object.assign(new Error(`historical-finalization/${code}`), { code: `historical-finalization/${code}` })
const rootUrl = 'http://127.0.0.1:9000/.json?ns=demo-dear-pages&format=export'
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-dear-pages/accounts:lookup'
function guard() {
  if (typeof window !== 'undefined' || process.env.HISTORICAL_FINALIZATION_SERVER !== 'true' ||
    process.env.GCLOUD_PROJECT !== 'demo-dear-pages' || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN !== 'owner') throw failure('controlled-emulator-server-required')
}
/** The ONLY executable authority adapter. Existing API/CLI and strict demo
 * guards are preserved. No production adapter, ADC, service-account discovery,
 * user token, endpoint override or production opt-in flag is available.
 */
export function createEmulatorFinalizationServer({ request = globalThis.fetch } = {}) {
  guard()
  async function call(url, options = {}) {
    guard()
    try { return await request(url, { ...options, headers: { Authorization: `Bearer ${process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN}`, ...options.headers }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) }) }
    catch { throw failure('observation-or-commit-uncertain') }
  }
  return createHistoricalFinalizer({
    recordAuthority: 'emulator-root-cas-v1',
    assertAuthorized: guard,
    authorize: async () => { guard(); await assertEmulatorProject(); await assertEmulatorsReady() },
    verifyAccountIdentity: async uid => {
      const account = await call(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [uid] }) })
      if (!account.ok) throw failure('auth-observation-denied')
      const identity = (await account.json()).users?.find(user => user.localId === uid)
      if (!identity?.email?.endsWith('@example.test') || identity.disabled) throw failure('fictional-auth-account-required')
    },
    readRoot: async () => {
      const response = await call(rootUrl, { headers: { 'X-Firebase-ETag': 'true' } })
      if (!response.ok) throw failure('root-observation-denied')
      return { etag: response.headers.get('etag'), text: await response.text() }
    },
    assertWritePolicy: async () => {
      await verifyRules()
      const response = await call('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages')
      if (!response.ok || !isDeepStrictEqual(await response.json(), JSON.parse(await readFile(new URL('database.rules.json', import.meta.url), 'utf8')))) throw failure('unexpected-emulator-rules')
    },
    compareAndSwapRoot: async (etag, root) => {
      const response = await call(rootUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(root) })
      if (response.status === 412) return 'conflict'
      if (!response.ok) throw failure(response.status >= 500 ? 'observation-or-commit-uncertain' : 'commit-denied')
      return 'committed'
    },
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw failure('explicit-uid-and-migration-id-required')
  const result = await createEmulatorFinalizationServer().finalize({ uid: process.argv[2], migrationId: process.argv[3], transformVersion: 1 })
  console.log(JSON.stringify(result)) // No token, snapshot or personal content.
}
