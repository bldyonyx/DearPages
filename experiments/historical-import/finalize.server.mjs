import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { verify as verifyRules } from './composeRules.mjs'
import { createHistoricalFinalizer } from './finalizationCore.server.mjs'
import { createLocalFirebaseRest } from './firebaseRest.server.mjs'

const failure = code => Object.assign(new Error(`historical-finalization/${code}`), { code: `historical-finalization/${code}` })
function guard() {
  if (typeof window !== 'undefined' || process.env.HISTORICAL_FINALIZATION_SERVER !== 'true' ||
    process.env.GCLOUD_PROJECT !== 'demo-dear-pages' || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN !== 'owner') throw failure('controlled-emulator-server-required')
}
/** Existing operational Emulator entrypoint. API/CLI and strict demo
 * guards are preserved. No production adapter, ADC, service-account discovery,
 * user token, endpoint override or production opt-in flag is available.
 */
export function createEmulatorFinalizationServer({ request = globalThis.fetch } = {}) {
  guard()
  const rest = createLocalFirebaseRest({ request, assertAuthorized: guard, getAccessToken: async () => process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN })
  return createHistoricalFinalizer({
    recordAuthority: 'emulator-root-cas-v1',
    assertAuthorized: guard,
    authorize: async () => { guard(); await assertEmulatorProject(); await assertEmulatorsReady() },
    verifyAccountIdentity: async uid => {
      const identity = await rest.lookupAccount(uid)
      if (!identity?.email?.endsWith('@example.test') || identity.disabled) throw failure('fictional-auth-account-required')
    },
    readRoot: rest.readRoot,
    assertWritePolicy: async () => {
      await verifyRules()
      if (!isDeepStrictEqual(await rest.readRules(), JSON.parse(await readFile(new URL('database.rules.json', import.meta.url), 'utf8')))) throw failure('unexpected-emulator-rules')
    },
    compareAndSwapRoot: rest.compareAndSwapRoot,
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw failure('explicit-uid-and-migration-id-required')
  const result = await createEmulatorFinalizationServer().finalize({ uid: process.argv[2], migrationId: process.argv[3], transformVersion: 1 })
  console.log(JSON.stringify(result)) // No token, snapshot or personal content.
}
