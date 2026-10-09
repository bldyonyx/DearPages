
import { fetchJsonOnce } from '../../utils/inFlightRequest.js'
import { isExplicitDiscoveryBook } from '../../utils/discoveryContentSafety.js'
import { getPreferredIsbn } from './coverUtils.js'
import { getBooksBySubject } from './bookSubjectService.js'

// Keep existing imports working during the refactor.
export {
  formatOpenLibrarySearchBook,
  getOpenLibraryBooksBySearch,
  getOpenLibraryBooksBySubject,
  getOpenLibraryBookById,
} from './openLibraryApi.js'

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b/id'

const MIN_TRENDING_EDITION_COUNT = 5
const MIN_TRENDING_RATINGS_COUNT = 2
const MIN_TRENDING_READING_LOG_COUNT = 100

const TRENDING_FALLBACK_SUBJECTS = [
  'fiction',
  'fantasy',
  'romance',
]

const TRENDING_FALLBACK_RESULTS_PER_SUBJECT = 20

function getNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function getReadingLogCount(book) {
  return (
    getNumber(book?.want_to_read_count ?? book?.wantToReadCount) +
    getNumber(
      book?.currently_reading_count ?? book?.currentlyReadingCount
    ) +
    getNumber(book?.already_read_count ?? book?.alreadyReadCount)
  )
}

function hasMainstreamTrendingSignals(book) {
  return (
    getNumber(book?.edition_count ?? book?.editionCount) >=
      MIN_TRENDING_EDITION_COUNT ||
    getNumber(book?.ratings_count ?? book?.ratingsCount) >=
      MIN_TRENDING_RATINGS_COUNT ||
    getReadingLogCount(book) >= MIN_TRENDING_READING_LOG_COUNT
  )
}

export function isEligibleTrendingBook(book) {
  return (
    !isExplicitDiscoveryBook(book) &&
    hasMainstreamTrendingSignals(book)
  )
}

function formatTrendingBook(book) {
  const isbns = book.isbn || []
  const subjects = book.subject || []
  const subjectKeys = book.subject_key || []

  return {
    id: book.key.replace('/works/', ''),
    openLibraryId: book.key,
    title: book.title || 'Titre inconnu',
    authors: book.author_name || ['Auteur inconnu'],
    isbn: getPreferredIsbn(isbns),
    isbns,
    cover: book.cover_i
      ? `${OPEN_LIBRARY_COVERS_URL}/${book.cover_i}-L.jpg?default=false`
      : null,
    subjects,
    subjectKeys,
    categories: subjects,
    editionCount: getNumber(book.edition_count),
    ratingsCount: getNumber(book.ratings_count),
    wantToReadCount: getNumber(book.want_to_read_count),
    currentlyReadingCount: getNumber(
      book.currently_reading_count
    ),
    alreadyReadCount: getNumber(book.already_read_count),
    source: 'open-library',
  }
}

/**
 * Recupere une selection de remplacement depuis Google Books.
 *
 * Cette selection ne constitue pas un classement de tendances :
 * elle permet simplement de garder la section utilisable
 * lorsque Open Library est indisponible.
 */
async function getGoogleTrendingFallback(limit) {
  const results = await Promise.allSettled(
    TRENDING_FALLBACK_SUBJECTS.map((subject) =>
      getBooksBySubject(
        subject,
        TRENDING_FALLBACK_RESULTS_PER_SUBJECT
      )
    )
  )

  const seenIdentityKeys = new Set()
  const books = []

  for (const result of results) {
    if (result.status !== 'fulfilled') continue

    for (const book of result.value) {
      if (
        !book?.id ||
        !book?.title ||
        isExplicitDiscoveryBook(book)
      ) {
        continue
      }

      const identityKey = book.isbn
        ? `isbn:${book.isbn}`
        : `google:${book.googleBooksId || book.id}`

      if (seenIdentityKeys.has(identityKey)) {
        continue
      }

      seenIdentityKeys.add(identityKey)
      books.push(book)

      if (books.length >= limit) {
        return books
      }
    }
  }

  return books
}

/**
 * Recupere les livres tendance sur Open Library.
 *
 * Si Open Library est indisponible, utilise une selection
 * Google Books pour maintenir la section fonctionnelle.
 *
 * @param {number} [limit=10] - Nombre maximum de livres.
 * @returns {Promise<Array>} Livres formates pour Dear Pages.
 */
export async function getTrendingBooksDetails(limit = 10) {
  if (limit <= 0) return []

  const params = new URLSearchParams({
    q: 'trending_z_score:{0 TO *]',
    sort: 'trending',
    limit: String(limit),
    fields:
      'key,title,author_name,isbn,cover_i,subject,subject_key,edition_count,ratings_count,want_to_read_count,currently_reading_count,already_read_count',
  })

  try {
    const data = await fetchJsonOnce(
      `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`
    )

    const books = (data.docs || [])
      .filter(isEligibleTrendingBook)
      .map(formatTrendingBook)

    if (books.length > 0) {
      return books
    }
  } catch {
    // Open Library est indisponible :
    // on tente Google Books sans bloquer la section.
  }

  try {
    return await getGoogleTrendingFallback(limit)
  } catch {
    throw new Error('Impossible de recuperer les tendances.')
  }
}
