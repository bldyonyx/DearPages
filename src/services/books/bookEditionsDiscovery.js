
import { getBookEditions } from './bookEditionsService.js'
import { getOpenLibraryWorkEditions } from './openLibraryEditionsApi.js'
import { resolveOpenLibraryWorkId } from './openLibraryWorkResolver.js'

const SUPPORTED_LANGUAGES = ['fr', 'en']
const MAX_EDITIONS_PER_LANGUAGE = 12
const MAX_ALTERNATIVE_TITLES = 3

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

function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
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
 * Extrait les titres français associés à la même œuvre.
 *
 * Ces titres proviennent des éditions Open Library,
 * et non d'une traduction automatique.
 */
function getFrenchAlternativeTitles(book, editions) {
  const originalTitle = normalizeTitle(book?.title)
  const seen = new Set()

  const titles = []

  for (const edition of editions) {
    if (normalizeLanguage(edition.language) !== 'fr') {
      continue
    }

    const title = String(edition.title || '').trim()
    const normalized = normalizeTitle(title)

    if (
      !normalized ||
      normalized === originalTitle ||
      seen.has(normalized)
    ) {
      continue
    }

    seen.add(normalized)
    titles.push(title)

    if (titles.length >= MAX_ALTERNATIVE_TITLES) {
      break
    }
  }

  return titles
}

/**
 * Découvre une sélection d'éditions FR/EN.
 *
 * Open Library fournit les éditions liées à une œuvre.
 * Ses titres français peuvent enrichir la recherche
 * Google Books, qui vérifie ensuite titre et auteur.
 *
 * Les résultats sont classés selon leurs métadonnées
 * et limités à 12 éditions par langue.
 *
 * Aucune donnée utilisateur n'est modifiée.
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

  let openLibraryEditions = []

  if (workId) {
    try {
      openLibraryEditions =
        await getOpenLibraryWorkEditions(workId)
    } catch {
      // Google Books reste disponible en fallback.
    }
  }

  const availableLanguages = new Set(
    openLibraryEditions.map((edition) =>
      normalizeLanguage(edition.language)
    )
  )

  const hasMissingLanguage = SUPPORTED_LANGUAGES.some(
    (language) => !availableLanguages.has(language)
  )

  const alternativeTitles = getFrenchAlternativeTitles(
    book,
    openLibraryEditions
  )

  let googleEditions = []

  // On complète les langues manquantes, ou on recherche
  // les titres français identifiés par Open Library.
  if (
    openLibraryEditions.length === 0 ||
    hasMissingLanguage ||
    alternativeTitles.length > 0
  ) {
    try {
      googleEditions = await getBookEditions(
        book,
        alternativeTitles
      )
    } catch {
      // On conserve les éditions Open Library disponibles.
    }
  }

  const editions = selectBestEditions([
    ...openLibraryEditions,
    ...googleEditions,
  ])

  return {
    workId,
    source:
      openLibraryEditions.length > 0
        ? 'open-library'
        : googleEditions.length > 0
          ? 'google-books'
          : null,
    editions,
  }
}
