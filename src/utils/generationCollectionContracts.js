import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import {
  assertSameBookContext, captureBookContext, contractArray, contractRecord, nextCounter,
  operationEnvelope, positiveCounter,
} from './generationOperationUtils.js'

/** Proposal only: collection epoch is separate from a book generation.
 * No catalog lookup, clear, cleanup or server authorization occurs here.
 */
export function createCollectionContext(input) {
  const value = contractRecord(input, ['uid', 'collectionId', 'epoch'])
  return Object.freeze({ uid: validateRtdbPathSegment(value.uid),
    collectionId: validateRtdbPathSegment(value.collectionId), epoch: positiveCounter(value.epoch) })
}

function captureCollection(input) {
  const value = createCollectionContext(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected immutable collection context.')
  return value
}

function sameCollection(first, second) {
  if (first.uid !== second.uid || first.collectionId !== second.collectionId || first.epoch !== second.epoch) {
    throw new TypeError('Collection scope mismatch; selection may be stale.')
  }
}

/** Deterministic successor of this captured epoch, not of a current server value.
 * Calling it twice on the same predecessor always produces the same epoch.
 */
export function nextCollectionContext(input) {
  const context = captureCollection(input)
  return createCollectionContext({ ...context, epoch: nextCounter(context.epoch) })
}

export function createCollectionMembership(input) {
  const value = contractRecord(input, ['epoch', 'present', 'revision'])
  if (typeof value.present !== 'boolean') throw new TypeError('Membership presence must be explicit.')
  return Object.freeze({ epoch: positiveCounter(value.epoch), present: value.present, revision: positiveCounter(value.revision) })
}

export function createMembershipConcurrencyToken(input) {
  const value = contractRecord(input, ['context', 'collection', 'membership'])
  const context = captureBookContext(value.context), collection = captureCollection(value.collection)
  const membership = createCollectionMembership(value.membership)
  if (context.uid !== collection.uid || membership.epoch !== collection.epoch) throw new TypeError('Membership scope mismatch.')
  return Object.freeze({ context, collection, membership })
}

function expectedMembership(context, collection, input) {
  const token = createMembershipConcurrencyToken(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected immutable membership token.')
  assertSameBookContext(context, token.context)
  sameCollection(collection, token.collection)
  return token
}

/** Capture an add/remove assignment and expected record. A removal requires an
 * existing token; an absent-row no-op needs a future authoritative service read.
 * No-op records keep their revision. Actual changes increment it, never reset it
 * within an epoch. New-epoch handling/permissions remain to test in Emulator.
 */
export function createMembershipOperation(input) {
  const value = contractRecord(input, ['context', 'collection', 'intent', 'expected'])
  const context = captureBookContext(value.context), collection = captureCollection(value.collection)
  if (context.uid !== collection.uid || !['add', 'remove'].includes(value.intent)) throw new TypeError('Invalid membership intention.')
  const expected = value.expected === null ? null : expectedMembership(context, collection, value.expected)
  const present = value.intent === 'add'
  if (!expected && !present) throw new TypeError('Removal requires a captured membership token.')
  const changes = !expected || expected.membership.present !== present
  const membership = createCollectionMembership({ epoch: collection.epoch, present,
    revision: expected ? changes ? nextCounter(expected.membership.revision) : expected.membership.revision : 1 })
  return operationEnvelope(`collection.membership.${value.intent}`, context, collection.collectionId, membership, expected,
    { collection, intent: value.intent, changes })
}

/** Selection snapshot, not a Set/Map whose contents remain mutable after freeze.
 * One captured book context and optional membership token per row. UI desired
 * values are expressed later through explicit add/remove operations.
 */
export function createCollectionSelection(input) {
  const value = contractRecord(input, ['collection', 'entries'])
  const collection = captureCollection(value.collection), seen = new Set()
  const entries = contractArray(value.entries).map(inputEntry => {
    const entry = contractRecord(inputEntry, ['context', 'expected'])
    const context = captureBookContext(entry.context)
    if (context.uid !== collection.uid || seen.has(context.bookId)) throw new TypeError('Duplicate or cross-owner selection row.')
    seen.add(context.bookId)
    const expected = entry.expected === null ? null : expectedMembership(context, collection, entry.expected)
    return Object.freeze({ context, expected })
  })
  return Object.freeze({ collection, entries: Object.freeze(entries) })
}

/** Compare two supplied snapshots. Does not fetch state or prove freshness.
 * Extra observed books are allowed; each captured row must still match its book
 * generation, collection epoch and membership CAS state. Never updates selection.
 */
export function assertCollectionSelectionCurrent(captured, observed) {
  const first = createCollectionSelection(captured), second = createCollectionSelection(observed)
  if (!Object.isFrozen(captured) || !Object.isFrozen(observed)) throw new TypeError('Expected immutable selections.')
  sameCollection(first.collection, second.collection)
  const byId = new Map(second.entries.map(entry => [entry.context.bookId, entry]))
  for (const entry of first.entries) {
    const current = byId.get(entry.context.bookId)
    if (!current) throw new TypeError('Captured book missing from observed selection.')
    assertSameBookContext(entry.context, current.context)
    const a = entry.expected?.membership ?? null, b = current.expected?.membership ?? null
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new TypeError('Membership selection is stale.')
  }
  return captured
}
