import { contractArray, contractRecord, captureBookContext } from './generationOperationUtils.js'
import { createBookMutationContext } from './bookMutationContext.js'
import { captureCatalogContext } from './generationCollectionCatalogModel.js'
import { createCollectionMembership } from './generationCollectionContracts.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { boundedCounter, canonicalContract, compareContractIds, contractBoolean, contractData, contractTimestamp, frozenContract, sameContract } from './generationContractData.js'

export const MEMBERSHIP_BATCH_LIMITS = Object.freeze({ rows: 32, bytes: 128 * 1024, receipts: 64, counter: 2147483647 })
export const membershipReceiptSlot = sequence => boundedCounter(sequence) % MEMBERSHIP_BATCH_LIMITS.receipts
export const nextMembershipSequence = sequence => boundedCounter(boundedCounter(sequence, 2147483647, 0) + 1)

export function createMembershipGuardState(input) {
  const value = contractRecord(input, ['exists'], ['epoch', 'present', 'revision'])
  contractBoolean(value.exists)
  if (!value.exists) { contractRecord(value, ['exists']); return Object.freeze({ exists: false }) }
  const { exists, ...fields } = contractRecord(value, ['exists', 'epoch', 'present', 'revision'])
  const membership = createCollectionMembership(fields)
  boundedCounter(membership.epoch); boundedCounter(membership.revision)
  return Object.freeze({ exists, ...membership })
}
function captureRow(uid, input) {
  const row = contractRecord(input, ['bookId', 'generation', 'collectionId', 'epoch', 'catalogCreatedAt', 'before', 'desired'])
  const context = createBookMutationContext({ uid, bookId: row.bookId, generation: row.generation })
  validateRtdbPathSegment(row.collectionId)
  boundedCounter(row.epoch)
  const before = createMembershipGuardState(row.before)
  if (before.exists && before.epoch > row.epoch) throw new TypeError('Membership guard belongs to a newer epoch.')
  return contractData({ ...row, bookId: context.bookId, before, catalogCreatedAt: contractTimestamp(row.catalogCreatedAt), desired: contractBoolean(row.desired) })
}
export function expectedMembershipState(beforeInput, epochInput, desiredInput) {
  const before = createMembershipGuardState(beforeInput), epoch = boundedCounter(epochInput), desired = contractBoolean(desiredInput)
  if (before.exists && before.epoch > epoch) throw new TypeError('Stale collection epoch.')
  const effective = before.exists && before.epoch === epoch && before.present
  if (Boolean(effective) === desired) return before
  return contractData({ exists: true, epoch, present: desired, revision: before.exists && before.epoch === epoch ? nextMembershipSequence(before.revision) : 1 })
}
const tuple = row => canonicalContract([row.bookId, row.collectionId])

/** Canonical ordering is only done at initial capture. Validation of an existing
 * envelope never rebuilds it into another intention or allocates a new sequence. */
export function createMembershipBatchSelection(input) {
  const value = contractRecord(input, ['uid', 'rows'])
  const uid = validateRtdbPathSegment(value.uid), rows = contractArray(value.rows)
  if (!rows.length || rows.length > MEMBERSHIP_BATCH_LIMITS.rows) throw new RangeError('batch bounds')
  const seen = new Set()
  const books = new Map(), collections = new Map()
  const captured = rows.map(row => {
    const result = captureRow(uid, row), id = tuple(result)
    if (seen.has(id)) throw new TypeError('Duplicate batch tuple.')
    seen.add(id)
    if (books.has(result.bookId) && books.get(result.bookId) !== result.generation) throw new TypeError('Contradictory captured book generations.')
    const catalogIdentity = canonicalContract([result.epoch, result.catalogCreatedAt])
    if (collections.has(result.collectionId) && collections.get(result.collectionId) !== catalogIdentity) throw new TypeError('Contradictory captured catalog identities.')
    books.set(result.bookId, result.generation); collections.set(result.collectionId, catalogIdentity)
    return result
  }).sort((a, b) => compareContractIds(tuple(a), tuple(b)))
  return contractData({ uid, rows: captured })
}
/** Context-based entrypoint: capture both frozen scopes rather than resolving
 * generations/epochs when the user later presses Save. */
export function captureMembershipSelection(input) {
  const value = contractRecord(input, ['uid', 'entries'])
  const uid = validateRtdbPathSegment(value.uid)
  const rows = contractArray(value.entries).map(item => {
    const entry = contractRecord(item, ['context', 'collection', 'catalogCreatedAt', 'before', 'desired'])
    const context = captureBookContext(entry.context), collection = captureCatalogContext(entry.collection)
    if (context.uid !== uid || collection.uid !== uid) throw new TypeError('Cross-owner batch selection.')
    return { bookId: context.bookId, generation: context.generation, collectionId: collection.collectionId, epoch: collection.epoch, catalogCreatedAt: entry.catalogCreatedAt, before: entry.before, desired: entry.desired }
  })
  return createMembershipBatchSelection({ uid, rows })
}
function receiptFromSelection(selection, intent, sequence) {
  const guards = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i, { enabled: false }]))
  const entries = {}, activity = {}
  selection.rows.forEach((row, index) => {
    const after = expectedMembershipState(row.before, row.epoch, row.desired)
    guards[index] = { enabled: true, ...row, after }
    entries[row.bookId] ??= {}
    entries[row.bookId][row.collectionId] = String(index)
    if (!sameContract(row.before, after)) activity[row.collectionId] = String(index)
  })
  return contractData({ uid: selection.uid, sequence, intent, guards, entries, ...(Object.keys(activity).length ? { activity } : {}) })
}
export function membershipEnvelopeBytes(input) {
  return new TextEncoder().encode(canonicalContract(input)).length
}
export function createMembershipBatch(input) {
  const value = contractRecord(input, ['selection', 'intentId', 'sequence'])
  frozenContract(value.selection)
  const selection = createMembershipBatchSelection(value.selection)
  const receipt = receiptFromSelection(selection, validateRtdbPathSegment(value.intentId), boundedCounter(value.sequence))
  if (membershipEnvelopeBytes(receipt) > MEMBERSHIP_BATCH_LIMITS.bytes) throw new RangeError('batch bytes')
  return receipt
}
/** Compatibility entrypoint for the isolated experiment; contains no SDK. */
export function captureMembershipBatch(uid, intent, sequence, rows) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MEMBERSHIP_BATCH_LIMITS.counter || !Array.isArray(rows) || !rows.length || rows.length > MEMBERSHIP_BATCH_LIMITS.rows) throw new RangeError('batch bounds')
  return createMembershipBatch({ selection: createMembershipBatchSelection({ uid, rows }), intentId: intent, sequence })
}
/** RTDB may encode numeric dictionaries as arrays with null absence slots.
 * This adapter is used ONLY at known wire-map locations, never import payloads
 * or arbitrary JSON. Envelope reconstruction still checks every actual entry. */
function wireMap(input) {
  const data = contractData(input)
  if (!data || typeof data !== 'object') throw new TypeError('Expected wire map.')
  if (!Array.isArray(data)) return data
  return Object.fromEntries(data.flatMap((value, index) => value === null ? [] : [[String(index), value]]))
}
function receiptRows(input) {
  const raw = contractRecord(input, ['uid', 'sequence', 'intent', 'guards', 'entries'], ['activity'])
  const entries = Object.fromEntries(Object.entries(wireMap(raw.entries)).map(([bookId, collectionMap]) => [bookId, wireMap(collectionMap)]))
  const value = { ...raw, entries, ...(Object.hasOwn(raw, 'activity') ? { activity: wireMap(raw.activity) } : {}) }
  const keys = Array.from({ length: 32 }, (_, i) => String(i))
  // RTDB REST can represent dense numeric maps as arrays. This is a wire-shape
  // adaptation only: every slot/content must still be present and unchanged.
  const guards = Array.isArray(value.guards) ? Object.fromEntries(contractArray(value.guards).map((item, i) => [i, item])) : value.guards
  const guarded = contractRecord(guards, keys)
  const rows = []
  for (const key of keys) {
    const guard = contractRecord(guarded[key], ['enabled'], ['bookId', 'generation', 'collectionId', 'epoch', 'catalogCreatedAt', 'before', 'desired', 'after'])
    contractBoolean(guard.enabled)
    if (!guard.enabled) { contractRecord(guard, ['enabled']); continue }
    const { enabled: _enabled, after, ...row } = contractRecord(guard, ['enabled', 'bookId', 'generation', 'collectionId', 'epoch', 'catalogCreatedAt', 'before', 'desired', 'after'])
    const captured = captureRow(value.uid, row)
    if (!sameContract(createMembershipGuardState(after), expectedMembershipState(captured.before, captured.epoch, captured.desired))) throw new TypeError('Forged membership result.')
    rows.push(captured)
  }
  return { value, guards, rows }
}
export function validateMembershipBatch(input, immutable = true) {
  if (immutable) frozenContract(input)
  const { value, guards, rows } = receiptRows(input)
  const rebuilt = captureMembershipBatch(value.uid, value.intent, value.sequence, rows)
  if (!sameContract({ ...value, guards }, rebuilt)) throw new TypeError('Non-canonical membership envelope; never repair a retry.')
  if (immutable && !sameContract(input, rebuilt)) throw new TypeError('Wire-map adaptation is only permitted for observations, not retry envelopes.')
  return rebuilt
}
export function assertSameMembershipBatchIntent(first, second) {
  const before = validateMembershipBatch(first), after = validateMembershipBatch(second)
  if (!sameContract(before, after)) throw new TypeError('Membership retry envelope changed.')
  return before
}
export function assertMembershipSelectionCurrent(selectionInput, observationInput) {
  frozenContract(selectionInput)
  const captured = createMembershipBatchSelection(selectionInput), observed = createMembershipBatchSelection(observationInput)
  if (captured.uid !== observed.uid) throw new TypeError('Selection owner mismatch.')
  const byId = new Map(observed.rows.map(row => [tuple(row), row]))
  for (const row of captured.rows) {
    const other = byId.get(tuple(row))
    if (!other || ['generation', 'epoch', 'catalogCreatedAt'].some(key => row[key] !== other[key]) || !sameContract(row.before, other.before)) throw new TypeError('Stale membership guard.')
  }
  return captured // Observational only; rules still enforce atomic freshness.
}
export function createMembershipHead(input) {
  const value = contractRecord(input, ['sequence', 'slot', 'intent'])
  if (value.slot !== membershipReceiptSlot(value.sequence)) throw new TypeError('Receipt slot mismatch.')
  return contractData({ ...value, intent: validateRtdbPathSegment(value.intent) })
}
export function reconcileMembershipReceipt(batchInput, observation) {
  const batch = validateMembershipBatch(batchInput)
  const value = contractRecord(observation, ['uid', 'source', 'head', 'receipt'])
  if (value.uid !== batch.uid) throw new TypeError('Receipt observation owner mismatch.')
  if (!['server', 'unavailable'].includes(value.source)) throw new TypeError('Invalid observation source.')
  if (value.source === 'unavailable') return contractData({ status: 'uncertain', canRetry: false })
  const head = value.head === null ? null : createMembershipHead(value.head)
  const stored = value.receipt === null ? null : validateMembershipBatch(value.receipt, false)
  if (stored && (stored.uid !== batch.uid || membershipReceiptSlot(stored.sequence) !== membershipReceiptSlot(batch.sequence) || !head || stored.sequence > head.sequence)) throw new TypeError('Contradictory receipt observation.')
  if (stored && stored.sequence === head.sequence && (stored.intent !== head.intent || membershipReceiptSlot(stored.sequence) !== head.slot)) throw new TypeError('Receipt/head identity conflict.')
  if (stored?.sequence === batch.sequence) return contractData({ status: sameContract(stored, batch) ? 'confirmed' : 'conflict', canRetry: false })
  const sequence = head?.sequence ?? 0
  if (sequence >= batch.sequence) return contractData({ status: 'indeterminate', canRetry: false })
  if (batch.sequence !== sequence + 1) return contractData({ status: 'conflict', canRetry: false })
  return contractData({ status: 'not-committed', canRetry: true })
}
export function projectMembershipReceiptCommit(batchInput, journalInput) {
  const batch = validateMembershipBatch(batchInput)
  const journal = contractRecord(journalInput, ['uid', 'head', 'receipts'])
  if (journal.uid !== batch.uid) throw new TypeError('Cross-owner journal.')
  const head = journal.head === null ? null : createMembershipHead(journal.head)
  const receipts = receiptJournal(journal.receipts, head, batch.uid)
  if (batch.sequence !== nextMembershipSequence(head?.sequence ?? 0)) throw new TypeError('Occupied or stale sequence; replay forbidden.')
  const slot = membershipReceiptSlot(batch.sequence), evicted = receipts[slot] ?? null
  return contractData({ uid: batch.uid, head: { sequence: batch.sequence, slot, intent: batch.intent }, receipts: { ...receipts, [slot]: batch }, evicted })
}
function receiptJournal(input, head, uid) {
  const data = wireMap(input)
  const receipts = {}
  for (const [slot, raw] of Object.entries(data)) {
    if (!/^(0|[1-9]|[1-5][0-9]|6[0-3])$/.test(slot)) throw new TypeError('Receipt journal outside bounds.')
    const receipt = validateMembershipBatch(raw, false)
    if (receipt.uid !== uid || membershipReceiptSlot(receipt.sequence) !== Number(slot) || !head || receipt.sequence > head.sequence) throw new TypeError('Contradictory receipt journal.')
    if (receipt.sequence === head.sequence && receipt.intent !== head.intent) throw new TypeError('Receipt journal head identity conflict.')
    receipts[slot] = receipt
  }
  return receipts
}
export function projectBookReceiptPurge(input) {
  const value = contractRecord(input, ['context', 'lifecycle', 'journal'])
  const context = captureBookContext(value.context)
  const life = contractRecord(value.lifecycle, ['generation', 'state'])
  if (life.generation !== context.generation || life.state !== 'deleting') throw new TypeError('Receipt purge requires the captured deleting generation.')
  const journal = contractRecord(value.journal, ['uid', 'head', 'receipts'])
  if (journal.uid !== context.uid) throw new TypeError('Cross-owner receipt purge.')
  const head = journal.head === null ? null : createMembershipHead(journal.head)
  const receipts = receiptJournal(journal.receipts, head, context.uid)
  return contractData({ uid: context.uid, head, receipts: {}, lostEvidenceSequences: Object.values(receipts).map(item => item.sequence).sort((a, b) => a - b) })
}
