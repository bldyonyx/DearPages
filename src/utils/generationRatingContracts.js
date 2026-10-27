/* eslint-disable no-control-regex -- Preserve existing rating impression validation. */
import { isCivilDate } from './civilDateUtils.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import {
  acknowledgedCreatedAt, assertSameBookContext, captureBookContext, contractRecord,
  nextCounter, operationEnvelope, positiveCounter,
} from './generationOperationUtils.js'

export const GENERATION_LEGACY_RATING_ID = 'legacy-rating-v1'
export const RATING_INITIAL_REVISION = 1
const ratingValue = value => Number.isInteger(value) && value >= 1 && value <= 5

function ratingFields(input, unknownDate = false) {
  const value = contractRecord(input, ['value', 'date'], ['impression'])
  if (!ratingValue(value.value) || !(isCivilDate(value.date) || (unknownDate && value.date === ''))) {
    throw new TypeError('Invalid rating value or civil date.')
  }
  const result = { value: value.value, date: value.date }
  if (Object.hasOwn(value, 'impression')) {
    if (typeof value.impression !== 'string' || value.impression.length > 160 || /[\u0000-\u001f\u007f]/u.test(value.impression)) {
      throw new TypeError('Invalid rating impression.')
    }
    result.impression = value.impression.trim() ? value.impression : null
  }
  return Object.freeze(result)
}

/** Acknowledged server values only; timestamp placeholders are not CAS tokens. */
export function createRatingConcurrencyToken(input) {
  const value = contractRecord(input, ['context', 'entryId', 'revision', 'createdAt', 'date'])
  const id = validateRtdbPathSegment(value.entryId)
  if (!(isCivilDate(value.date) || (id === GENERATION_LEGACY_RATING_ID && value.date === ''))) throw new TypeError('Invalid token date.')
  return Object.freeze({ context: captureBookContext(value.context), entryId: id,
    revision: positiveCounter(value.revision), createdAt: acknowledgedCreatedAt(value.createdAt), date: value.date })
}

function expectedRating(context, id, input) {
  const token = createRatingConcurrencyToken(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected immutable rating token.')
  assertSameBookContext(context, token.context)
  if (id !== token.entryId) throw new TypeError('Rating identity mismatch.')
  return token
}

export function createRatingCreateOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'payload'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  if (!/^-[A-Za-z0-9_-]{19}$/.test(id)) throw new TypeError('New ratings require a stable push ID.')
  return operationEnvelope('rating.create', context, id, ratingFields(value.payload), null,
    { initialRevision: RATING_INITIAL_REVISION })
}

export function createRatingUpdateOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'payload', 'expected'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  const expected = expectedRating(context, id, value.expected)
  return operationEnvelope('rating.update', context, id,
    ratingFields(value.payload, id === GENERATION_LEGACY_RATING_ID && expected.date === ''), expected,
    { nextRevision: nextCounter(expected.revision) })
}

export function createRatingDeleteOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'expected'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  const expected = expectedRating(context, id, value.expected)
  return operationEnvelope('rating.delete', context, id, { deleted: true }, expected,
    { nextRevision: nextCounter(expected.revision) })
}

export function createRatingSourceToken(input) {
  const value = contractRecord(input, ['context', 'sourceValue'])
  if (!ratingValue(value.sourceValue)) throw new TypeError('Invalid historical rating value.')
  return Object.freeze({ context: captureBookContext(value.context), sourceValue: value.sourceValue })
}

export function createRatingConversionOperation(input) {
  const value = contractRecord(input, ['context', 'expected'])
  const context = captureBookContext(value.context), expected = createRatingSourceToken(value.expected)
  if (!Object.isFrozen(value.expected)) throw new TypeError('Expected immutable historical token.')
  assertSameBookContext(context, expected.context)
  return operationEnvelope('rating.convert', context, GENERATION_LEGACY_RATING_ID,
    { value: expected.sourceValue, date: '' }, expected, { initialRevision: RATING_INITIAL_REVISION })
}

/** Compare normalized captured creation intents. No new ID, clock, revision or
 * generation is allocated. This tests intent identity, not server execution.
 */
export function assertSameRatingCreationIntent(first, second) {
  const keys = ['context', 'type', 'entryId', 'payload', 'expected', 'initialRevision']
  const a = contractRecord(first, keys), b = contractRecord(second, keys)
  if (a.type !== 'rating.create' || b.type !== 'rating.create' || a.expected !== null || b.expected !== null ||
      a.initialRevision !== 1 || b.initialRevision !== 1 || !Object.isFrozen(first) || !Object.isFrozen(second) ||
      !Object.isFrozen(a.payload) || !Object.isFrozen(b.payload)) {
    throw new TypeError('Expected immutable rating creation operations.')
  }
  for (const id of [a.entryId, b.entryId]) {
    validateRtdbPathSegment(id)
    if (!/^-[A-Za-z0-9_-]{19}$/.test(id)) throw new TypeError('Invalid stable rating creation ID.')
  }
  assertSameBookContext(a.context, b.context)
  // Payload is already normalized: null impression means empty/cleared, whereas
  // a raw caller-provided null impression remains invalid in the builder.
  const normalized = payload => {
    const value = contractRecord(payload, ['value', 'date'], ['impression'])
    const result = ratingFields({ ...value, ...(Object.hasOwn(value, 'impression') && value.impression === null ? { impression: '' } : {}) })
    return [result.value, result.date, result.impression ?? '']
  }
  if (a.entryId !== b.entryId || JSON.stringify(normalized(a.payload)) !== JSON.stringify(normalized(b.payload))) {
    throw new TypeError('Rating creation intent changed.')
  }
}
