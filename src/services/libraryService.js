import {
  get,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'

import { database } from './firebase.js'

/**
 * Available reading statuses for books stored in Dear Pages.
 */
export const BOOK_STATUSES = {
  TO_READ: 'to-read',
  READING: 'reading',
  FINISHED: 'finished',
  ABANDONED: 'abandoned',
}

/**
 * Creates the data stored for a book in a user's library.
 *
 * @param {Object} book - Formatted Dear Pages book.
 * @param {string} status - Reading status assigned to the book.
 * @returns {Object} Library book data ready for Firebase.
 */
function createLibraryBook(book, status) {
  return {
    googleBooksId: book.googleBooksId,
    title: book.title,
    authors: book.authors,
    isbn: book.isbn || null,
    cover: book.cover || null,
    categories: book.categories || [],
    publishedDate: book.publishedDate || '',
    status,
    addedAt: Date.now(),
  }
}

/**
 * Adds a book to a user's private library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {Object} book - Formatted Dear Pages book.
 * @param {string} [status=BOOK_STATUSES.TO_READ] - Initial reading status.
 * @returns {Promise<void>}
 */
export async function addBookToLibrary(
  userId,
  book,
  status = BOOK_STATUSES.TO_READ
) {
  if (!userId || !book?.googleBooksId) {
    throw new Error('Missing user or book information.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${book.googleBooksId}`
  )

  await set(bookRef, createLibraryBook(book, status))
}

/**
 * Gets a book from a user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @returns {Promise<Object|null>} Stored library book or null.
 */
export async function getLibraryBook(userId, bookId) {
  if (!userId || !bookId) {
    return null
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  const snapshot = await get(bookRef)

  return snapshot.exists() ? snapshot.val() : null
}

/**
 * Changes the reading status of a book already stored
 * in the user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @param {string} status - New reading status.
 * @returns {Promise<void>}
 */
export async function updateBookStatus(
  userId,
  bookId,
  status
) {
  if (!userId || !bookId || !status) {
    throw new Error('Missing information to update book status.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  await update(bookRef, {
    status,
    updatedAt: Date.now(),
  })
}

/**
 * Removes a book and its private reading data
 * from a user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @returns {Promise<void>}
 */
export async function removeBookFromLibrary(userId, bookId) {
  if (!userId || !bookId) {
    throw new Error('Missing user or book information.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  await remove(bookRef)
}

/**
 * Saves the user's personal note for a library book.
 *
 * Notes are used while a book is marked as "to-read" or "reading".
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @param {string} note - Personal note content.
 * @returns {Promise<void>}
 */
export async function updateBookNote(userId, bookId, note) {
  if (!userId || !bookId) {
    throw new Error('Missing user or book information.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  await update(bookRef, {
    note,
    updatedAt: Date.now(),
  })
}

/**
 * Saves the user's review for a library book.
 *
 * Reviews are used for finished or abandoned books.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @param {string} review - User's private review.
 * @returns {Promise<void>}
 */
export async function updateBookReview(userId, bookId, review) {
  if (!userId || !bookId) {
    throw new Error('Missing user or book information.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  await update(bookRef, {
    review,
    updatedAt: Date.now(),
  })
}

/**
 * Saves the user's rating for a finished book.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Google Books ID.
 * @param {number} rating - Rating between 1 and 5.
 * @returns {Promise<void>}
 */
export async function updateBookRating(
  userId,
  bookId,
  rating
) {
  if (!userId || !bookId) {
    throw new Error('Missing user or book information.')
  }

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.')
  }

  const bookRef = ref(
    database,
    `users/${userId}/library/${bookId}`
  )

  await update(bookRef, {
    rating,
    updatedAt: Date.now(),
  })
}