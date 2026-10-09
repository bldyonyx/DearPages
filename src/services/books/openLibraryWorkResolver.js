
import { fetchJsonOnce } from '../../utils/inFlightRequest.js'

const OPEN_LIBRARY_URL = 'https://openlibrary.org'

function normalizeIsbn(value) {
  const isbn = String(value || '')
    .replace(/[^0-9X]/gi, '')
    .toUpperCase()

  return /^(?:\d{13}|\d{9}[\dX])$/.test(isbn)
    ? isbn
    : null
}

function getBookIsbns(book) {
  const candidates = [
    ...(Array.isArray(book?.isbns) ? book.isbns : []),
    book?.isbn,
  ]

  return [
    ...new Set(candidates.map(normalizeIsbn).filter(Boolean)),
  ]
}

function getWorkId(edition) {
  const workKeys = edition?.works || []

  for (const work of workKeys) {
    const match = String(work?.key || '').match(
      /^\/works\/(OL\d+W)$/i
    )

    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Retrouve l'œuvre Open Library d'un livre grâce à ses ISBN.
 *
 * Retourne null si aucun ISBN ne permet de trouver une œuvre.
 * Une erreur réseau est propagée au code appelant.
 */
export async function resolveOpenLibraryWorkId(book) {
  const isbns = getBookIsbns(book)

  if (isbns.length === 0) {
    return null
  }

  for (const isbn of isbns) {
    const url =
      `${OPEN_LIBRARY_URL}/isbn/${encodeURIComponent(isbn)}.json`

    let edition

    try {
      edition = await fetchJsonOnce(url)
    } catch (error) {
      if (error?.status === 404) {
        continue
      }

      throw error
    }

    const workId = getWorkId(edition)

    if (workId) {
      return workId
    }
  }

  return null
}
