export const BOOK_API_SOURCES = {
  GOOGLE_BOOKS: 'google-books',
  OPEN_LIBRARY: 'open-library',
}

/**
 * Checks whether a route ID points to an Open Library Work.
 *
 * Trending books use Work IDs such as `OL76590W`, while regular search
 * results use Google Books volume IDs.
 *
 * @param {string} bookId - Book ID from the route.
 * @returns {boolean} True when the ID belongs to Open Library.
 */
export function isOpenLibraryWorkId(bookId) {
  return /^OL\d+W$/i.test(bookId)
}

/**
 * Selects the public API that owns a BookPage route ID.
 *
 * @param {string} bookId - Book ID from the route.
 * @returns {string} One of BOOK_API_SOURCES.
 */
export function getBookApiSource(bookId) {
  return isOpenLibraryWorkId(bookId)
    ? BOOK_API_SOURCES.OPEN_LIBRARY
    : BOOK_API_SOURCES.GOOGLE_BOOKS
}

export function getBookRouteId(book) {
  return book?.googleBooksId || book?.id || null
}

export function getRouteStateBook(routeState, bookId) {
  const routeBook = routeState?.book

  return getBookRouteId(routeBook) === bookId
    ? routeBook
    : null
}

export function getRouteStateLibraryBook(routeState, bookId) {
  const routeLibraryBook = routeState?.libraryBook

  return getBookRouteId(routeLibraryBook) === bookId
    ? routeLibraryBook
    : null
}

export function toSafeArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  return value ? [value] : fallback
}

export function normalizeBookForPage(book) {
  if (!book) {
    return null
  }

  const routeId = getBookRouteId(book)
  const isbns = toSafeArray(book.isbns)

  return {
    ...book,
    id: book.id || routeId,
    googleBooksId: book.googleBooksId || routeId,
    authors: toSafeArray(book.authors, ['Auteur inconnu']),
    categories: toSafeArray(book.categories),
    isbn: book.isbn || isbns[0] || null,
    isbns,
    cover: book.cover || null,
    source: book.source || null,
  }
}

export function hasUsefulAuthors(book) {
  return (
    Array.isArray(book?.authors) &&
    book.authors.length > 0 &&
    !(
      book.authors.length === 1 &&
      book.authors[0] === 'Auteur inconnu'
    )
  )
}

/**
 * Merges canonical metadata over the optimistic route-state book.
 *
 * Canonical data wins, except when it is missing fields that are useful for
 * the first paint. This keeps temporary route metadata, like covers or
 * categories, from disappearing just because the follow-up source is sparse.
 *
 * @param {Object|null} currentBook - Current optimistic/canonical page book.
 * @param {Object|null} nextBook - Newly loaded canonical book.
 * @returns {Object|null} Normalized page book.
 */
export function mergeBookDetails(currentBook, nextBook) {
  const normalizedNextBook = normalizeBookForPage(nextBook)

  if (!normalizedNextBook) {
    return normalizeBookForPage(currentBook)
  }

  const normalizedCurrentBook =
    normalizeBookForPage(currentBook)

  if (!normalizedCurrentBook) {
    return normalizedNextBook
  }

  const mergedBook = {
    ...normalizedCurrentBook,
    ...normalizedNextBook,
  }

  if (!nextBook.cover && normalizedCurrentBook.cover) {
    mergedBook.cover = normalizedCurrentBook.cover
  }

  if (!nextBook.isbn && normalizedCurrentBook.isbn) {
    mergedBook.isbn = normalizedCurrentBook.isbn
  }

  if (
    !toSafeArray(nextBook.isbns).length &&
    normalizedCurrentBook.isbns.length
  ) {
    mergedBook.isbns = normalizedCurrentBook.isbns
  }

  if (
    !hasUsefulAuthors(nextBook) &&
    hasUsefulAuthors(normalizedCurrentBook)
  ) {
    mergedBook.authors = normalizedCurrentBook.authors
  }

  if (
    !toSafeArray(nextBook.categories).length &&
    normalizedCurrentBook.categories.length
  ) {
    mergedBook.categories = normalizedCurrentBook.categories
  }

  return normalizeBookForPage(mergedBook)
}
