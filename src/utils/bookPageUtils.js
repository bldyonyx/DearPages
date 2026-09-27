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
  return book?.googleBooksId || book?.id || book?.openLibraryId || null
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

function hasUsefulString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasUsefulTitle(value) {
  return hasUsefulString(value) && value !== 'Titre inconnu'
}

function hasUsefulArray(value) {
  return Array.isArray(value) && value.filter(Boolean).length > 0
}

function getPreferredValue(currentValue, nextValue, isUseful) {
  return isUseful(currentValue) ? currentValue : nextValue
}

/**
 * Merges canonical metadata into the optimistic route-state book.
 *
 * Route-state data represents the exact book the user selected, so canonical
 * data only fills fields that are missing from the current page book.
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
    ...normalizedNextBook,
    ...normalizedCurrentBook,
    id: getPreferredValue(
      normalizedCurrentBook.id,
      normalizedNextBook.id,
      hasUsefulString
    ),
    googleBooksId: getPreferredValue(
      normalizedCurrentBook.googleBooksId,
      normalizedNextBook.googleBooksId,
      hasUsefulString
    ),
    openLibraryId: getPreferredValue(
      normalizedCurrentBook.openLibraryId,
      normalizedNextBook.openLibraryId,
      hasUsefulString
    ),
    source: getPreferredValue(
      normalizedCurrentBook.source,
      normalizedNextBook.source,
      hasUsefulString
    ),
    title: getPreferredValue(
      normalizedCurrentBook.title,
      normalizedNextBook.title,
      hasUsefulTitle
    ),
    subtitle: getPreferredValue(
      normalizedCurrentBook.subtitle,
      normalizedNextBook.subtitle,
      hasUsefulString
    ),
    authors: hasUsefulAuthors(normalizedCurrentBook)
      ? normalizedCurrentBook.authors
      : normalizedNextBook.authors,
    cover: getPreferredValue(
      normalizedCurrentBook.cover,
      normalizedNextBook.cover,
      hasUsefulString
    ),
    isbn: getPreferredValue(
      normalizedCurrentBook.isbn,
      normalizedNextBook.isbn,
      hasUsefulString
    ),
    isbns: getPreferredValue(
      normalizedCurrentBook.isbns,
      normalizedNextBook.isbns,
      hasUsefulArray
    ),
    description: getPreferredValue(
      normalizedCurrentBook.description,
      normalizedNextBook.description,
      hasUsefulString
    ),
    categories: getPreferredValue(
      normalizedCurrentBook.categories,
      normalizedNextBook.categories,
      hasUsefulArray
    ),
    publishedDate: getPreferredValue(
      normalizedCurrentBook.publishedDate,
      normalizedNextBook.publishedDate,
      hasUsefulString
    ),
    language: getPreferredValue(
      normalizedCurrentBook.language,
      normalizedNextBook.language,
      hasUsefulString
    ),
    printType: getPreferredValue(
      normalizedCurrentBook.printType,
      normalizedNextBook.printType,
      hasUsefulString
    ),
  }

  return normalizeBookForPage(mergedBook)
}
