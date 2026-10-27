import { getBookRouteId } from './bookPageUtils.js'
import { sanitizeNoteHtml } from './noteHtmlSanitizer.js'

export const GENERATION_BOOK_STATUSES = Object.freeze({
  TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned',
})
const statuses = Object.values(GENERATION_BOOK_STATUSES)
const strings = ['googleBooksId', 'isbn', 'cover', 'publishedDate', 'description', 'source', 'openLibraryId']
const lists = ['authors', 'isbns', 'categories']
const dates = ['startedAt', 'finishedAt', 'abandonedAt']
const mutable = [...dates, 'note', 'review', 'rating']
const fields = ['id', 'title', 'status', 'addedAt', 'updatedAt', ...strings, ...lists, ...mutable]
const fail = () => { throw new TypeError('Invalid or unsupported generation library data.') }
const date = value => Number.isSafeInteger(value) && Math.abs(value) <= 8640000000000000

function plain(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) fail()
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail()
  }
}

/** Pure counterpart of the legacy projection, without importing its Firebase
 * singleton. Parity tests pin its output/status-date behavior to libraryService.
 * Unknown fields in a stored snapshot are rejected, never silently discarded.
 */
export function createGenerationLibraryBook(book, status = 'to-read') {
  if (!statuses.includes(status)) fail()
  const value = {
    id: getBookRouteId(book), googleBooksId: book.googleBooksId || null,
    title: book.title, authors: book.authors, isbn: book.isbn || null,
    isbns: book.isbns || [], cover: book.cover || null, categories: book.categories || [],
    publishedDate: book.publishedDate || '', description: book.description || '',
    source: book.source || null, openLibraryId: book.openLibraryId || null,
    status, addedAt: Date.now(),
  }
  if (status === 'finished') value.finishedAt = Date.now()
  if (status === 'abandoned') value.abandonedAt = Date.now()
  return value
}

function validateField(key, value) {
  if (value === null) return
  if (strings.includes(key) && typeof value !== 'string') fail()
  if (lists.includes(key) && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) fail()
  if (dates.includes(key) && !date(value)) fail()
  if (['addedAt', 'updatedAt'].includes(key) && (!date(value) || value < 0)) fail()
  if (['note', 'review'].includes(key) && (typeof value !== 'string' || value.length > 200000)) fail()
  if (key === 'rating' && (!Number.isInteger(value) || value < 1 || value > 5)) fail()
}

/** Validate and defensively copy an entire supported record. Null/empty arrays
 * normalize to absence, matching RTDB storage; no unknown metadata is dropped.
 * This is structural validation, not an HTML sanitizer (writes sanitize below).
 */
export function validateGenerationLibraryRecord(context, input) {
  plain(input)
  if (Object.keys(input).some(key => !fields.includes(key)) || input.id !== context.bookId ||
      typeof input.title !== 'string' || input.title.length > 200 || !statuses.includes(input.status) ||
      !date(input.addedAt) || input.addedAt < 0) fail()
  const result = {}
  for (const key of fields) {
    if (!Object.hasOwn(input, key)) continue
    validateField(key, input[key])
    if (input[key] === null || (Array.isArray(input[key]) && input[key].length === 0)) continue
    result[key] = Array.isArray(input[key]) ? [...input[key]] : input[key]
  }
  return result
}

/** Only existing scalar mutations plus explicit optional startedAt. Status goes
 * through makeGenerationStatusPatch so its historical date behavior is retained.
 */
export function validateGenerationLibraryPatch(input, sanitize = true) {
  plain(input)
  const keys = Object.keys(input)
  if (!keys.length || keys.some(key => !mutable.includes(key))) fail()
  const patch = {}
  for (const key of keys) {
    const value = input[key]
    validateField(key, value)
    if (key === 'rating' && value === null) fail() // Legacy API accepts only 1..5.
    if (['note', 'review'].includes(key) && value === null) fail()
    patch[key] = sanitize && ['note', 'review'].includes(key) ? sanitizeNoteHtml(value) : value
  }
  return patch
}

/** Optional field CAS tokens. Null explicitly means an absent field in RTDB;
 * expectations are compared exactly, never sanitized or silently normalized.
 */
export function validateGenerationLibraryExpected(input) {
  plain(input)
  const keys = Object.keys(input)
  if (!keys.length || keys.some(key => ![...mutable, 'status'].includes(key))) fail()
  for (const key of keys) {
    if (key === 'status') { if (!statuses.includes(input[key])) fail() }
    else validateField(key, input[key])
  }
  return Object.freeze({ ...input })
}

/** Preserve legacy status semantics: no-op keeps dates; leaving a final status
 * clears its date, entering it records the captured operation time. No automatic
 * startedAt assignment exists in the legacy API, so none is introduced here.
 */
export function makeGenerationStatusPatch(stored, status, now) {
  if (!statuses.includes(status)) fail()
  if (stored.status === status) return null
  const patch = { status, updatedAt: now }
  if (status === 'finished') patch.finishedAt = now
  else if (stored.status === 'finished') patch.finishedAt = null
  if (status === 'abandoned') patch.abandonedAt = now
  else if (stored.status === 'abandoned') patch.abandonedAt = null
  return patch
}
