/* eslint-disable no-control-regex -- Validation intentionally rejects control characters. */
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import { database } from './firebase.js'
import { sanitizeNoteHtml } from '../utils/noteHtmlSanitizer.js'

export const BOOK_NOTE_LIMITS = Object.freeze({ title: 200, contentHtml: 200000 })

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

export function isBookNoteDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
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

export async function getBookNotes(uid, bookId) {
  const location = paths(uid, bookId)
  await requireBook(location.book)
  const snapshot = await get(location.notes)
  return Object.entries(snapshot.val() || {}).map(([id, value]) => record(id, value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id))
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
