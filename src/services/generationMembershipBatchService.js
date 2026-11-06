import { getAuth } from 'firebase/auth'
import { ref, update, serverTimestamp } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { captureBookContext } from '../utils/generationOperationUtils.js'
import { sameContract } from '../utils/generationContractData.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import {
  validateMembershipBatch, reconcileMembershipReceipt, membershipReceiptSlot,
  projectBookReceiptPurge, MEMBERSHIP_BATCH_LIMITS,
} from '../utils/generationMembershipBatchContracts.js'

export { MEMBERSHIP_BATCH_LIMITS }
const result = (status, canRetry = false) => Object.freeze({ status, canRetry })
const failure = code => Object.assign(new Error(`generation-batch/${code}`), { code: `generation-batch/${code}` })
const denied = error => /permission[ _-]?denied/i.test(error?.code || error?.message || '')

/** Emulator-only adapter. Inject transport hooks for caller-boundary fault tests.
 * Server observations use one snapshot so the head and receipt cannot be torn.
 * A call issues at most one multipath write; it never allocates a new intention.
 * Requires the generation-feasibility rule profile (not individual-membership rules).
 *
 * execute/reconcile accept a frozen createMembershipBatch envelope and return
 * {status, canRetry}. confirmed is historical commit evidence; conflict is an
 * occupied/incompatible sequence; indeterminate is missing proof at a passed
 * sequence; uncertain is unavailable evidence. Only reconcile's not-committed
 * result permits an explicit retry of the SAME envelope. execute additionally
 * returns rejected for a server denial with observed absence of that commit.
 * Invalid envelopes/configurations/owners throw before writing.
 *
 * deleteGeneration locks the captured generation then calls resumeDeletion.
 * resumeDeletion never locks an active book. Both return confirmed, stale,
 * conflict, contradictory, rejected or uncertain, always without automatic retry.
 * Purging clears ALL of the owner's receipts, including other books'
 * evidence, while preserving batchHead. No recovery discovery or Auth work occurs.
 * writes exposes a validated multipath for diagnostics; rules remain authoritative.
 */
export function createGenerationMembershipBatchService(database, { fetch: request = globalThis.fetch, update: commit = update } = {}) {
  const lifecycle = createBookLifecycleService(database)
  const auth = getAuth(database.app)
  function owner(uid) {
    createBookLifecycleService(database) // Recheck the complete local SDK configuration.
    validateRtdbPathSegment(uid)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
  }
  async function read(uid) {
    owner(uid)
    const token = await auth.currentUser.getIdToken()
    owner(uid)
    const url = new URL(`http://${emulator.host}:${emulator.database}/users/${encodeURIComponent(uid)}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    try {
      const response = await request(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw failure('observation-unavailable')
      const value = await response.json()
      owner(uid)
      return value
    } catch { throw failure('observation-unavailable') }
  }
  async function reconcile(input) {
    const batch = validateMembershipBatch(input)
    owner(batch.uid)
    let state
    try { state = await read(batch.uid) } catch { return result('uncertain') }
    return reconcileMembershipReceipt(batch, { uid: batch.uid, source: 'server', head: state?.batchHead ?? null, receipt: state?.batchReceipts?.[membershipReceiptSlot(batch.sequence)] ?? null })
  }
  function writes(input) {
    const batch = validateMembershipBatch(input)
    owner(batch.uid)
    const base = `users/${batch.uid}`, slot = membershipReceiptSlot(batch.sequence)
    const values = { [`${base}/batchHead`]: { sequence: batch.sequence, slot, intent: batch.intent }, [`${base}/batchReceipts/${slot}`]: batch }
    for (const guard of Object.values(batch.guards)) {
      if (!guard.enabled || sameContract(guard.before, guard.after)) continue
      const { exists: _exists, ...value } = guard.after
      values[`${base}/bookData/${guard.bookId}/${guard.generation}/collectionMemberships/${guard.collectionId}`] = value
    }
    for (const [collectionId, index] of Object.entries(batch.activity || {})) {
      values[`${base}/collectionActivity/${collectionId}`] = { at: serverTimestamp(), catalogCreatedAt: batch.guards[index].catalogCreatedAt }
    }
    return values
  }
  async function execute(input) {
    const batch = validateMembershipBatch(input)
    const before = await reconcile(batch)
    if (!before.canRetry) return before
    let error
    try { owner(batch.uid); await commit(ref(database), writes(batch)) } catch (cause) { error = cause }
    const after = await reconcile(batch)
    if (after.status !== 'not-committed') return after
    // A denial is definite only for this attempted write, after checking whether
    // another identical caller committed. Network failures remain uncertain.
    return error && denied(error) ? result('rejected') : result('uncertain')
  }
  function purgeObservation(context, state) {
    const life = state?.bookLifecycle?.[context.bookId]
    if (!life || life.generation !== context.generation) return result('stale')
    if (life.state === 'deleted') return result(state?.bookData?.[context.bookId] == null ? 'confirmed' : 'contradictory')
    if (life.state !== 'deleting') return result('conflict')
    return result('pending', true)
  }
  async function resumeDeletion(input) {
    const context = captureBookContext(input)
    owner(context.uid)
    let state
    try { state = await read(context.uid) } catch { return result('uncertain') }
    const before = purgeObservation(context, state)
    if (!before.canRetry) return before
    projectBookReceiptPurge({ context, lifecycle: state.bookLifecycle[context.bookId], journal: { uid: context.uid, head: state.batchHead ?? null, receipts: state.batchReceipts ?? {} } })
    const base = `users/${context.uid}`
    let error
    try {
      owner(context.uid)
      await commit(ref(database), {
        [`${base}/bookData/${context.bookId}/${context.generation}`]: null,
        [`${base}/bookLifecycle/${context.bookId}`]: { generation: context.generation, state: 'deleted' },
        [`${base}/batchReceipts`]: null,
        [`${base}/purgeContext`]: { bookId: context.bookId, generation: context.generation },
      })
    } catch (cause) { error = cause }
    try {
      const after = purgeObservation(context, await read(context.uid))
      return after.status === 'pending' ? result(error && denied(error) ? 'rejected' : 'uncertain') : after
    } catch { return result('uncertain') }
  }
  async function deleteGeneration(input) {
    const context = captureBookContext(input)
    owner(context.uid)
    let state
    try { state = await read(context.uid) } catch { return result('uncertain') }
    const life = state?.bookLifecycle?.[context.bookId]
    if (!life || life.generation !== context.generation) return result('stale')
    if (['active', 'creating'].includes(life.state)) {
      try { await lifecycle.lockDeletion(context) } catch {
        // No second lock attempt: resume observes whether the first took effect.
      }
    }
    return resumeDeletion(context)
  }
  return Object.freeze({ execute, reconcile, writes, deleteGeneration, resumeDeletion })
}
