/* eslint-disable no-control-regex -- Identifiers intentionally reject control characters. */
import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database'
import { database, isFirebaseEmulator } from './firebase.js'
import { isCivilDate } from '../utils/civilDateUtils.js'
import { compareBookRatings } from '../utils/bookRatingsOrder.js'

export const isBookRatingsUiEnabled = isFirebaseEmulator === true
export const LEGACY_BOOK_RATING_ID = 'legacy-rating-v1'
export { compareBookRatings }
const error = (code) => Object.assign(new Error(`book-ratings/${code}`), { code: `book-ratings/${code}` })
function guard() { if (!isBookRatingsUiEnabled) throw error('emulator-only') }
function identifier(value) {
  if (typeof value !== 'string' || !value || value.length > 128 || value.trim() !== value || /[.#$[\]/\u0000-\u0020\u007f\ud800-\udfff]/u.test(value)) throw error('invalid-argument')
  return value
}
function location(uid, bookId, id) {
  guard()
  identifier(uid); identifier(bookId)
  if (id !== undefined) identifier(id)
  return {
    book: ref(database, `users/${uid}/library/${bookId}`),
    ratings: ref(database, `users/${uid}/bookRatings/${bookId}${id === undefined ? '' : `/${id}`}`),
    marker: ref(database, `users/${uid}/bookRatingsLegacy/${bookId}`),
  }
}
export const isRatingValue = (value) => Number.isInteger(value) && value >= 1 && value <= 5
function fields(input, unknown = false) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype || !Object.hasOwn(input, 'value') || !Object.hasOwn(input, 'date') ||
      !isRatingValue(input.value) || !(isCivilDate(input.date) || (unknown && input.date === '')) ||
      Object.keys(input).some(key => !['value', 'date', 'impression'].includes(key)) ||
      (Object.hasOwn(input, 'impression') && (typeof input.impression !== 'string' || input.impression.length > 160 || /[\u0000-\u001f\u007f]/u.test(input.impression)))) throw error('invalid-argument')
  return { value: input.value, date: input.date, ...(Object.hasOwn(input, 'impression') ? { impression: input.impression.trim() ? input.impression : null } : {}) }
}
async function requireBook(book, writing = false) {
  const snapshot = await get(book)
  if (!snapshot.exists()) throw error('book-not-found')
  if (writing && snapshot.val().status !== 'finished') throw error('status-conflict')
  return snapshot.val()
}
const record = (id, value) => ({ ...value, id })
export async function getBookRatingsForDisplay(uid, bookId) {
  const loc = location(uid, bookId)
  const book = await requireBook(loc.book)
  const snapshot = await get(loc.ratings)
  const ratings = Object.entries(snapshot.val() || {}).filter(([, value]) => value.deleted !== true).map(([id, value]) => record(id, value)).sort(compareBookRatings)
  const marker = await get(loc.marker) // Read last: a deleted processed copy must never reappear as fallback.
  const legacy = marker.exists() ? { status: 'processed' } : snapshot.hasChild(LEGACY_BOOK_RATING_ID)
    ? { status: 'conflict' } : isRatingValue(book.rating) ? { status: 'unprocessed', value: book.rating }
      : book.rating == null ? { status: 'empty' } : { status: 'invalid' }
  return { ratings, legacy }
}

export function newBookRatingId(uid, bookId) {
  return push(location(uid, bookId).ratings).key // Allocates only, never writes.
}
export async function createBookRating(uid, bookId, id, input) {
  const loc = location(uid, bookId, id)
  if (!/^-[A-Za-z0-9_-]{19}$/.test(id)) throw error('invalid-argument')
  const values = fields(input)
  await requireBook(loc.book, true)
  const result = await runTransaction(loc.ratings, current => {
    if (current !== null) return undefined
    return { ...values, revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  }, { applyLocally: false })
  if (!result.committed) {
    // Retry an uncertain creation at its original ID only if the payload is unchanged.
    const stored = result.snapshot.val()
    if (stored?.revision !== 1 || stored.value !== values.value || stored.date !== values.date || (stored.impression ?? '') !== (values.impression ?? '')) throw error('conflict')
  }
  // Transaction completion snapshots may still contain locally estimated server
  // timestamps. Fetch the acknowledged value before exposing createdAt as a CAS token.
  // On read failure the UI keeps this same ID: a retry cannot duplicate/resurrect it.
  const acknowledged = await get(loc.ratings)
  if (!acknowledged.exists() || acknowledged.val().deleted === true) throw error('not-found')
  return record(id, acknowledged.val())
}
function version(expected) {
  if (!expected || !Number.isSafeInteger(expected.revision) || expected.revision < 1 ||
      !Number.isSafeInteger(expected.createdAt) || expected.createdAt < 0) throw error('invalid-argument')
}
async function mutate(uid, bookId, id, expected, input, deleting) {
  const loc = location(uid, bookId, id)
  identifier(id)
  version(expected)
  const values = deleting ? null : fields(input, id === LEGACY_BOOK_RATING_ID && expected.date === '')
  await requireBook(loc.book, !deleting)
  // Warm cache for clear not-found errors; transaction still checks existence at commit.
  if (!(await get(loc.ratings)).exists()) throw error('not-found')
  let conflict = false
  const result = await runTransaction(loc.ratings, current => {
    conflict = false
    if (current === null) return null // Compare with server; never create a missing entry.
    if (current.revision !== expected.revision || current.createdAt !== expected.createdAt) {
      conflict = true; return undefined
    }
    if (current.deleted === true) { conflict = true; return undefined }
    return deleting ? { deleted: true, createdAt: current.createdAt, revision: current.revision + 1, updatedAt: serverTimestamp() }
      : { ...current, ...values, revision: current.revision + 1, updatedAt: serverTimestamp() }
  }, { applyLocally: false })
  if (conflict || !result.committed) throw error('conflict')
  if (!deleting && !result.snapshot.exists()) throw error('not-found')
  return deleting ? null : record(id, result.snapshot.val())
}
export const updateBookRatingEntry = async (uid, bookId, expected, input) => mutate(uid, bookId, expected?.id, expected, input, false)
export const deleteBookRatingEntry = async (uid, bookId, expected) => mutate(uid, bookId, expected?.id, expected, null, true)

const conversions = new Map()
export async function migrateLegacyBookRating(uid, bookId, expectedValue) {
  const loc = location(uid, bookId, LEGACY_BOOK_RATING_ID)
  if (!isRatingValue(expectedValue)) throw error('invalid-argument')
  const key = `${uid}/${bookId}`
  if (conversions.has(key)) return conversions.get(key)
  const pending = convert(uid, bookId, loc, expectedValue)
  conversions.set(key, pending)
  try { return await pending } finally { conversions.delete(key) }
}
async function convert(uid, bookId, loc, expectedValue) {
  const book = await requireBook(loc.book, true)
  const previous = await get(loc.marker)
  if (previous.exists()) return previous.val()
  if (book.rating !== expectedValue) throw error('source-changed')
  if ((await get(loc.ratings)).exists()) throw error('conflict')
  try {
    await update(ref(database, `users/${uid}`), {
      [`bookRatingsLegacy/${bookId}`]: { version: 1, sourceValue: expectedValue, processedAt: serverTimestamp() },
      [`bookRatings/${bookId}/${LEGACY_BOOK_RATING_ID}`]: { value: expectedValue, date: '', revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    })
  } catch (cause) {
    if (/permission[ _-]denied/i.test(cause.code || cause.message || '')) {
      const winner = await get(loc.marker)
      if (winner.exists()) return winner.val()
      throw error('conflict')
    }
    throw cause
  }
  return (await get(loc.marker)).val()
}
