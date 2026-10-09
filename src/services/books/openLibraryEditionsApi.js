
import { fetchJsonOnce } from '../../utils/inFlightRequest.js'
import { getPreferredIsbn } from './coverUtils.js'

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const EDITIONS_LIMIT = 100
const MAX_PAGES = 5

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

  if (!language) return null

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
 * Parcourt jusqu'à 5 pages de 100 éditions.
 * Les résultats conservent leurs identifiants propres.
 * Aucune donnée utilisateur n'est modifiée.
 */
export async function getOpenLibraryWorkEditions(workId) {
  const normalizedId = normalizeWorkId(workId)

  if (!normalizedId) return []

  const editions = []
  const seen = new Set()

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: String(EDITIONS_LIMIT),
      offset: String(page * EDITIONS_LIMIT),
    })

    const url =
      `${OPEN_LIBRARY_BASE_URL}/works/${normalizedId}/editions.json` +
      `?${params.toString()}`

    let data

    try {
      data = await fetchJsonOnce(url)
    } catch (error) {
      if (page === 0) throw error
      break
    }

    const entries = Array.isArray(data?.entries)
      ? data.entries
      : []

    for (const entry of entries) {
      const edition = formatOpenLibraryEdition(entry)

      if (!edition || seen.has(edition.id)) continue

      seen.add(edition.id)
      editions.push(edition)
    }

    // La dernière page est atteinte.
    if (
      entries.length < EDITIONS_LIMIT ||
      (typeof data.size === 'number' &&
        (page + 1) * EDITIONS_LIMIT >= data.size)
    ) {
      break
    }
  }

  return editions
}
