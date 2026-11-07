import { contractRecord } from './generationOperationUtils.js'
import { contractData, contractFingerprint } from './generationContractData.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'

// Read-only wire contract. This is not an approval issuer or signature check.
// Trust comes exclusively from the Emulator server-owned RTDB node and rules.
export function historicalFinalizationRecord(input) {
  const value = contractRecord(input, ['version', 'authority', 'uid', 'migrationId', 'transformVersion', 'sourceVersion', 'planDigest', 'snapshotDigest', 'receiptsDigest', 'finalizationId'])
  if (value.version !== 1 || value.authority !== 'emulator-root-cas-v1' || value.transformVersion !== 1) throw new TypeError('Unsupported historical finalization.')
  validateRtdbPathSegment(value.uid); validateRtdbPathSegment(value.migrationId)
  for (const field of ['sourceVersion', 'planDigest', 'snapshotDigest', 'receiptsDigest', 'finalizationId']) contractFingerprint(value[field])
  return contractData(value)
}
export function hasHistoricalFinalization(user, uid) {
  try {
    const value = historicalFinalizationRecord(user.historicalFinalization)
    return value.uid === uid && user.bookMigration?.id === value.migrationId && user.bookMigration?.version === value.transformVersion &&
      user.historicalImport?.stage === 'imported' && user.historicalImport?.phase === 'sealed' &&
      user.historicalImport?.sourceVersion === value.sourceVersion && user.historicalImport?.planDigest === value.planDigest
  } catch { return false }
}
