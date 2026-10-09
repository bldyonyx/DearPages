
import { getBookEditions } from './bookEditionsService.js'
import { getOpenLibraryWorkEditions } from './openLibraryEditionsApi.js'
import { resolveOpenLibraryWorkId } from './openLibraryWorkResolver.js'

const SUPPORTED_LANGUAGES = ['fr', 'en']
const MAX_EDITIONS_PER_LANGUAGE = 12

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

function normalizeLanguage(language) {
  return String(language || '')
    .toLowerCase()
    .split('-')[0]
}

function hasDescription(edition) {
  const description = edition.description

  if (typeof description === 'string') {
    return description.trim().length > 0
  }

  return (
    typeof description?.value === 'string' &&
    description.value.trim().length > 0
  )
}

function getEditionScore(edition) {
  let score = 0

  // Une couverture est particulièrement importante
  // pour l'affichage dans Dear Pages.
  if (edition.cover || edition.coverId) {
    score += 5
  }

  if (hasDescription(edition)) {
    score += 4
  }

  if (edition.authors?.length > 0) {
    score += 3
  }

  if (edition.isbn || edition.isbns?.length > 0) {
    score += 2
  }

  if (edition.publishers?.length > 0) {
    score += 1
  }

  if (edition.publishedDate) {
    score += 1
  }

  return score
}

function formatEdition(edition) {
  return {
    id: edition.id,
    title: edition.title,
    language: normalizeLanguage(edition.language),
    isbn: edition.isbn || null,
    isbns: edition.isbns || [],
    publishedDate: edition.publishedDate || '',
    source: edition.source,
    googleBooksId: edition.googleBooksId || null,
    openLibraryEditionId:
      edition.openLibraryEditionId || null,
    cover: edition.cover || null,
    coverId: edition.coverId || null,
    authors: edition.authors || [],
    description: edition.description || '',
    publishers: edition.publishers || [],
  }
}

function selectBestEditions(editions) {
  const seenIds = new Set()
  const seenIsbns = new Set()

  const sorted = editions
    .filter((edition) =>
      SUPPORTED_LANGUAGES.includes(
        normalizeLanguage(edition.language)
      )
    )
    .filter((edition) => edition.id && edition.title)
    .map(formatEdition)
    .sort(
      (first, second) =>
        getEditionScore(second) - getEditionScore(first)
    )

  const unique = sorted.filter((edition) => {
    const idKey = `${edition.source}:${edition.id}`

    if (seenIds.has(idKey)) {
      return false
    }

    const isbnKey = edition.isbn
      ? String(edition.isbn).replace(/[^0-9X]/gi, '')
      : null

    if (isbnKey && seenIsbns.has(isbnKey)) {
      return false
    }

    seenIds.add(idKey)

    if (isbnKey) {
      seenIsbns.add(isbnKey)
    }

    return true
  })

  return SUPPORTED_LANGUAGES.flatMap((language) =>
    unique
      .filter((edition) => edition.language === language)
      .slice(0, MAX_EDITIONS_PER_LANGUAGE)
  )
}

/**
 * Découvre une sélection d'éditions FR/EN.
 *
 * Open Library : éditions liées à une œuvre commune.
 * Google Books : fallback avec validation du titre
 * et de l'auteur dans bookEditionsService.
 *
 * Favorise les métadonnées de qualité.
 * Ne modifie aucune donnée utilisateur.
 */
export async function discoverBookEditions(book) {
  if (!book) {
    return {
      workId: null,
      source: null,
      editions: [],
    }
  }

  let workId = getExistingWorkId(book)

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
          editions: selectBestEditions(editions),
        }
      }
    } catch {
      // Google Books reste disponible en fallback.
    }
  }

  try {
    const editions = await getBookEditions(book)

    return {
      workId,
      source: 'google-books',
      editions: selectBestEditions(editions),
    }
  } catch {
    return {
      workId,
      source: null,
      editions: [],
    }
  }
}
