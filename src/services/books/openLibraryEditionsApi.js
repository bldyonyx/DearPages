
import { fetchJsonOnce } from '../../utils/inFlightRequest.js'
import { getPreferredIsbn } from './coverUtils.js'

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const EDITIONS_LIMIT = 100

const LANGUAGE_CODES = {
  fre: 'fr',
  fra: 'fr',
  eng: 'en',
}

function normalizeWorkId(workId) {
  const id = String(workId || '')
    .replace(/^\/works\//, '')
    .trim()

  return /^OL\d+W$/i.test(id) ? id : null
}

function getEditionLanguage(edition) {
  const languageKeys = edition.languages || []

  for (const language of languageKeys) {
    const code = String(language?.key || '')
      .split('/')
      .pop()
      .toLowerCase()

    if (LANGUAGE_CODES[code]) {
      return LANGUAGE_CODES[code]
    }
  }

  return null
}

function formatOpenLibraryEdition(edition) {
  const language = getEditionLanguage(edition)

  if (!language) {
    return null
  }

  const isbns = [
    ...(edition.isbn_13 || []),
    ...(edition.isbn_10 || []),
  ]

  const editionId = edition.key?.split('/').pop()

  if (!/^OL\d+M$/i.test(editionId || '')) {
    return null
  }

  return {
    id: editionId,
    openLibraryEditionId: editionId,
    title: edition.title || 'Titre inconnu',
    language,
    isbn: getPreferredIsbn(isbns),
    isbns,
    publishedDate: edition.publish_date || '',
    publishers: edition.publishers || [],
    coverId: edition.covers?.[0] || null,
    source: 'open-library',
  }
}

/**
 * Récupère les éditions FR/EN d'une œuvre Open Library.
 *
 * Cette fonction ne modifie aucune donnée utilisateur.
 * Elle retourne les éditions Open Library, sans les
 * confondre avec des volumes Google Books.
 */
export async function getOpenLibraryWorkEditions(workId) {
  const normalizedId = normalizeWorkId(workId)

  if (!normalizedId) {
    return []
  }

  const params = new URLSearchParams({
    limit: String(EDITIONS_LIMIT),
  })

  const url =
    `${OPEN_LIBRARY_BASE_URL}/works/${normalizedId}/editions.json` +
    `?${params.toString()}`

  const data = await fetchJsonOnce(url)

  const editions = (data.entries || [])
    .map(formatOpenLibraryEdition)
    .filter(Boolean)

  const seen = new Set()

  return editions.filter((edition) => {
    if (seen.has(edition.id)) {
      return false
    }

    seen.add(edition.id)
    return true
  })
}
