import { fetchJsonOnce } from '../../utils/inFlightRequest.js'
import { isExplicitDiscoveryBook } from '../../utils/discoveryContentSafety.js'
import { getPreferredIsbn } from './coverUtils.js'

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

/**
 * Recupere les livres actuellement tendance sur Open Library.
 *
 * @param {number} [limit=10] - Nombre maximum de livres tendance.
 * @returns {Promise<Array>} Livres formates pour Dear Pages.
 * @throws {Error} Si la requete Open Library echoue.
 */
export async function getTrendingBooksDetails(limit = 10) {
  const params = new URLSearchParams({
    q: 'trending_z_score:{0 TO *]',
    sort: 'trending',
    limit: String(limit),
    fields:
      'key,title,author_name,isbn,cover_i,subject,subject_key,edition_count,ratings_count,want_to_read_count,currently_reading_count,already_read_count',
  })

  let data

  try {
    data = await fetchJsonOnce(
      `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`
    )
  } catch {
    throw new Error('Impossible de recuperer les tendances.')
  }

  return (data.docs || []).filter(isEligibleTrendingBook).map((book) => {
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
  })
}
