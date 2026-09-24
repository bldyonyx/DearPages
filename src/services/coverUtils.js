const OPEN_LIBRARY_ISBN_COVERS_URL =
  'https://covers.openlibrary.org/b/isbn'

const openLibraryCoverCache = new Map()

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

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image()

    image.onload = () => resolve(url)
    image.onerror = () => resolve(null)
    image.decoding = 'async'
    image.src = url
  })
}

export function resolveOpenLibraryCoverByIsbn(isbn) {
  const coverUrl = getOpenLibraryIsbnCoverUrl(isbn)

  if (!coverUrl) {
    return Promise.resolve(null)
  }

  if (openLibraryCoverCache.has(coverUrl)) {
    return openLibraryCoverCache.get(coverUrl)
  }

  const request =
    typeof Image === 'undefined'
      ? Promise.resolve(coverUrl)
      : loadImage(coverUrl)

  openLibraryCoverCache.set(coverUrl, request)

  return request
}
