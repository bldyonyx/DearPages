import { getAuth } from 'firebase/auth'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { createGenerationMembershipBatchService } from './generationMembershipBatchService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import { contractRecord } from '../utils/generationOperationUtils.js'
import { contractData, frozenContract, sameContract } from '../utils/generationContractData.js'
import {
  createAccountControl, createBookRecoveryIntent, createLifecycleSnapshot,
  discoverBookRecovery, ordinaryOperationEligibility, reconcileBookRecovery,
} from '../utils/generationRecoveryContracts.js'

const failure = code => Object.assign(new Error(`generation-recovery/${code}`), { code: `generation-recovery/${code}` })
const outcome = (status, reason = null) => contractData({ status, canRetry: false, ...(reason ? { reason } : {}) })

/** Isolated Emulator coordinator, requiring the generation-feasibility rules.
 * discover(uid) returns frozen contract actions, never writes, and leaves creating
 * books as review-creation with explicit choices. It never activates or abandons.
 * reconcile(intent) and resumeDeletion(intent) accept a frozen resume-deletion
 * createBookRecoveryIntent, preserving its uid/bookId/generation across awaits.
 * resumeDeletion issues at most one receipt-aware purge, never a lifecycle lock.
 * Callers explicitly retry the SAME intention after uncertain/rejected results.
 * confirmed always requires server-observed deleted + absence of all book data.
 * No timers, automatic retry, creation recovery, background worker or Auth deletion.
 * fetch/update are injectable transport hooks, also passed to the batch adapter.
 */
export function createGenerationRecoveryService(database, { fetch: request = globalThis.fetch, update } = {}) {
  createBookLifecycleService(database)
  const batch = createGenerationMembershipBatchService(database, { fetch: request, update })
  const auth = getAuth(database.app)
  function owner(uid) {
    createBookLifecycleService(database)
    validateRtdbPathSegment(uid)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
  }
  async function read(uid, path) {
    owner(uid)
    let token
    try { token = await auth.currentUser.getIdToken() } catch { throw failure('authentication-unavailable') }
    owner(uid)
    const url = new URL(`http://${emulator.host}:${emulator.database}/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    let response
    try {
      response = await request(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
    } catch { throw failure('network-error') }
    owner(uid)
    if (response.status === 401 || response.status === 403) throw failure('permission-denied')
    if (!response.ok) throw failure('server-error')
    try {
      // Copy untrusted observation data without allowing accessors/prototypes.
      const value = contractData(await response.json())
      owner(uid)
      return value
    } catch (error) {
      if (error.code) throw error
      throw failure('invalid-response')
    }
  }
  function observationFailure(error) {
    const code = error?.code?.replace('generation-recovery/', '')
    if (['owner-mismatch', 'emulator-only'].includes(code) || error?.code === 'book-lifecycle/emulator-only') throw error
    if (code === 'permission-denied') return outcome('rejected', code)
    if (code === 'invalid-response' || error instanceof TypeError || error instanceof RangeError) return outcome('contradictory', 'invalid-observation')
    return outcome('uncertain', code || 'observation-unavailable')
  }
  async function observe(uid) {
    // No parent read above users/{uid}. The terminal fence is external, so bracket
    // the user snapshot with fence reads. Rules remain the atomic write authority;
    // these separate reads are NOT a cross-branch atomic snapshot.
    const first = await read(uid, `accountControl/${uid}`)
    const state = await read(uid, `users/${uid}`)
    const last = await read(uid, `accountControl/${uid}`)
    const account = last === null ? null : createAccountControl(last)
    let protocolState = 'absent'
    if (state !== null && (typeof state !== 'object' || Array.isArray(state))) throw failure('invalid-response')
    if (state?.bookProtocol != null) {
      const protocol = contractRecord(state.bookProtocol, ['version', 'state'])
      if (protocol.version !== 2 || !['migrating', 'ready'].includes(protocol.state)) throw failure('invalid-response')
      protocolState = protocol.state
    }
    const eligibility = ordinaryOperationEligibility({ account, protocolState })
    if (!eligibility.allowed) return { result: outcome(eligibility.reason) }
    if (!sameContract(first, last)) return { result: outcome('uncertain', 'account-changed') }
    // RTDB represents numeric-key maps as arrays. Adapt only this known map;
    // preserve indices and never compact book identities.
    const raw = state?.bookLifecycle ?? {}
    const lifecycles = Array.isArray(raw) ? Object.fromEntries(raw.flatMap((value, i) => value === null ? [] : [[String(i), value]])) : raw
    const discovered = discoverBookRecovery({ uid, source: 'server', account, protocolState, lifecycles })
    return { state, account, protocolState, discovered }
  }
  async function discover(uid) {
    owner(uid)
    try {
      const observed = await observe(uid)
      return observed.result ? contractData({ status: observed.result.status, ...(observed.result.reason ? { reason: observed.result.reason } : {}), actions: [] }) : observed.discovered
    } catch (error) {
      const result = observationFailure(error)
      return contractData({ status: result.status, reason: result.reason, actions: [] })
    }
  }
  function capture(input) {
    frozenContract(input)
    const intent = createBookRecoveryIntent(input)
    if (intent.kind !== 'resume-deletion') throw new TypeError('Only explicit resume-deletion intentions are supported.')
    owner(intent.context.uid)
    return intent
  }
  function reconcileObserved(intent, observed) {
    if (observed.result) return observed.result
    const { context } = intent, { state, account, protocolState } = observed
    const life = createLifecycleSnapshot(state?.bookLifecycle?.[context.bookId] ?? null)
    if (life?.generation === context.generation && life.state === 'creating') return outcome('decision-required')
    return reconcileBookRecovery(intent, {
      uid: context.uid, source: 'server', account, protocolState, lifecycle: life,
      hasBookData: state?.bookData?.[context.bookId] != null,
      hasLibrary: state?.bookData?.[context.bookId]?.[context.generation]?.library != null,
      initializationId: null,
    })
  }
  async function reconcile(input) {
    const intent = capture(input)
    try { return reconcileObserved(intent, await observe(intent.context.uid)) }
    catch (error) { return observationFailure(error) }
  }
  async function resumeDeletion(input) {
    const intent = capture(input)
    const before = await reconcile(intent)
    if (before.status !== 'pending') return before
    let attempted
    try { attempted = await batch.resumeDeletion(intent.context) }
    catch (error) { return observationFailure(error) }
    // Never promote an adapter result or lost acknowledgement to success without
    // fresh server evidence, including the external account fence.
    const after = await reconcile(intent)
    if (after.status !== 'pending') return after
    return attempted.status === 'rejected' ? outcome('rejected', 'purge-denied') : outcome('uncertain', 'purge-unconfirmed')
  }
  return Object.freeze({ discover, reconcile, resumeDeletion })
}
