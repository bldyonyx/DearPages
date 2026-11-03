import { getAuth } from 'firebase/auth'
import { ref, update, serverTimestamp } from 'firebase/database'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { captureMembershipBatch, MEMBERSHIP_BATCH_LIMITS } from '../../src/utils/generationMembershipBatchContracts.js'

// Construction is now shared with the pure contracts. Network capabilities below
// remain isolated demo-only, with their existing guard and SDK attack surface.
export const LIMITS = MEMBERSHIP_BATCH_LIMITS
export const captureBatch = captureMembershipBatch

/** All network capabilities remain demo-only. No app singleton is imported. */
export function prototype(database) {
  createBookLifecycleService(database)
  const auth = getAuth(database.app)
  const owner = uid => {
    createBookLifecycleService(database)
    if (auth.currentUser?.uid !== uid) throw new Error('owner mismatch')
  }
  async function read(uid, path) {
    owner(uid)
    const token = await auth.currentUser.getIdToken()
    owner(uid)
    const url = new URL(`http://127.0.0.1:9000/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', 'demo-dear-pages'); url.searchParams.set('auth', token)
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(`server read ${response.status}`)
      return await response.json()
    } catch { throw new Error('server evidence unavailable') }
  }
  function writes(batch) {
    const { uid, sequence, intent } = batch
    owner(uid)
    const base = `users/${uid}`
    const updates = { [`${base}/batchHead`]: { sequence, slot: sequence % 64, intent }, [`${base}/batchReceipts/${sequence % 64}`]: batch }
    for (const guard of Object.values(batch.guards)) {
      if (!guard.enabled) continue
      if (JSON.stringify(guard.before) === JSON.stringify(guard.after)) continue
      const { exists: _exists, ...value } = guard.after
      updates[`${base}/bookData/${guard.bookId}/${guard.generation}/collectionMemberships/${guard.collectionId}`] = value
    }
    for (const collectionId of Object.keys(batch.activity || {})) {
      const row = batch.guards[batch.activity[collectionId]]
      updates[`${base}/collectionActivity/${collectionId}`] = { at: serverTimestamp(), catalogCreatedAt: row.catalogCreatedAt }
    }
    return updates
  }
  async function reconcile(batch) {
    const state = await read(batch.uid, `users/${batch.uid}`)
    const sequence = state?.batchHead?.sequence ?? 0
    const stored = state?.batchReceipts?.[batch.sequence % 64]
    // Compare canonical data, not object insertion order returned by RTDB.
    const canonical = value => value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
    if (stored?.sequence === batch.sequence) return JSON.stringify(canonical(stored)) === JSON.stringify(canonical(batch)) ? 'confirmed' : 'conflict'
    return sequence >= batch.sequence ? 'indeterminate' : 'not-committed'
  }
  async function execute(batch) {
    const status = await reconcile(batch)
    if (status === 'confirmed') return status
    if (status !== 'not-committed') throw new Error(status)
    owner(batch.uid)
    try { await update(ref(database), writes(batch)) } catch (error) {
      if (await reconcile(batch) === 'confirmed') return 'confirmed'
      throw error
    }
    const confirmed = await reconcile(batch)
    if (confirmed !== 'confirmed') throw new Error(confirmed)
    return confirmed
  }
  return { read, writes, execute, reconcile }
}
