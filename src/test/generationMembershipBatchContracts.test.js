import { expect, it } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { contractData } from '../utils/generationContractData.js'
import { MEMBERSHIP_BATCH_LIMITS, createMembershipBatchSelection, captureMembershipSelection, createMembershipBatch, captureMembershipBatch, validateMembershipBatch, expectedMembershipState, assertMembershipSelectionCurrent, membershipReceiptSlot, nextMembershipSequence, reconcileMembershipReceipt, projectMembershipReceiptCommit, projectBookReceiptPurge, membershipEnvelopeBytes, assertSameMembershipBatchIntent } from '../utils/generationMembershipBatchContracts.js'

const uid = 'owner', absent = { exists: false }
const state = (epoch = 1, present = true, revision = 1) => ({ exists: true, epoch, present, revision })
const row = (bookId = 'book', collectionId = 'collection', before = absent, desired = true) => ({ bookId, generation: 1, collectionId, epoch: 1, catalogCreatedAt: 10, before: { ...before }, desired })
const batch = (rows = [row()], sequence = 1, intent = 'intent') => captureMembershipBatch(uid, intent, sequence, rows)
const head = (sequence, intent = 'intent') => ({ sequence, slot: sequence % 64, intent })
const observation = (op, fields = {}) => ({ uid, source: 'server', head: head(op.sequence, op.intent), receipt: structuredClone(op), ...fields })
const freeze = input => contractData(input)

it('captures frozen book/catalog contexts and canonicalizes only the initial selection', () => {
  const context = createBookMutationContext({ uid, bookId: 'book', generation: 1 }), collection = createCollectionContext({ uid, collectionId: 'collection', epoch: 1 })
  const selection = captureMembershipSelection({ uid, entries: [{ context, collection, catalogCreatedAt: 10, before: absent, desired: true }] })
  expect(selection.rows).toEqual([row()])
  expect(createMembershipBatch({ selection, intentId: 'intent', sequence: 1 })).toEqual(batch())
  expect(() => captureMembershipSelection({ uid, entries: [{ context: { ...context }, collection, catalogCreatedAt: 10, before: absent, desired: true }] })).toThrow()
  expect(() => captureMembershipSelection({ uid: 'other', entries: [{ context, collection, catalogCreatedAt: 10, before: absent, desired: true }] })).toThrow()
  expect(batch([row('b'), row('a')])).toEqual(batch([row('a'), row('b')]))
})
it('keeps nested inputs immutable without freezing or mutating caller-owned objects', () => {
  const input = [row()], result = batch(input)
  input[0].before.exists = true; input[0].bookId = 'changed'
  expect(result.guards[0].before).toEqual(absent)
  expect(result.guards[0].bookId).toBe('book')
  expect(Object.isFrozen(result.guards[0].before)).toBe(true)
  expect(Object.isFrozen(input[0])).toBe(false)
  expect(validateMembershipBatch(result)).toEqual(result)
  expect(() => validateMembershipBatch(structuredClone(result))).toThrow()
})
it('does not change sequence, generation, epoch, intent or payload when retrying', () => {
  const original = batch()
  expect(assertSameMembershipBatchIntent(original, batch())).toEqual(original)
  for (const next of [batch([row()], 2), batch([row()], 1, 'other'), batch([{ ...row(), generation: 2 }]), batch([{ ...row(), epoch: 2 }]), batch([row('book', 'collection', absent, false)])]) expect(() => assertSameMembershipBatchIntent(original, next)).toThrow()
})
it.each([
  [absent, 1, true, state()],
  [absent, 1, false, absent],
  [state(), 1, true, state()],
  [state(), 1, false, state(1, false, 2)],
  [state(1, false, 4), 1, true, state(1, true, 5)],
  [state(1, true, 8), 2, true, state(2, true, 1)],
  [state(1, true, 8), 2, false, state(1, true, 8)],
])('prepares the expected result without conflating absent and residual states %#', (before, epoch, desired, after) => {
  expect(expectedMembershipState(before, epoch, desired)).toEqual(after)
})
it('does not write membership activity for no-op guards', () => {
  expect(batch([row('b', 'c', state(), true)])).not.toHaveProperty('activity')
  expect(batch([row('b', 'c', absent, false)])).not.toHaveProperty('activity')
  expect(batch([row('b', 'c')]).activity).toEqual({ c: '0' })
})
it.each(['generation', 'epoch', 'catalogCreatedAt', 'before'])('rejects stale %s including unchanged/absent guard rows', field => {
  const captured = createMembershipBatchSelection({ uid, rows: [row('b', 'c', absent, false)] })
  const changed = { ...captured.rows[0], [field]: field === 'before' ? state() : 2 }
  expect(() => assertMembershipSelectionCurrent(captured, { uid, rows: [changed] })).toThrow()
})
it('observes every declared tuple without claiming an atomic server snapshot', () => {
  const selection = createMembershipBatchSelection({ uid, rows: [row('a'), row('b')] })
  expect(assertMembershipSelectionCurrent(selection, { uid, rows: [row('b'), row('a'), row('extra')] })).toEqual(selection)
  expect(() => assertMembershipSelectionCurrent(selection, { uid, rows: [row('a')] })).toThrow()
})
it('rejects duplicate tuples and contradictory captured identities', () => {
  expect(() => batch([row(), row()])).toThrow()
  expect(() => batch([row('a', 'c'), { ...row('b', 'c'), epoch: 2 }])).toThrow()
  expect(() => batch([row('a', 'c'), { ...row('a', 'd'), generation: 2 }])).toThrow()
})
it.each([0, -1, 1.5, 2147483648, NaN])('rejects invalid sequence %s', sequence => {
  expect(() => batch([row()], sequence)).toThrow()
})
it.each(['', 'bad/id', 'bad.id', 'bad id', '__proto__', 'constructor', 'prototype', 'x'.repeat(129), '\ud800'])('rejects forbidden IDs %#', id => {
  expect(() => batch([row(id)])).toThrow()
  expect(() => batch([row()], 1, id)).toThrow()
})
it('bounds 32 guarded rows including no-op rows and preserves the provisional byte limit', () => {
  const rows = Array.from({ length: 32 }, (_, i) => row(`book-${i}`, 'collection', absent, false))
  const op = batch(rows)
  expect(Object.values(op.guards).filter(g => g.enabled)).toHaveLength(32)
  expect(() => batch([...rows, row('extra')])).toThrow('batch bounds')
  expect(() => batch([])).toThrow('batch bounds')
  expect(MEMBERSHIP_BATCH_LIMITS.bytes).toBe(131072)
  expect(membershipEnvelopeBytes(op)).toBeLessThan(MEMBERSHIP_BATCH_LIMITS.bytes)
})
it.each(['guard-result', 'mapping', 'unknown', 'extra-guard', 'disabled-extra', 'reordered'])('rejects forged/noncanonical retry envelope %s without silently repairing it', kind => {
  const forged = structuredClone(batch([row('a'), row('b')]))
  if (kind === 'guard-result') forged.guards[0].after.revision = 99
  if (kind === 'mapping') forged.entries.a.collection = '1'
  if (kind === 'unknown') forged.extra = true
  if (kind === 'extra-guard') forged.guards[32] = { enabled: false }
  if (kind === 'disabled-extra') forged.guards[2].bookId = 'forged'
  if (kind === 'reordered') { const old = forged.guards[0]; forged.guards[0] = forged.guards[1]; forged.guards[1] = old }
  expect(() => validateMembershipBatch(freeze(forged))).toThrow()
})
it('accepts RTDB dense-array guard representation only as a faithful observation', () => {
  const op = batch(), wire = structuredClone(op)
  wire.guards = Object.values(wire.guards)
  expect(validateMembershipBatch(wire, false)).toEqual(op)
  expect(() => validateMembershipBatch(freeze(wire))).toThrow()
  wire.guards.pop()
  expect(() => validateMembershipBatch(wire, false)).toThrow()
})
it('preserves numeric book/collection IDs when RTDB encodes nested maps as arrays', () => {
  const op = batch([row('0', '0')])
  const wire = structuredClone(op)
  wire.guards = Object.values(wire.guards); wire.entries = [['0']]; wire.activity = ['0']
  expect(validateMembershipBatch(wire, false)).toEqual(op)
  expect(reconcileMembershipReceipt(op, observation(op, { receipt: wire }))).toMatchObject({ status: 'confirmed' })
  const receipts = [null, wire]
  const next = batch([row('0', '0', state(), true)], 2)
  expect(projectMembershipReceiptCommit(next, { uid, head: head(1), receipts }).receipts[1]).toEqual(op)
})
it('reconciles normal, lost, conflicting and unavailable confirmations', () => {
  const op = batch()
  expect(reconcileMembershipReceipt(op, observation(op))).toEqual({ status: 'confirmed', canRetry: false })
  expect(reconcileMembershipReceipt(op, observation(op))).toEqual(reconcileMembershipReceipt(op, observation(op)))
  expect(reconcileMembershipReceipt(op, observation(op, { receipt: batch([row()], 1, 'other'), head: head(1, 'other') }))).toEqual({ status: 'conflict', canRetry: false })
  expect(reconcileMembershipReceipt(op, observation(op, { source: 'unavailable' }))).toEqual({ status: 'uncertain', canRetry: false })
  expect(reconcileMembershipReceipt(op, observation(op, { head: null, receipt: null }))).toEqual({ status: 'not-committed', canRetry: true })
  expect(reconcileMembershipReceipt(op, observation(op, { receipt: null }))).toEqual({ status: 'indeterminate', canRetry: false })
  expect(reconcileMembershipReceipt(batch([row()], 3), { uid, source: 'server', head: null, receipt: null })).toEqual({ status: 'conflict', canRetry: false })
})
it('refuses mismatched heads, slots, owners and impossible future receipts', () => {
  const op = batch()
  for (const fields of [{ uid: 'other' }, { head: { sequence: 1, slot: 2, intent: 'intent' } }, { head: head(1, 'other') }, { head: null }]) expect(() => reconcileMembershipReceipt(op, observation(op, fields))).toThrow()
})
it('allocates slots deterministically and fails closed at counter exhaustion', () => {
  expect([membershipReceiptSlot(1), membershipReceiptSlot(64), membershipReceiptSlot(65)]).toEqual([1, 0, 1])
  expect(nextMembershipSequence(0)).toBe(1)
  expect(nextMembershipSequence(2147483646)).toBe(2147483647)
  expect(() => nextMembershipSequence(2147483647)).toThrow()
  expect(() => expectedMembershipState(state(1, true, 2147483647), 1, false)).toThrow()
  expect(expectedMembershipState(state(1, true, 2147483647), 1, true).revision).toBe(2147483647)
})
it('projects eviction without turning a missing proof into replay permission', () => {
  const receipts = {}
  for (let n = 1; n <= 64; n++) receipts[n % 64] = batch([row('book', 'collection', absent, false)], n, `intent-${n}`)
  const journal = { uid, head: head(64, 'intent-64'), receipts }
  const next = batch([row('book', 'collection', absent, false)], 65, 'intent-65')
  const projected = projectMembershipReceiptCommit(next, journal)
  expect(Object.keys(projected.receipts)).toHaveLength(64)
  expect(projected.evicted.sequence).toBe(1)
  expect(projected.receipts[1]).toEqual(next)
  expect(projected.receipts[0].sequence).toBe(64)
  const first = receipts[1]
  expect(reconcileMembershipReceipt(first, { uid, source: 'server', head: projected.head, receipt: projected.receipts[1] })).toEqual({ status: 'indeterminate', canRetry: false })
  expect(() => projectMembershipReceiptCommit(first, { uid, head: projected.head, receipts: projected.receipts })).toThrow('Occupied or stale sequence')
})
it('purges the whole journal while retaining sequence and listing lost evidence', () => {
  const op = batch(), journal = { uid, head: head(1), receipts: { 1: op } }
  const context = createBookMutationContext({ uid, bookId: 'book', generation: 1 })
  const purged = projectBookReceiptPurge({ context, lifecycle: { generation: 1, state: 'deleting' }, journal })
  expect(purged).toEqual({ uid, head: head(1), receipts: {}, lostEvidenceSequences: [1] })
  expect(reconcileMembershipReceipt(op, { uid, source: 'server', head: purged.head, receipt: null })).toMatchObject({ status: 'indeterminate', canRetry: false })
  expect(() => projectBookReceiptPurge({ context, lifecycle: { generation: 2, state: 'deleting' }, journal })).toThrow()
  expect(() => projectBookReceiptPurge({ context, lifecycle: { generation: 1, state: 'active' }, journal })).toThrow()
})
