import { contractRecord, contractArray } from './generationOperationUtils.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { boundedCounter, canonicalContract, compareContractIds, contractData, contractEnum, contractFingerprint, frozenContract, sameContract } from './generationContractData.js'

export const MIGRATION_STAGES = Object.freeze(['frozen', 'inventoried', 'planned', 'imported', 'verified', 'purging', 'complete'])
export const IMPORT_KINDS = Object.freeze(['library', 'note', 'rating', 'historicalSources', 'noteMarker', 'reviewMarker', 'ratingMarker', 'collection', 'membership'])
export function createMigrationIdentity(input) {
  const value = contractRecord(input, ['uid', 'migrationId', 'transformVersion'])
  return Object.freeze({ uid: validateRtdbPathSegment(value.uid), migrationId: validateRtdbPathSegment(value.migrationId), transformVersion: boundedCounter(value.transformVersion) })
}
export function captureMigrationIdentity(input) {
  const identity = createMigrationIdentity(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected frozen migration identity.')
  return identity
}
export function assertSameMigration(first, second) {
  if (!sameContract(captureMigrationIdentity(first), captureMigrationIdentity(second))) throw new TypeError('Migration identity mismatch; retargeting forbidden.')
}

/** Identity VALUE, not an RTDB key. Storage encoding/hashing is deliberately
 * outside this contract. JSON tuple encoding is unambiguous and synchronous. */
export function createMigrationUnit(input) {
  const value = contractRecord(input, ['migration', 'kind', 'scope'])
  const migration = captureMigrationIdentity(value.migration), kind = contractEnum(value.kind, IMPORT_KINDS)
  const scope = contractArray(value.scope).map(validateRtdbPathSegment)
  const length = ['note', 'rating', 'membership'].includes(kind) ? 2 : 1
  if (scope.length !== length) throw new TypeError('Invalid migration unit scope.')
  const unitId = canonicalContract([migration.uid, migration.migrationId, migration.transformVersion, kind, scope])
  return contractData({ migration, kind, scope, unitId })
}
export function validateMigrationUnit(input) {
  const value = contractRecord(input, ['migration', 'kind', 'scope', 'unitId'])
  const unit = createMigrationUnit({ migration: value.migration, kind: value.kind, scope: value.scope })
  if (value.unitId !== unit.unitId) throw new TypeError('Forged migration unit identity.')
  frozenContract(input)
  return unit
}
export function createMigrationDiagnostic(input) {
  const value = contractRecord(input, ['migration', 'unitId', 'code', 'field'])
  const migration = captureMigrationIdentity(value.migration)
  contractEnum(value.code, ['invalid-id', 'invalid-field', 'missing-required', 'unknown-field', 'incompatible-source', 'orphan', 'marker-conflict', 'identity-conflict', 'contradictory-state'])
  if (value.unitId !== null && (typeof value.unitId !== 'string' || !value.unitId)) throw new TypeError('Invalid diagnostic unit.')
  if (typeof value.field !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value.field)) throw new TypeError('Diagnostic field must be a schema field, not data content.')
  return contractData({ ...value, migration, blocking: true })
}
function diagnostic(input, migration) {
  const value = contractRecord(input, ['migration', 'unitId', 'code', 'field', 'blocking'])
  if (value.blocking !== true) throw new TypeError('An anomaly cannot be silently waived.')
  const { blocking: _blocking, ...args } = value
  const result = createMigrationDiagnostic(args)
  assertSameMigration(migration, result.migration)
  return result
}
function units(input, migration) {
  const seen = new Set()
  return contractArray(input).map(value => {
    const unit = validateMigrationUnit(value)
    assertSameMigration(migration, unit.migration)
    if (seen.has(unit.unitId)) throw new TypeError('Duplicate migration unit.')
    seen.add(unit.unitId)
    return unit
  }).sort((a, b) => compareContractIds(a.unitId, b.unitId))
}
export function createMigrationPlan(input) {
  const value = contractRecord(input, ['migration', 'sourceVersion', 'units', 'diagnostics'])
  const migration = captureMigrationIdentity(value.migration)
  const entries = units(value.units, migration)
  const diagnostics = contractArray(value.diagnostics).map(item => diagnostic(item, migration))
    .sort((a, b) => compareContractIds(canonicalContract(a), canonicalContract(b)))
  const ids = new Set(entries.map(unit => unit.unitId))
  if (diagnostics.some(item => item.unitId !== null && !ids.has(item.unitId))) throw new TypeError('Diagnostic references an unknown plan unit.')
  return contractData({ migration, sourceVersion: contractFingerprint(value.sourceVersion), units: entries, diagnostics, status: diagnostics.length ? 'blocked' : 'planned' })
}
export function validateMigrationPlan(input) {
  const value = contractRecord(input, ['migration', 'sourceVersion', 'units', 'diagnostics', 'status'])
  const { status, ...args } = value
  const plan = createMigrationPlan(args)
  if (status !== plan.status || !sameContract(input, plan)) throw new TypeError('Non-canonical migration plan.')
  frozenContract(input)
  return plan
}
export function assertSameMigrationPlan(first, second) {
  const before = validateMigrationPlan(first), after = validateMigrationPlan(second)
  if (!sameContract(before, after)) throw new TypeError('Frozen migration plan changed; no implicit replanning.')
  return before
}
export function createMigrationCheckpoint(input) {
  const value = contractRecord(input, ['migration', 'stage', 'completedUnits'])
  const migration = captureMigrationIdentity(value.migration)
  return contractData({ migration, stage: contractEnum(value.stage, MIGRATION_STAGES), completedUnits: units(value.completedUnits, migration) })
}
export function advanceMigrationCheckpoint(current, next) {
  frozenContract(current); frozenContract(next)
  const before = createMigrationCheckpoint(current), after = createMigrationCheckpoint(next)
  assertSameMigration(before.migration, after.migration)
  const difference = MIGRATION_STAGES.indexOf(after.stage) - MIGRATION_STAGES.indexOf(before.stage)
  const ids = new Set(after.completedUnits.map(unit => unit.unitId))
  if (difference < 0 || difference > 1 || before.completedUnits.some(unit => !ids.has(unit.unitId))) throw new TypeError('Checkpoint must advance monotonically without skipping stages.')
  return after
}
export function createMigrationTransition(input) {
  const value = contractRecord(input, ['migration', 'intentId', 'from', 'to'])
  const migration = captureMigrationIdentity(value.migration)
  contractEnum(value.from, ['absent', 'migrating', 'ready'])
  contractEnum(value.to, ['absent', 'migrating', 'ready'])
  const pair = `${value.from}:${value.to}`
  if (!['absent:migrating', 'migrating:ready'].includes(pair)) throw new TypeError('Forbidden migration transition.')
  return contractData({ ...value, migration, intentId: validateRtdbPathSegment(value.intentId), type: 'migration.transition', legacyClosed: true })
}
export function assertMigrationReady(planInput, checkpointInput, evidence) {
  const plan = validateMigrationPlan(planInput)
  frozenContract(checkpointInput)
  const checkpoint = createMigrationCheckpoint(checkpointInput)
  assertSameMigration(plan.migration, checkpoint.migration)
  const value = contractRecord(evidence, ['source', 'legacyClosed', 'legacyPurged', 'accountActive'])
  if (value.source !== 'server' || value.legacyClosed !== true || value.legacyPurged !== true || value.accountActive !== true || plan.status !== 'planned' || checkpoint.stage !== 'complete' || !sameContract(plan.units, checkpoint.completedUnits)) throw new TypeError('Migration readiness not established.')
  return true // Supplied evidence only: not server attestation of completeness.
}
export function reconcileMigrationTransition(intent, observation) {
  frozenContract(intent)
  const fields = contractRecord(intent, ['migration', 'intentId', 'from', 'to', 'type', 'legacyClosed'])
  const { type: _type, legacyClosed: _closed, ...args } = fields
  const expected = createMigrationTransition(args)
  if (!sameContract(intent, expected)) throw new TypeError('Invalid migration intention.')
  const value = contractRecord(observation, ['source', 'migration', 'state', 'legacyClosed'])
  contractEnum(value.source, ['server', 'unavailable'])
  contractEnum(value.state, ['absent', 'migrating', 'ready'])
  if (value.source === 'unavailable') return contractData({ status: 'uncertain', canRetry: false })
  if (value.state === 'absent') {
    if (value.migration !== null || value.legacyClosed !== false) return contractData({ status: 'conflict', canRetry: false })
    return contractData({ status: expected.from === 'absent' ? 'pending' : 'conflict', canRetry: expected.from === 'absent' })
  }
  if (!sameContract(captureMigrationIdentity(value.migration), expected.migration)) return contractData({ status: 'stale', canRetry: false })
  if (value.legacyClosed !== true) return contractData({ status: 'conflict', canRetry: false })
  const confirmed = value.state === expected.to || expected.to === 'migrating' && value.state === 'ready'
  return contractData({ status: confirmed ? 'confirmed' : 'pending', canRetry: !confirmed })
}
