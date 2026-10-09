
import { getBookEditions } from './bookEditionsService.js'
import { getOpenLibraryWorkEditions } from './openLibraryEditionsApi.js'
import { resolveOpenLibraryWorkId } from './openLibraryWorkResolver.js'

function getExistingWorkId(book) {
  const candidates = [
    book?.openLibraryId,
    book?.id,
  ]

  for (const candidate of candidates) {
    const match = String(candidate || '').match(
      /^(?:\/works\/)?(OL\d+W)$/i
    )

    if (match) {
      return match[1]
    }
  }

  return null
}

function formatEdition(edition) {
  return {
    id: edition.id,
    title: edition.title,
    language: edition.language,
    isbn: edition.isbn || null,
    isbns: edition.isbns || [],
    publishedDate: edition.publishedDate || '',
    source: edition.source,
    googleBooksId: edition.googleBooksId || null,
    openLibraryEditionId: edition.openLibraryEditionId || null,
    cover: edition.cover || null,
    coverId: edition.coverId || null,
    publishers: edition.publishers || [],
  }
}

/**
 * Recherche les éditions FR/EN disponibles pour un livre.
 *
 * Open Library est prioritaire lorsqu'une œuvre commune
 * peut être identifiée.
 *
 * Google Books sert de solution de repli.
 *
 * Aucun enregistrement utilisateur n'est modifié.
 */
export async function discoverBookEditions(book) {
  if (!book) {
    return {
      workId: null,
      source: null,
      editions: [],
    }
  }

  const existingWorkId = getExistingWorkId(book)

  let workId = existingWorkId

  if (!workId) {
    try {
      workId = await resolveOpenLibraryWorkId(book)
    } catch {
      workId = null
    }
  }

  if (workId) {
    try {
      const editions = await getOpenLibraryWorkEditions(workId)

      if (editions.length > 0) {
        return {
          workId,
          source: 'open-library',
          editions: editions.map(formatEdition),
        }
      }
    } catch {
      // Google Books reste disponible en solution de repli.
    }
  }

  try {
    const editions = await getBookEditions(book)

    return {
      workId,
      source: 'google-books',
      editions: editions.map(formatEdition),
    }
  } catch {
    return {
      workId,
      source: null,
      editions: [],
    }
  }
}
