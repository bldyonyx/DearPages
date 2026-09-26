import {
  get,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'

import { database } from './firebase.js'
import { removeBookFromAllCollections } from './collectionsService.js'

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
  const libraryBook = {
    googleBooksId: book.googleBooksId,
    title: book.title,
    authors: book.authors,
    isbn: book.isbn || null,
    isbns: book.isbns || [],
    cover: book.cover || null,
    categories: book.categories || [],
    publishedDate: book.publishedDate || '',
    source: book.source || null,
    openLibraryId: book.openLibraryId || null,
    status,
    addedAt: Date.now(),
  }

  if (status === BOOK_STATUSES.FINISHED) {
    libraryBook.finishedAt = Date.now()
  }

  return libraryBook
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
 * Gets all books stored in a user's library.
 * Books are returned from newest to oldest.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @returns {Promise<Object[]>} User's stored library books.
 */
export async function getUserLibrary(userId) {
  if (!userId) {
    return []
  }

  const libraryRef = ref(
    database,
    `users/${userId}/library`
  )

  const snapshot = await get(libraryRef)

  if (!snapshot.exists()) {
    return []
  }

  return Object.entries(snapshot.val())
    .map(([bookId, book]) => ({
      ...book,
      googleBooksId: book.googleBooksId || bookId,
    }))
    .sort(
      (firstBook, secondBook) =>
        (secondBook.addedAt || 0) -
        (firstBook.addedAt || 0)
    )
}

/**
 * Gets a book from a user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Book ID.
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
 * Changes the reading status of a book already stored in the user's library.
 *
 * When a book enters the "finished" status, a finishedAt timestamp is stored.
 * When it leaves "finished", finishedAt is removed from Realtime Database.
 * If the requested status already matches the stored status, nothing is
 * written, so an existing finishedAt is not replaced unnecessarily.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Book ID.
 * @param {string} status - New reading status.
 * @returns {Promise<Object|null>} Updated fields, or null if status is unchanged.
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
  const snapshot = await get(bookRef)
  const storedBook = snapshot.exists() ? snapshot.val() : null

  if (storedBook?.status === status) {
    return null
  }

  const updatedBook = {
    status,
    updatedAt: Date.now(),
  }

  if (status === BOOK_STATUSES.FINISHED) {
    updatedBook.finishedAt = Date.now()
  } else if (storedBook?.status === BOOK_STATUSES.FINISHED) {
    updatedBook.finishedAt = null
  }

  await update(bookRef, updatedBook)

  return updatedBook
}

/**
 * Removes a book and its private reading data
 * from a user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Book ID.
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

  await removeBookFromAllCollections(userId, bookId)
  await remove(bookRef)
}

/**
 * Saves the user's personal note for a library book.
 *
 * Notes are used while a book is marked as "to-read" or "reading".
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} bookId - Book ID.
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
 * @param {string} bookId - Book ID.
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
 * @param {string} bookId - Book ID.
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
