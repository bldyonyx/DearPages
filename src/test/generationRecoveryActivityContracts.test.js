import { expect, it } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createCollectionActivity, projectCollectionActivity, projectCollectionActivityEffect, sortCollectionsByActivity } from '../utils/generationCollectionActivityContracts.js'
import { createLifecycleSnapshot, createAccountControl, createAccountTransition, ordinaryOperationEligibility, discoverBookRecovery, createBookRecoveryIntent, reconcileBookRecovery, createAccountDeletionIntent, reconcileAccountDeletion } from '../utils/generationRecoveryContracts.js'

const uid = 'owner', hash = 'a'.repeat(64)
const account = createAccountControl({ state: 'active', legacyClosed: true })
const context = createBookMutationContext({ uid, bookId: 'book', generation: 1 })
const intent = (kind = 'resume-deletion') => createBookRecoveryIntent({ context, intentId: 'intent', kind, initializationId: kind === 'resume-creation' ? hash : null })
const observation = overrides => ({ uid, source: 'server', account, protocolState: 'ready', lifecycle: { generation: 1, state: 'deleting' }, hasBookData: true, hasLibrary: true, initializationId: null, ...overrides })
const catalog = overrides => ({ name: 'Collection', description: '', icon: 'library', pinned: false, createdAt: 10, updatedAt: 20, membershipEpoch: 1, revision: 1, creation: hash, fieldRevisions: { name: 1, description: 1, icon: 1, pinned: 1 }, ...overrides })
const activity = createCollectionActivity({ at: 30, catalogCreatedAt: 10 })

it('projects metadata and membership activity with deterministic pinned-first ordering', () => {
  const rows = [
    { collectionId: 'b', catalog: catalog(), activity },
    { collectionId: 'a', catalog: catalog(), activity },
    { collectionId: 'pinned', catalog: catalog({ pinned: true }), activity: null },
    { collectionId: 'recent', catalog: catalog({ updatedAt: 40 }), activity },
  ]
  const projections = sortCollectionsByActivity(rows)
  expect(projections.map(item => item.collectionId)).toEqual(['pinned', 'recent', 'a', 'b'])
  expect(projections[1]).toMatchObject({ metadataAt: 40, activityAt: 30, sortAt: 40 })
  expect(rows[0].catalog.updatedAt).toBe(20)
  expect(Object.isFrozen(projections[0])).toBe(true)
})
it.each(['clear', 'metadata', 'pin'])('%s keeps membership activity unchanged', kind => {
  expect(projectCollectionActivityEffect({ kind, changed: true, previous: activity, catalogCreatedAt: 10, eventAt: null })).toEqual({ activity, shouldWrite: false })
})
it('no-op does not create activity; real assignment uses an explicit monotone timestamp', () => {
  expect(projectCollectionActivityEffect({ kind: 'membership', changed: false, previous: null, catalogCreatedAt: 10, eventAt: null })).toEqual({ activity: null, shouldWrite: false })
  expect(projectCollectionActivityEffect({ kind: 'membership', changed: true, previous: activity, catalogCreatedAt: 10, eventAt: 35 })).toEqual({ activity: { at: 35, catalogCreatedAt: 10 }, shouldWrite: true })
  expect(() => projectCollectionActivityEffect({ kind: 'membership', changed: true, previous: activity, catalogCreatedAt: 10, eventAt: 29 })).toThrow()
  expect(() => projectCollectionActivityEffect({ kind: 'membership', changed: false, previous: activity, catalogCreatedAt: 10, eventAt: 35 })).toThrow()
})
it('delete removes the projection and activity without reviving the catalog', () => {
  expect(projectCollectionActivityEffect({ kind: 'delete', changed: true, previous: activity, catalogCreatedAt: 10, eventAt: null })).toEqual({ activity: null, shouldWrite: true })
  const tombstone = { deleted: true, createdAt: 10, membershipEpoch: 1, revision: 2 }
  expect(projectCollectionActivity({ collectionId: 'c', catalog: tombstone, activity })).toBeNull()
})
it('rejects invalid activity identity, timestamps, duplicate IDs and fields', () => {
  expect(() => projectCollectionActivity({ collectionId: 'c', catalog: catalog(), activity: { ...activity, catalogCreatedAt: 11 } })).toThrow()
  expect(() => createCollectionActivity({ ...activity, at: { '.sv': 'timestamp' } })).toThrow()
  expect(() => createCollectionActivity({ ...activity, extra: true })).toThrow()
  const item = { collectionId: 'c', catalog: catalog(), activity }
  expect(() => sortCollectionsByActivity([item, item])).toThrow()
})

it('discovers deleting generations and asks for explicit review of creating ones', () => {
  const result = discoverBookRecovery({ uid, source: 'server', account, protocolState: 'ready', lifecycles: { active: { generation: 4, state: 'active' }, deleted: { generation: 1, state: 'deleted' }, creating: { generation: 2, state: 'creating' }, deleting: { generation: 3, state: 'deleting' } } })
  expect(result.actions.map(item => item.kind)).toEqual(['review-creation', 'resume-deletion'])
  expect(result.actions[0].choices).toEqual(['resume-creation', 'abandon-creation'])
  expect(result.actions[1].context.generation).toBe(3)
  expect(Object.isFrozen(result.actions[1].context)).toBe(true)
})
it('gives terminal account deletion priority over migration, offline discovery and ordinary work', () => {
  const terminal = { state: 'deleting', legacyClosed: true }
  expect(ordinaryOperationEligibility({ account: terminal, protocolState: 'migrating' })).toEqual({ allowed: false, reason: 'account-terminal' })
  expect(discoverBookRecovery({ uid, source: 'unavailable', account: terminal, protocolState: 'ready', lifecycles: null })).toEqual({ status: 'account-terminal', actions: [] })
  expect(reconcileBookRecovery(intent(), observation({ account: terminal, source: 'unavailable' }))).toEqual({ status: 'account-terminal', canRetry: false })
})
it('does not use cache, timeouts or creating records as permission to activate/delete automatically', () => {
  expect(discoverBookRecovery({ uid, source: 'unavailable', account, protocolState: 'ready', lifecycles: {} })).toEqual({ status: 'uncertain', actions: [] })
  expect(discoverBookRecovery({ uid, source: 'server', account, protocolState: 'migrating', lifecycles: {} })).toMatchObject({ status: 'protocol-not-ready', actions: [] })
  expect(() => createBookRecoveryIntent({ context, intentId: 'intent', kind: 'timeout-delete', initializationId: null })).toThrow()
  expect(() => createBookRecoveryIntent({ context, intentId: 'intent', kind: 'resume-creation', initializationId: null })).toThrow()
})
it.each(['creating', 'active', 'deleting', 'deleted'])('validates lifecycle state %s without changing generation', state => {
  expect(createLifecycleSnapshot({ generation: 2147483647, state })).toEqual({ generation: 2147483647, state })
})
it.each([0, -1, 1.5, 2147483648])('refuses invalid lifecycle generation %s', generation => {
  expect(() => createLifecycleSnapshot({ generation, state: 'deleting' })).toThrow()
})
it('reconciles interrupted deletion idempotently and refuses a newer generation', () => {
  expect(reconcileBookRecovery(intent(), observation())).toEqual({ status: 'pending', canRetry: true })
  expect(reconcileBookRecovery(intent(), observation({ lifecycle: { generation: 1, state: 'deleted' }, hasBookData: false, hasLibrary: false }))).toEqual({ status: 'confirmed', canRetry: false })
  expect(reconcileBookRecovery(intent(), observation({ lifecycle: { generation: 1, state: 'deleted' } }))).toEqual({ status: 'contradictory', canRetry: false })
  expect(reconcileBookRecovery(intent(), observation({ lifecycle: { generation: 2, state: 'deleting' } }))).toEqual({ status: 'stale', canRetry: false })
  expect(reconcileBookRecovery(intent(), observation({ lifecycle: { generation: 1, state: 'active' } }))).toEqual({ status: 'stale', canRetry: false })
  expect(reconcileBookRecovery(intent(), observation({ source: 'unavailable' }))).toEqual({ status: 'uncertain', canRetry: false })
  expect(reconcileBookRecovery(intent(), observation({ hasBookData: false, hasLibrary: true }))).toEqual({ status: 'contradictory', canRetry: false })
})
it('resumes creating only with the captured initialization identity; abandonment is explicit', () => {
  const creating = observation({ lifecycle: { generation: 1, state: 'creating' }, hasBookData: false, hasLibrary: false })
  expect(reconcileBookRecovery(intent('resume-creation'), creating)).toMatchObject({ status: 'pending', canRetry: true })
  expect(reconcileBookRecovery(intent('abandon-creation'), creating)).toMatchObject({ status: 'pending', canRetry: true })
  expect(reconcileBookRecovery(intent('resume-creation'), observation({ lifecycle: { generation: 1, state: 'creating' }, initializationId: 'b'.repeat(64) }))).toMatchObject({ status: 'conflict', canRetry: false })
  expect(reconcileBookRecovery(intent('resume-creation'), observation({ lifecycle: { generation: 1, state: 'active' }, initializationId: hash }))).toMatchObject({ status: 'confirmed', canRetry: false })
})
it('defines initial, monotone legacy closure, terminal lock and null-purge completion transitions', () => {
  const base = { uid, intentId: 'intent', protocolAfter: 'absent', userDataAbsent: false }
  const open = { state: 'active', legacyClosed: false }, deleting = { state: 'deleting', legacyClosed: true }, deleted = { state: 'deleted', legacyClosed: true }
  expect(createAccountTransition({ ...base, expected: null, target: open }).target).toEqual(open)
  expect(createAccountTransition({ ...base, protocolAfter: 'migrating', expected: open, target: account }).target).toEqual(account)
  expect(createAccountTransition({ ...base, expected: account, target: deleting }).target).toEqual(deleting)
  expect(createAccountTransition({ ...base, expected: deleting, target: deleted, userDataAbsent: true }).target).toEqual(deleted)
  expect(() => createAccountTransition({ ...base, expected: account, target: open })).toThrow()
  expect(() => createAccountTransition({ ...base, expected: deleting, target: deleted })).toThrow()
  expect(() => createAccountTransition({ ...base, expected: deleted, target: open })).toThrow()
  expect(() => createAccountControl({ state: 'deleted', legacyClosed: false })).toThrow()
})
it('orders account RTDB/Auth recovery and keeps a surviving Auth account terminal', () => {
  const deletion = createAccountDeletionIntent({ uid, intentId: 'delete-intent', expected: account })
  const observed = { uid, source: 'server', control: account, userDataExists: true, authExists: true }
  expect(reconcileAccountDeletion(deletion, observed)).toEqual({ status: 'pending', next: 'lock-account' })
  const locked = { ...observed, control: { state: 'deleting', legacyClosed: true } }
  expect(reconcileAccountDeletion(deletion, locked)).toEqual({ status: 'pending', next: 'purge-user-data' })
  expect(reconcileAccountDeletion(deletion, { ...locked, userDataExists: false })).toEqual({ status: 'pending', next: 'finalize-rtdb-barrier' })
  const purged = { ...locked, control: { state: 'deleted', legacyClosed: true }, userDataExists: false }
  expect(reconcileAccountDeletion(deletion, purged)).toEqual({ status: 'pending', next: 'delete-auth' })
  expect(reconcileAccountDeletion(deletion, { ...purged, authExists: false })).toEqual({ status: 'confirmed', next: null })
  expect(reconcileAccountDeletion(deletion, { ...purged, source: 'unavailable' })).toEqual({ status: 'uncertain', next: null })
  expect(reconcileAccountDeletion(deletion, { ...purged, userDataExists: true })).toMatchObject({ status: 'contradictory', next: null })
  expect(reconcileAccountDeletion(deletion, { ...locked, authExists: false })).toMatchObject({ status: 'contradictory', next: null })
  const terminalIntent = createAccountDeletionIntent({ uid, intentId: 'terminal', expected: purged.control })
  expect(reconcileAccountDeletion(terminalIntent, locked)).toMatchObject({ status: 'contradictory', next: null })
})
it('refuses owner changes and mutated recovery intentions', () => {
  expect(() => reconcileBookRecovery(intent(), observation({ uid: 'other' }))).toThrow()
  expect(() => reconcileBookRecovery({ ...intent() }, observation())).toThrow()
  expect(() => createBookRecoveryIntent({ context, intentId: 'intent', kind: 'resume-deletion', initializationId: null, timeout: 20 })).toThrow()
})
