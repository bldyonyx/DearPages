
export const BOOK_API_SOURCES = {
  GOOGLE_BOOKS: 'google-books',
  OPEN_LIBRARY: 'open-library',
  OPEN_LIBRARY_EDITION: 'open-library-edition',
}

export function isOpenLibraryWorkId(bookId) {
  return /^OL\d+W$/i.test(String(bookId || ''))
}

export function isOpenLibraryEditionId(bookId) {
  return /^OL\d+M$/i.test(String(bookId || ''))
}

export function normalizeOpenLibraryWorkId(openLibraryId) {
  const normalizedId = String(openLibraryId || '')
    .replace(/^\/works\//, '')

  return isOpenLibraryWorkId(normalizedId)
    ? normalizedId
    : ''
}

export function getBookApiSource(bookId) {
  if (isOpenLibraryEditionId(bookId)) {
    return BOOK_API_SOURCES.OPEN_LIBRARY_EDITION
  }

  if (isOpenLibraryWorkId(bookId)) {
    return BOOK_API_SOURCES.OPEN_LIBRARY
  }

  return BOOK_API_SOURCES.GOOGLE_BOOKS
}

export function getBookRouteId(book) {
  if (!book) return null

  if (book.googleBooksId) {
    return book.googleBooksId
  }

  if (isOpenLibraryEditionId(book.openLibraryEditionId)) {
    return book.openLibraryEditionId
  }

  if (isOpenLibraryEditionId(book.id)) {
    return book.id
  }

  return (
    normalizeOpenLibraryWorkId(book.openLibraryId) ||
    book.id ||
    null
  )
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
  if (!book) return null

  const routeId = getBookRouteId(book)
  const isbns = toSafeArray(book.isbns)

  return {
    ...book,
    id: book.id || routeId,
    googleBooksId: book.googleBooksId || null,
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

function hasDisplayableCategory(categories = []) {
  const ignoredCategories = [
    'general',
    'literary collections',
  ]

  return categories
    .flatMap((category) => String(category || '').split('/'))
    .map((category) => category.trim())
    .filter(Boolean)
    .some(
      (category) =>
        !ignoredCategories.includes(category.toLowerCase())
    )
}

function getPreferredValue(currentValue, nextValue, isUseful) {
  return isUseful(currentValue) ? currentValue : nextValue
}

export function hasUsefulBookDescription(book) {
  return hasUsefulString(book?.description)
}

export function hasCompleteInitialBookDetails(book) {
  const normalizedBook = normalizeBookForPage(book)

  if (!normalizedBook) return false

  return (
    hasUsefulTitle(normalizedBook.title) &&
    hasUsefulAuthors(normalizedBook) &&
    (hasUsefulString(normalizedBook.cover) ||
      hasUsefulString(normalizedBook.isbn)) &&
    hasUsefulString(normalizedBook.publishedDate) &&
    hasDisplayableCategory(normalizedBook.categories)
  )
}

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
