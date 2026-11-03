import { getAuth } from 'firebase/auth'
import { ref, update, serverTimestamp } from 'firebase/database'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { validateRtdbPathSegment } from '../../src/utils/rtdbPathSegment.js'

export const LIMITS = Object.freeze({ rows: 32, bytes: 128 * 1024, receipts: 64, counter: 2147483647 })
const freeze = value => {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value) }
  return value
}
export function captureBatch(uid, intent, sequence, rows) {
  validateRtdbPathSegment(uid); validateRtdbPathSegment(intent)
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > LIMITS.counter || !rows.length || rows.length > LIMITS.rows) throw new RangeError('batch bounds')
  const seen = new Set()
  const guards = Object.fromEntries(Array.from({ length: LIMITS.rows }, (_, i) => [i, { enabled: false }]))
  const entries = {}, activity = {}
  for (const [i, input] of rows.entries()) {
    const row = structuredClone(input)
    validateRtdbPathSegment(row.bookId); validateRtdbPathSegment(row.collectionId)
    const tuple = `${row.bookId}/${row.collectionId}`
    if (seen.has(tuple)) throw new TypeError('duplicate tuple')
    seen.add(tuple)
    const before = row.before
    const effective = before.exists && before.epoch === row.epoch && before.present
    const changed = row.desired !== Boolean(effective)
    const after = changed ? { exists: true, epoch: row.epoch, present: row.desired, revision: before.exists && before.epoch === row.epoch ? before.revision + 1 : 1 } : before
    guards[i] = { enabled: true, ...row, after }
    entries[row.bookId] ??= {}
    entries[row.bookId][row.collectionId] = String(i)
    if (changed) activity[row.collectionId] = String(i)
  }
  const receipt = { uid, sequence, intent, guards, entries, ...(Object.keys(activity).length ? { activity } : {}) }
  if (new TextEncoder().encode(JSON.stringify(receipt)).length > LIMITS.bytes) throw new RangeError('batch bytes')
  return freeze(receipt)
}

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
