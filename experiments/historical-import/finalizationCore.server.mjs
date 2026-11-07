import { createMigrationIdentity } from '../../src/utils/generationMigrationContracts.js'
import { historicalFinalizationRecord, hasHistoricalFinalization } from '../../src/utils/historicalFinalizationRecord.js'
import { contractRecord } from '../../src/utils/generationOperationUtils.js'
import { contractData, sameContract } from '../../src/utils/generationContractData.js'
import { transformHistoricalSnapshot } from '../../src/utils/historicalGenerationTransformer.js'
import { verifyHistoricalImport } from './verify.mjs'
import { hash, sourceValue, planDigest } from './protocol.mjs'

const failure = code => Object.assign(new Error(`historical-finalization/${code}`), { code: `historical-finalization/${code}` })
const sourceDigest = user => hash(['dear-pages/historical-transform', 1, 'source', Object.fromEntries(
  ['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections'].filter(key => Object.hasOwn(user, key)).map(key => [key, user[key]]))])
const proofId = record => hash(['historical-finalization-v1', record.uid, record.migrationId, record.transformVersion, record.sourceVersion, record.planDigest, record.snapshotDigest, record.receiptsDigest])

/** Environment-neutral SERVER algorithm extracted from the validated finalizer.
 * No URL, credential discovery, network call, SDK initialization or public route.
 * There is no default authority/transport. Only a guarded server adapter may
 * supply these capabilities; an end-user proof is never an input.
 * readRoot returns the complete exported root + ETag. compareAndSwapRoot must
 * preserve that same scope (users AND accountControl), never user-only update.
 * Shipped adapters remain local-only; no real Firebase authority is supplied.
 */
export function createHistoricalFinalizer(authority) {
  if (typeof window !== 'undefined' || !authority) throw failure('server-authority-required')
  const methods = ['assertAuthorized', 'authorize', 'verifyAccountIdentity', 'readRoot', 'assertWritePolicy', 'compareAndSwapRoot']
  const captured = contractRecord(authority, [...methods, 'recordAuthority'])
  if (methods.some(method => typeof captured[method] !== 'function') || typeof captured.recordAuthority !== 'string') throw failure('server-authority-required')
  const transport = Object.freeze(captured)
  transport.assertAuthorized()
  async function finalize(input) {
    transport.assertAuthorized()
    const migration = createMigrationIdentity(input)
    if (migration.transformVersion !== 1) throw failure('unsupported-version')
    await transport.authorize()
    for (let attempt = 0; attempt < 4; attempt++) {
      transport.assertAuthorized()
      await transport.verifyAccountIdentity(migration.uid)
      const { etag, text } = await transport.readRoot()
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
        version: 1, authority: transport.recordAuthority, ...migration,
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
      await transport.assertWritePolicy()
      transport.assertAuthorized()
      // The adapter MUST compare-and-swap the root, including accountControl.
      const committed = await transport.compareAndSwapRoot(etag, next)
      if (committed === 'conflict') continue // Full re-verification; no stale proof replay.
      if (committed !== 'committed') throw failure('invalid-commit-observation')
      return contractData({ status: 'finalized', migration, finalizationId: proof.finalizationId })
    }
    throw failure('concurrent-root-change-retry-required')
  }
  return Object.freeze({ finalize })
}
