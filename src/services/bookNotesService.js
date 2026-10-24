/* eslint-disable no-control-regex -- Validation intentionally rejects control characters. */
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import { database, isFirebaseEmulator } from './firebase.js'
import { sanitizeNoteHtml } from '../utils/noteHtmlSanitizer.js'
import { isCivilDate as isBookNoteDate } from '../utils/civilDateUtils.js'

export { isBookNoteDate }

export const BOOK_NOTE_LIMITS = Object.freeze({ title: 200, contentHtml: 200000 })
export const LEGACY_BOOK_NOTE_ID = 'legacy-note-v1'
export const isBookNotesUiEnabled = isFirebaseEmulator === true

function failure(code, message) {
  return Object.assign(new Error(message), { code: `book-notes/${code}` })
}

// 128 UTF-16 code units remain below RTDB's 768-byte UTF-8 key limit.
function identifier(value) {
  if (typeof value !== 'string' || !value || value.length > 128 ||
      value.trim() !== value || /[.#$[\]/\u0000-\u0020\u007f]/u.test(value) ||
      /[\ud800-\udfff]/u.test(value)) {
    throw failure('invalid-argument', 'Invalid user, book or note identifier.')
  }
  return value
}

function fields(input, partial = false) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype ||
      Object.keys(input).some((key) => !['title', 'contentHtml', 'date'].includes(key)) ||
      (partial && Object.keys(input).length === 0) ||
      (!partial && (!Object.hasOwn(input, 'contentHtml') || !Object.hasOwn(input, 'date')))) {
    throw failure('invalid-argument', 'Expected title, contentHtml and a civil date; technical fields are read-only.')
  }
  const result = {}
  if (Object.hasOwn(input, 'title')) {
    if (typeof input.title !== 'string' || input.title.length > BOOK_NOTE_LIMITS.title || /[\u0000-\u001f\u007f<>]/u.test(input.title)) {
      throw failure('invalid-argument', 'Title must be plain text of at most 200 characters.')
    }
    result.title = input.title
  } else if (!partial) result.title = ''
  if (Object.hasOwn(input, 'contentHtml')) {
    if (typeof input.contentHtml !== 'string' || input.contentHtml.length > BOOK_NOTE_LIMITS.contentHtml || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.contentHtml)) {
      throw failure('invalid-argument', 'HTML must be a string of at most 200000 characters without control characters.')
    }
    result.contentHtml = sanitizeNoteHtml(input.contentHtml)
    if (result.contentHtml.length > BOOK_NOTE_LIMITS.contentHtml) {
      throw failure('invalid-argument', 'Sanitized HTML exceeds the storage limit.')
    }
  }
  if (Object.hasOwn(input, 'date')) {
    if (!isBookNoteDate(input.date)) throw failure('invalid-argument', 'Expected a real civil date YYYY-MM-DD (0001–9999).')
    result.date = input.date
  }
  return result
}

function paths(uid, bookId, noteId) {
  const user = identifier(uid)
  const book = identifier(bookId)
  return {
    book: ref(database, `users/${user}/library/${book}`),
    notes: ref(database, `users/${user}/bookNotes/${book}${noteId === undefined ? '' : `/${identifier(noteId)}`}`),
  }
}

async function requireBook(book) {
  if (!(await get(book)).exists()) throw failure('book-not-found', 'Book no longer exists in the library.')
}

/** Reads sanitize HTML again: stored data must never be trusted at rendering time. */
function record(id, value) {
  return { ...value, id, contentHtml: sanitizeNoteHtml(value.contentHtml) }
}

export function compareBookNotes(a, b) {
  return b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id)
}

async function readNotes(notesRef) {
  const snapshot = await get(notesRef)
  return Object.entries(snapshot.val() || {}).map(([id, value]) => record(id, value))
    .sort(compareBookNotes)
}

export async function getBookNotes(uid, bookId) {
  const location = paths(uid, bookId)
  await requireBook(location.book)
  return readNotes(location.notes)
}

/** Read-only display contract. Never returns marker.sourceHtml or converts data.
 * Read the marker AFTER notes: a completed conversion suppresses the fallback,
 * even when its note has already been deleted. A failed marker read fails closed.
 */
export async function getBookNotesForDisplay(uid, bookId) {
  const location = paths(uid, bookId)
  const book = await get(location.book)
  if (!book.exists()) throw failure('book-not-found', 'Book no longer exists in the library.')
  const notes = await readNotes(location.notes)
  const marker = await get(ref(database, `users/${uid}/bookNotesLegacy/${bookId}`))
  if (marker.exists()) return { notes, legacy: { status: 'processed' } }
  if (notes.some((note) => note.id === LEGACY_BOOK_NOTE_ID)) {
    return { notes, legacy: { status: 'conflict' } }
  }
  const source = book.val().note ?? ''
  try {
    const { contentHtml } = fields({ contentHtml: source }, true)
    return { notes, legacy: { status: source === '' ? 'empty' : 'unprocessed', contentHtml } }
  } catch {
    return { notes, legacy: { status: 'invalid' } }
  }
}

export async function getBookNote(uid, bookId, noteId) {
  identifier(noteId)
  const location = paths(uid, bookId, noteId)
  await requireBook(location.book)
  const snapshot = await get(location.notes)
  return snapshot.exists() ? record(noteId, snapshot.val()) : null
}

/** Returns the stable push ID after server acknowledgement. Never writes to library. */
export async function createBookNote(uid, bookId, input) {
  const location = paths(uid, bookId)
  const values = fields(input)
  await requireBook(location.book)
  const note = push(location.notes)
  await set(note, { ...values, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return note.key
}

export async function updateBookNote(uid, bookId, noteId, patch) {
  identifier(noteId)
  const location = paths(uid, bookId, noteId)
  const values = fields(patch, true)
  await requireBook(location.book)
  if (!(await get(location.notes)).exists()) throw failure('note-not-found', 'Note no longer exists.')
  // The local rules enforce existence again at commit; this preflight is only for clearer errors.
  await update(location.notes, { ...values, updatedAt: serverTimestamp() })
}

export async function deleteBookNote(uid, bookId, noteId) {
  identifier(noteId)
  const location = paths(uid, bookId, noteId)
  await requireBook(location.book)
  if (!(await get(location.notes)).exists()) throw failure('note-not-found', 'Note no longer exists.')
  await remove(location.notes)
}

/** Explicit emulator-only lazy conversion. Reads and ordinary CRUD never invoke it.
 * The immutable marker is the compare-and-set lock enforced by local RTDB rules.
 * A lost acknowledgement is safe: retry reads the marker without rewriting a note.
 */
const legacyConversions = new Map()

export async function migrateLegacyBookNote(uid, bookId) {
  // Share a pending conversion in this SDK instance: get() may otherwise observe
  // another local conversion's optimistic, not-yet-acknowledged marker.
  identifier(uid)
  identifier(bookId)
  const key = `${uid}/${bookId}`
  if (legacyConversions.has(key)) return legacyConversions.get(key)
  const conversion = convertLegacyBookNote(uid, bookId)
  legacyConversions.set(key, conversion)
  try {
    return await conversion
  } finally {
    legacyConversions.delete(key)
  }
}

async function convertLegacyBookNote(uid, bookId) {
  if (isFirebaseEmulator !== true) {
    throw failure('emulator-only', 'Legacy conversion is disabled outside the isolated emulator.')
  }
  const location = paths(uid, bookId, LEGACY_BOOK_NOTE_ID)
  const markerRef = ref(database, `users/${uid}/bookNotesLegacy/${bookId}`)
  const book = await get(location.book)
  if (!book.exists()) throw failure('book-not-found', 'Book no longer exists in the library.')
  const previous = await get(markerRef)
  if (previous.exists()) return previous.val()
  if ((await get(location.notes)).exists()) {
    throw failure('legacy-conflict', 'Reserved legacy note already exists without its marker.')
  }
  const sourceHtml = book.val().note ?? ''
  // Validate before committing anything. Invalid/oversized historical data stays untouched.
  const today = new Date()
  const date = `${today.getFullYear().toString().padStart(4, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const values = fields({ contentHtml: sourceHtml, date })
  const marker = { version: 1, outcome: sourceHtml === '' ? 'empty' : 'copied', sourceHtml, processedAt: serverTimestamp() }
  const writes = { [`bookNotesLegacy/${bookId}`]: marker }
  if (marker.outcome === 'copied') {
    writes[`bookNotes/${bookId}/${LEGACY_BOOK_NOTE_ID}`] = {
      ...values, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }
  }
  try {
    // Atomic multi-location CAS: immutable marker + reserved destination + source check.
    await update(ref(database, `users/${uid}`), writes)
  } catch (error) {
    // Only a server rule rejection can be a concurrent winner. Network failures stay visible.
    if (/permission[ _-]denied/i.test(error.code || error.message || '')) {
      const winner = await get(markerRef)
      if (winner.exists()) return winner.val()
    }
    throw error
  }
  return (await get(markerRef)).val()
}
