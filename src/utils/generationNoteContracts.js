/* eslint-disable no-control-regex -- Preserve existing note control-character validation. */
import { isCivilDate } from './civilDateUtils.js'
import { sanitizeNoteHtml } from './noteHtmlSanitizer.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import {
  acknowledgedCreatedAt, assertSameBookContext, captureBookContext, contractRecord, operationEnvelope,
} from './generationOperationUtils.js'

export const GENERATION_NOTE_LIMITS = Object.freeze({ title: 200, contentHtml: 200000 })
export const GENERATION_LEGACY_NOTE_IDS = Object.freeze({ note: 'legacy-note-v1', review: 'legacy-review-v1' })
const contentFields = Object.freeze(['title', 'contentHtml', 'date'])

function noteFields(input, mode, sanitize = true) {
  const required = mode === 'patch' ? [] : mode === 'create' ? ['contentHtml', 'date'] : contentFields
  const value = contractRecord(input, required, mode === 'patch' ? contentFields : mode === 'create' ? ['title'] : [])
  if (!Object.keys(value).length) throw new TypeError('Empty note patch.')
  const result = {}
  if (Object.hasOwn(value, 'title')) {
    if (typeof value.title !== 'string' || value.title.length > 200 || /[\u0000-\u001f\u007f<>]/u.test(value.title)) throw new TypeError('Invalid note title.')
    result.title = value.title
  } else if (mode === 'create') result.title = ''
  if (Object.hasOwn(value, 'contentHtml')) {
    if (typeof value.contentHtml !== 'string' || value.contentHtml.length > 200000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.contentHtml)) throw new TypeError('Invalid note content.')
    result.contentHtml = sanitize ? sanitizeNoteHtml(value.contentHtml) : value.contentHtml
    if (result.contentHtml.length > 200000) throw new TypeError('Sanitized note exceeds limit.')
  }
  if (Object.hasOwn(value, 'date')) {
    if (!isCivilDate(value.date)) throw new TypeError('Invalid note civil date.')
    result.date = value.date
  }
  return Object.freeze(result)
}

/** A snapshot token, not a global revision. Fields stay byte-exact for CAS;
 * display sanitization must not rewrite the acknowledged comparison snapshot.
 */
export function createNoteConcurrencyToken(input) {
  const value = contractRecord(input, ['context', 'entryId', 'createdAt', 'fields'])
  return Object.freeze({ context: captureBookContext(value.context), entryId: validateRtdbPathSegment(value.entryId),
    createdAt: acknowledgedCreatedAt(value.createdAt), fields: noteFields(value.fields, 'save', false) })
}

function expectedNote(context, entryId, input) {
  const token = createNoteConcurrencyToken(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected an immutable note token.')
  assertSameBookContext(context, token.context)
  if (entryId !== token.entryId) throw new TypeError('Note identity mismatch.')
  return token
}

/** ID is allocated by the future caller before the first send, never here. */
export function createNoteCreateOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'payload'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  if (Object.values(GENERATION_LEGACY_NOTE_IDS).includes(id)) throw new TypeError('Reserved conversion ID.')
  return operationEnvelope('note.create', context, id, noteFields(value.payload, 'create'), null)
}

function editOperation(input, mode) {
  const value = contractRecord(input, ['context', 'entryId', 'payload', 'expected'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  const expected = expectedNote(context, id, value.expected)
  const payload = noteFields(value.payload, mode)
  return operationEnvelope(mode === 'patch' ? 'note.patch' : 'note.save', context, id, payload, expected,
    { comparisonFields: Object.freeze(mode === 'patch' ? Object.keys(payload) : [...contentFields]) })
}

/** Compare only touched fields: unrelated field patches remain mergeable. */
export const createNotePatchOperation = input => editOperation(input, 'patch')
/** Compare all content fields; pin state/timestamps are not content CAS fields. */
export const createNoteSaveOperation = input => editOperation(input, 'save')

/** Explicit assignment; identity-only, last-writer pin semantics remain a server
 * decision to test. Never introduces a toggle or a mandatory content revision.
 */
export function createNotePinOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'isPinned', 'expected'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  if (typeof value.isPinned !== 'boolean') throw new TypeError('Expected explicit pin boolean.')
  return operationEnvelope('note.pin', context, id, { isPinned: value.isPinned }, expectedNote(context, id, value.expected),
    { comparisonFields: Object.freeze([]) })
}

/** Terminal intent only. The note tombstone's eventual persisted schema and
 * timestamp checks must be demonstrated in Emulator, not inferred from this DTO.
 */
export function createNoteDeleteOperation(input) {
  const value = contractRecord(input, ['context', 'entryId', 'expected'])
  const context = captureBookContext(value.context), id = validateRtdbPathSegment(value.entryId)
  return operationEnvelope('note.delete', context, id, { deleted: true }, expectedNote(context, id, value.expected),
    { comparisonFields: Object.freeze([...contentFields]) })
}

export function createNoteSourceToken(input) {
  const value = contractRecord(input, ['context', 'kind', 'sourceVersion'])
  if (!['note', 'review'].includes(value.kind) || typeof value.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceVersion)) {
    throw new TypeError('Invalid note/review source token.')
  }
  return Object.freeze({ context: captureBookContext(value.context), kind: value.kind, sourceVersion: value.sourceVersion })
}

/** Independent reserved IDs and expected source fingerprints. The caller must
 * capture the conversion's civil date explicitly; no clock/source is consulted.
 */
export function createNoteConversionOperation(input) {
  const value = contractRecord(input, ['context', 'expected', 'date'], ['title'])
  const context = captureBookContext(value.context), expected = createNoteSourceToken(value.expected)
  if (!Object.isFrozen(value.expected)) throw new TypeError('Expected immutable source token.')
  assertSameBookContext(context, expected.context)
  const title = Object.hasOwn(value, 'title') ? value.title : expected.kind === 'review' ? 'Mon avis sur le livre' : ''
  const checked = noteFields({ title, date: value.date }, 'patch')
  return operationEnvelope('note.convert', context, GENERATION_LEGACY_NOTE_IDS[expected.kind],
    { kind: expected.kind, title: checked.title, date: checked.date }, expected)
}
