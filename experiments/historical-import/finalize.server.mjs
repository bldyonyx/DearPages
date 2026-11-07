import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { createMigrationIdentity } from '../../src/utils/generationMigrationContracts.js'
import { historicalFinalizationRecord, hasHistoricalFinalization } from '../../src/utils/historicalFinalizationRecord.js'
import { contractData, sameContract } from '../../src/utils/generationContractData.js'
import { transformHistoricalSnapshot } from '../../src/utils/historicalGenerationTransformer.js'
import { verifyHistoricalImport } from './verify.mjs'
import { hash, sourceValue, planDigest } from './protocol.mjs'
import { verify as verifyRules } from './composeRules.mjs'

const failure = code => Object.assign(new Error(`historical-finalization/${code}`), { code: `historical-finalization/${code}` })
const rootUrl = 'http://127.0.0.1:9000/.json?ns=demo-dear-pages&format=export'
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-dear-pages/accounts:lookup'
function guard() {
  if (typeof window !== 'undefined' || process.env.HISTORICAL_FINALIZATION_SERVER !== 'true' ||
    process.env.GCLOUD_PROJECT !== 'demo-dear-pages' || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN !== 'owner') throw failure('controlled-emulator-server-required')
}
const sourceDigest = user => hash(['dear-pages/historical-transform', 1, 'source', Object.fromEntries(
  ['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections'].filter(key => Object.hasOwn(user, key)).map(key => [key, user[key]]))])
const proofId = record => hash(['historical-finalization-v1', record.uid, record.migrationId, record.transformVersion, record.sourceVersion, record.planDigest, record.snapshotDigest, record.receiptsDigest])

/** Controlled Node process ONLY. No HTTP handler, client token, supplied proof,
 * endpoint override, Auth write, Admin SDK or unconditional data write.
 * Emulator admin REST deliberately bypasses rules: the root ETag CAS covers
 * accountControl AND user data AND all other users. Any conflict rereads/rechecks.
 * Never weaken this to a user-only CAS or a precheck followed by update().
 */
export function createEmulatorFinalizationServer({ request = globalThis.fetch } = {}) {
  guard()
  async function call(url, options = {}) {
    guard()
    try { return await request(url, { ...options, headers: { Authorization: `Bearer ${process.env.HISTORICAL_EMULATOR_ADMIN_TOKEN}`, ...options.headers }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) }) }
    catch { throw failure('observation-or-commit-uncertain') }
  }
  async function finalize(input) {
    guard()
    const migration = createMigrationIdentity(input)
    if (migration.transformVersion !== 1) throw failure('unsupported-version')
    await assertEmulatorProject(); await assertEmulatorsReady()
    for (let attempt = 0; attempt < 4; attempt++) {
      guard()
      // Lookup is read-only; no role, claims, token or Auth user is created.
      const account = await call(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [migration.uid] }) })
      if (!account.ok) throw failure('auth-observation-denied')
      const identity = (await account.json()).users?.find(user => user.localId === migration.uid)
      if (!identity?.email?.endsWith('@example.test') || identity.disabled) throw failure('fictional-auth-account-required')
      const response = await call(rootUrl, { headers: { 'X-Firebase-ETag': 'true' } })
      if (!response.ok) throw failure('root-observation-denied')
      const etag = response.headers.get('etag'), text = await response.text()
      if (!etag || Buffer.byteLength(text, 'utf8') > 16 * 1024 * 1024) throw failure('unbounded-or-unversioned-root')
      // Keep the export representation of unrelated data/priorities verbatim.
      // Only the target must satisfy the strict migration JSON contracts.
      const root = JSON.parse(text), user = root?.users?.[migration.uid], control = root?.accountControl?.[migration.uid]
      if (!user || control?.state !== 'active' || control.legacyClosed !== true) throw failure('account-blocked')
      if (!sameContract(user.bookMigration ?? null, { id: migration.migrationId, version: 1 })) throw failure('identity-conflict')
      if (user.bookProtocol?.state === 'ready') {
        const proof = historicalFinalizationRecord(user.historicalFinalization)
        if (!sameContract(user.bookProtocol, { version: 2, state: 'ready' }) || !hasHistoricalFinalization(user, migration.uid) || proof.finalizationId !== proofId(proof) ||
          proof.sourceVersion !== sourceDigest(user) || proof.receiptsDigest !== hash(['historical-finalization-receipts-v1', user.importReceipts || {}])) throw failure('stale-finalization')
        // Runtime edits/deletions are legitimate. Never reimport or reactivate.
        return contractData({ status: 'already-finalized', migration, finalizationId: proof.finalizationId })
      }
      if (user.historicalFinalization != null) throw failure('unexpected-approval')
      const verification = verifyHistoricalImport(user, migration)
      if (verification.status !== 'verified-unfinalized') throw failure('independent-verification-failed')
      const preparation = await transformHistoricalSnapshot(sourceValue(user), migration)
      if (preparation.status !== 'prepared' || preparation.sourceVersion !== user.historicalImport.sourceVersion || planDigest(preparation) !== user.historicalImport.planDigest) throw failure('plan-or-source-conflict')
      const fields = {
        version: 1, authority: 'emulator-root-cas-v1', ...migration,
        sourceVersion: preparation.sourceVersion, planDigest: planDigest(preparation),
        snapshotDigest: hash(['historical-finalization-snapshot-v1', user]),
        receiptsDigest: hash(['historical-finalization-receipts-v1', user.importReceipts || {}]),
      }
      const proof = historicalFinalizationRecord({ ...fields, finalizationId: proofId(fields) })
      const next = structuredClone(root), target = next.users[migration.uid]
      for (const book of preparation.books) {
        const life = target.bookLifecycle?.[book.context.bookId]
        if (!sameContract(life ?? null, { generation: 1, state: 'creating' })) throw failure('lifecycle-conflict')
        life.state = 'active'
      }
      target.historicalFinalization = proof
      target.bookProtocol = { version: 2, state: 'ready' }
      await verifyRules()
      const rulesResponse = await call('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages')
      if (!rulesResponse.ok || !isDeepStrictEqual(await rulesResponse.json(), JSON.parse(await readFile(new URL('database.rules.json', import.meta.url), 'utf8')))) throw failure('unexpected-emulator-rules')
      // Single CAS commit. No historical/profile/preferences/Auth data is changed.
      const committed = await call(rootUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(next) })
      if (committed.status === 412) continue // Full re-verification, never replay a stale proof.
      if (!committed.ok) throw failure(committed.status >= 500 ? 'observation-or-commit-uncertain' : 'commit-denied')
      return contractData({ status: 'finalized', migration, finalizationId: proof.finalizationId })
    }
    throw failure('concurrent-root-change-retry-required')
  }
  return Object.freeze({ finalize })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw failure('explicit-uid-and-migration-id-required')
  const result = await createEmulatorFinalizationServer().finalize({ uid: process.argv[2], migrationId: process.argv[3], transformVersion: 1 })
  console.log(JSON.stringify(result)) // No token, snapshot or personal content.
}
