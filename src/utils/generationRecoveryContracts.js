import { contractRecord, captureBookContext } from './generationOperationUtils.js'
import { createBookMutationContext } from './bookMutationContext.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { boundedCounter, compareContractIds, contractBoolean, contractData, contractEnum, contractFingerprint, frozenContract, sameContract } from './generationContractData.js'

export function createLifecycleSnapshot(input) {
  if (input === null) return null
  const value = contractRecord(input, ['generation', 'state'])
  return Object.freeze({ generation: boundedCounter(value.generation), state: contractEnum(value.state, ['creating', 'active', 'deleting', 'deleted']) })
}
export function createAccountControl(input) {
  const value = contractRecord(input, ['state', 'legacyClosed'])
  contractEnum(value.state, ['active', 'deleting', 'deleted']); contractBoolean(value.legacyClosed)
  if (value.state !== 'active' && !value.legacyClosed) throw new TypeError('Terminal account requires legacy closure.')
  return Object.freeze({ state: value.state, legacyClosed: value.legacyClosed })
}
export function ordinaryOperationEligibility(input) {
  const value = contractRecord(input, ['account', 'protocolState'])
  const account = value.account === null ? null : createAccountControl(value.account)
  contractEnum(value.protocolState, ['absent', 'migrating', 'ready'])
  if (!account || account.state !== 'active') return contractData({ allowed: false, reason: account ? 'account-terminal' : 'account-uninitialized' })
  if (value.protocolState !== 'ready' || !account.legacyClosed) return contractData({ allowed: false, reason: 'protocol-not-ready' })
  return contractData({ allowed: true, reason: null })
}
export function createAccountTransition(input) {
  const value = contractRecord(input, ['uid', 'intentId', 'expected', 'target', 'protocolAfter', 'userDataAbsent'])
  const uid = validateRtdbPathSegment(value.uid), intentId = validateRtdbPathSegment(value.intentId)
  const expected = value.expected === null ? null : createAccountControl(value.expected), target = createAccountControl(value.target)
  contractEnum(value.protocolAfter, ['absent', 'migrating', 'ready']); contractBoolean(value.userDataAbsent)
  const initial = !expected && target.state === 'active' && !target.legacyClosed
  const close = expected?.state === 'active' && !expected.legacyClosed && target.state === 'active' && target.legacyClosed && value.protocolAfter === 'migrating'
  const lock = expected?.state === 'active' && target.state === 'deleting'
  const finish = expected?.state === 'deleting' && target.state === 'deleted' && value.userDataAbsent
  if (!initial && !close && !lock && !finish) throw new TypeError('Forbidden account transition; no reopening or implicit reset.')
  return contractData({ type: 'account.transition', uid, intentId, expected, target, protocolAfter: value.protocolAfter, userDataAbsent: value.userDataAbsent })
}
export function discoverBookRecovery(input) {
  const value = contractRecord(input, ['uid', 'source', 'account', 'protocolState', 'lifecycles'])
  const uid = validateRtdbPathSegment(value.uid)
  contractEnum(value.source, ['server', 'unavailable'])
  const eligibility = ordinaryOperationEligibility({ account: value.account, protocolState: value.protocolState })
  if (!eligibility.allowed) return contractData({ status: eligibility.reason, actions: [] })
  if (value.source !== 'server') return contractData({ status: 'uncertain', actions: [] })
  const snapshots = contractData(value.lifecycles)
  if (!snapshots || Array.isArray(snapshots) || typeof snapshots !== 'object') throw new TypeError('Expected lifecycle map.')
  const actions = Object.entries(snapshots).sort(([a], [b]) => compareContractIds(a, b)).flatMap(([bookId, raw]) => {
    const life = createLifecycleSnapshot(raw)
    if (!life) throw new TypeError('Null lifecycle entries must be absent in the snapshot map.')
    const context = createBookMutationContext({ uid, bookId, generation: life.generation })
    if (life.state === 'deleting') return [{ kind: 'resume-deletion', context }]
    if (life.state === 'creating') return [{ kind: 'review-creation', context, choices: ['resume-creation', 'abandon-creation'] }]
    return []
  })
  return contractData({ status: 'observed', actions })
}
export function createBookRecoveryIntent(input) {
  const value = contractRecord(input, ['context', 'intentId', 'kind', 'initializationId'])
  const context = captureBookContext(value.context)
  const kind = contractEnum(value.kind, ['resume-deletion', 'resume-creation', 'abandon-creation'])
  if (kind === 'resume-creation') contractFingerprint(value.initializationId)
  else if (value.initializationId !== null) throw new TypeError('Unexpected creation identity.')
  return contractData({ ...value, context, intentId: validateRtdbPathSegment(value.intentId) })
}
export function reconcileBookRecovery(intentInput, observation) {
  frozenContract(intentInput)
  const intent = createBookRecoveryIntent(intentInput)
  const value = contractRecord(observation, ['uid', 'source', 'account', 'protocolState', 'lifecycle', 'hasBookData', 'hasLibrary', 'initializationId'])
  if (value.uid !== intent.context.uid) throw new TypeError('Recovery owner mismatch.')
  contractEnum(value.source, ['server', 'unavailable'])
  contractBoolean(value.hasBookData); contractBoolean(value.hasLibrary)
  if (value.initializationId !== null) contractFingerprint(value.initializationId)
  const eligibility = ordinaryOperationEligibility({ account: value.account, protocolState: value.protocolState })
  if (!eligibility.allowed) return contractData({ status: eligibility.reason, canRetry: false })
  if (value.source !== 'server') return contractData({ status: 'uncertain', canRetry: false })
  const life = createLifecycleSnapshot(value.lifecycle)
  if (!life || life.generation !== intent.context.generation) return contractData({ status: 'stale', canRetry: false })
  if (value.hasLibrary && !value.hasBookData) return contractData({ status: 'contradictory', canRetry: false })
  if (intent.kind === 'resume-deletion' || intent.kind === 'abandon-creation') {
    if (life.state === 'deleted') return contractData({ status: value.hasBookData ? 'contradictory' : 'confirmed', canRetry: false })
    const pending = life.state === 'deleting' || intent.kind === 'abandon-creation' && life.state === 'creating'
    return contractData({ status: pending ? 'pending' : 'stale', canRetry: pending })
  }
  if (value.hasLibrary && value.initializationId !== intent.initializationId) return contractData({ status: 'conflict', canRetry: false })
  if (life.state === 'active') return contractData({ status: value.hasLibrary && value.hasBookData ? 'confirmed' : 'contradictory', canRetry: false })
  return contractData({ status: life.state === 'creating' ? 'pending' : 'stale', canRetry: life.state === 'creating' })
}
export function createAccountDeletionIntent(input) {
  const value = contractRecord(input, ['uid', 'intentId', 'expected'])
  return contractData({ type: 'account.delete', uid: validateRtdbPathSegment(value.uid), intentId: validateRtdbPathSegment(value.intentId), expected: createAccountControl(value.expected) })
}
export function reconcileAccountDeletion(intentInput, observation) {
  frozenContract(intentInput)
  const valueIntent = contractRecord(intentInput, ['type', 'uid', 'intentId', 'expected'])
  const { type, ...args } = valueIntent
  const intent = createAccountDeletionIntent(args)
  if (type !== 'account.delete' || !sameContract(intent, intentInput)) throw new TypeError('Invalid account deletion intention.')
  const value = contractRecord(observation, ['uid', 'source', 'control', 'userDataExists', 'authExists'])
  if (value.uid !== intent.uid) throw new TypeError('Account deletion owner mismatch.')
  contractEnum(value.source, ['server', 'unavailable']); contractBoolean(value.userDataExists); contractBoolean(value.authExists)
  if (value.source !== 'server') return contractData({ status: 'uncertain', next: null })
  const control = createAccountControl(value.control)
  const states = ['active', 'deleting', 'deleted']
  if (states.indexOf(control.state) < states.indexOf(intent.expected.state) || intent.expected.legacyClosed && !control.legacyClosed || !value.authExists && (value.userDataExists || control.state !== 'deleted')) return contractData({ status: 'contradictory', next: null })
  if (control.state === 'active') return contractData({ status: 'pending', next: 'lock-account' })
  if (control.state === 'deleted' && value.userDataExists) return contractData({ status: 'contradictory', next: null })
  if (value.userDataExists) return contractData({ status: 'pending', next: 'purge-user-data' })
  if (control.state === 'deleting') return contractData({ status: 'pending', next: 'finalize-rtdb-barrier' })
  return contractData({ status: value.authExists ? 'pending' : 'confirmed', next: value.authExists ? 'delete-auth' : null })
}
