const OPEN_LIBRARY_ISBN_COVERS_URL =
  'https://covers.openlibrary.org/b/isbn'
const OPEN_LIBRARY_BOOKS_API_URL =
  'https://openlibrary.org/api/books'

const openLibraryCoverCache = new Map()

export const OPEN_LIBRARY_COVER_CACHE_STATUS = {
  RESOLVED: 'resolved',
  MISSING: 'missing',
  PENDING: 'pending',
}

export const GOOGLE_COVER_PRIORITY = [
  'extraLarge',
  'large',
  'medium',
  'small',
  'thumbnail',
  'smallThumbnail',
]

function normalizeIsbn(value) {
  return String(value || '')
    .replace(/[^0-9X]/gi, '')
    .toUpperCase()
}

export function getPreferredIsbn(isbns = []) {
  const normalizedIsbns = isbns.map(normalizeIsbn).filter(Boolean)

  return (
    normalizedIsbns.find((isbn) => isbn.length === 13) ||
    normalizedIsbns.find((isbn) => isbn.length === 10) ||
    normalizedIsbns[0] ||
    null
  )
}

export function getIndustryIdentifierIsbns(
  industryIdentifiers = []
) {
  const identifiers = industryIdentifiers
    .map((identifier) => ({
      type: identifier.type,
      isbn: normalizeIsbn(identifier.identifier),
    }))
    .filter((identifier) => identifier.isbn)

  const isbn13 = identifiers
    .filter((identifier) => identifier.type === 'ISBN_13')
    .map((identifier) => identifier.isbn)
  const isbn10 = identifiers
    .filter((identifier) => identifier.type === 'ISBN_10')
    .map((identifier) => identifier.isbn)
  const otherIsbns = identifiers
    .filter(
      (identifier) =>
        identifier.type !== 'ISBN_13' &&
        identifier.type !== 'ISBN_10'
    )
    .map((identifier) => identifier.isbn)

  return [...isbn13, ...isbn10, ...otherIsbns]
}

export function getBestGoogleCover(imageLinks = {}) {
  return (
    GOOGLE_COVER_PRIORITY.map((size) => imageLinks[size]).find(
      Boolean
    ) || null
  )
}

export function getOpenLibraryIsbnCoverUrl(isbn) {
  const normalizedIsbn = normalizeIsbn(isbn)

  return normalizedIsbn
    ? `${OPEN_LIBRARY_ISBN_COVERS_URL}/${normalizedIsbn}-L.jpg?default=false`
    : null
}

export function getCachedOpenLibraryCoverByIsbn(isbn) {
  const normalizedIsbn = normalizeIsbn(isbn)

  return normalizedIsbn
    ? openLibraryCoverCache.get(normalizedIsbn) || null
    : null
}

export function isOpenLibraryCoverUrl(coverUrl) {
  if (!coverUrl) return false

  try {
    return (
      new URL(coverUrl).hostname.toLowerCase() ===
      'covers.openlibrary.org'
    )
  } catch {
    return false
  }
}

function getOpenLibraryBooksApiUrl(normalizedIsbn) {
  const params = new URLSearchParams({
    bibkeys: `ISBN:${normalizedIsbn}`,
    jscmd: 'data',
    format: 'json',
  })

  return `${OPEN_LIBRARY_BOOKS_API_URL}?${params.toString()}`
}

function getOpenLibraryLargeCoverUrl(coverUrl) {
  if (!isOpenLibraryCoverUrl(coverUrl)) {
    return null
  }

  try {
    const url = new URL(coverUrl)

    url.searchParams.set('default', 'false')

    return url.toString()
  } catch {
    return null
  }
}

function getOpenLibraryMetadataCover(
  metadata,
  normalizedIsbn
) {
  const book = metadata?.[`ISBN:${normalizedIsbn}`]

  return getOpenLibraryLargeCoverUrl(book?.cover?.large)
}

async function fetchOpenLibraryCoverByIsbn(normalizedIsbn) {
  if (typeof fetch !== 'function') {
    return null
  }

  try {
    const response = await fetch(
      getOpenLibraryBooksApiUrl(normalizedIsbn)
    )

    if (!response.ok) {
      return null
    }

    return getOpenLibraryMetadataCover(
      await response.json(),
      normalizedIsbn
    )
  } catch {
    return null
  }
}

export function resolveOpenLibraryCoverByIsbn(isbn) {
  const normalizedIsbn = normalizeIsbn(isbn)

  if (!normalizedIsbn) {
    return Promise.resolve(null)
  }

  const cachedCover = openLibraryCoverCache.get(normalizedIsbn)

  if (
    cachedCover?.status ===
    OPEN_LIBRARY_COVER_CACHE_STATUS.RESOLVED
  ) {
    return Promise.resolve(cachedCover.cover)
  }

  if (
    cachedCover?.status ===
    OPEN_LIBRARY_COVER_CACHE_STATUS.MISSING
  ) {
    return Promise.resolve(null)
  }

  if (
    cachedCover?.status ===
    OPEN_LIBRARY_COVER_CACHE_STATUS.PENDING
  ) {
    return cachedCover.promise
  }

  const cachedRequest =
    fetchOpenLibraryCoverByIsbn(normalizedIsbn).then(
      (resolvedCover) => {
        openLibraryCoverCache.set(
          normalizedIsbn,
          resolvedCover
            ? {
                status:
                  OPEN_LIBRARY_COVER_CACHE_STATUS.RESOLVED,
                cover: resolvedCover,
              }
            : {
                status:
                  OPEN_LIBRARY_COVER_CACHE_STATUS.MISSING,
                cover: null,
              }
        )

        return resolvedCover
      }
    )

  openLibraryCoverCache.set(normalizedIsbn, {
    status: OPEN_LIBRARY_COVER_CACHE_STATUS.PENDING,
    cover: null,
    promise: cachedRequest,
  })

  return cachedRequest
}

export function clearOpenLibraryCoverCache() {
  openLibraryCoverCache.clear()
}
