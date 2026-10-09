
import {
  buildAuthorSearchQuery,
  buildTitleSearchQuery,
  getConfirmedTitleAuthorParts,
  isConfirmedAuthorSearch,
  mergeAndRankSearchBooks,
} from '../../utils/bookSearchRelevance.js'

import {
  getGoogleBooksData,
  createVolumesSearchUrl,
} from './googleBooksApi.js'

import { formatGoogleBook } from './googleBooksFormatter.js'
import { getOpenLibraryBooksBySearch } from './trendingBooksApi.js'

const SEARCH_RESULTS_LIMIT = 20
const SEARCH_CANDIDATE_LIMIT = 40
const TITLE_SEARCH_CANDIDATE_LIMIT = 20
const OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT = 20
const SUGGESTION_CANDIDATE_LIMIT = 10
const SUGGESTION_RESULTS_LIMIT = 5

async function searchGoogleBooksCandidates(
  query,
  maxResults,
  message,
  startIndex = 0
) {
  const data = await getGoogleBooksData(
    createVolumesSearchUrl(query, {
      maxResults,
      startIndex,
      printType: 'books',
    }),
    message
  )

  return data.items?.map(formatGoogleBook) || []
}

function getFulfilledCandidateGroups(results) {
  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
}

function getFirstRejectedSearchError(results) {
  return (
    results.find(
      (result) =>
        result.status === 'rejected' && result.reason?.status
    )?.reason ||
    results.find(
      (result) => result.status === 'rejected'
    )?.reason
  )
}

/**
 * Recherche principale dans Découvrir.
 *
 * Combine Google Books et Open Library.
 * Détecte les recherches par auteur et titre + auteur
 * à partir des métadonnées des livres.
 */
export async function searchBooks(query) {
  const trimmedQuery = String(query || '').trim()

  if (!trimmedQuery) return []

  const errorMessage = 'Impossible de récupérer les livres.'
  const candidateGroups = []

  const tokens = trimmedQuery.split(/\s+/)

  const possibleAuthor =
    tokens.length >= 2 && tokens.length <= 3

  const possibleCombined = tokens.length >= 3
  const authorName = tokens.slice(-2).join(' ')
  const titlePart = tokens.slice(0, -2).join(' ')

  const requests = [
    searchGoogleBooksCandidates(
      buildTitleSearchQuery(trimmedQuery),
      TITLE_SEARCH_CANDIDATE_LIMIT,
      errorMessage
    ),

    searchGoogleBooksCandidates(
      trimmedQuery,
      SEARCH_CANDIDATE_LIMIT,
      errorMessage
    ),

    getOpenLibraryBooksBySearch({
      title: trimmedQuery,
      limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
    }),
  ]

  if (possibleAuthor) {
    requests.push(
      searchGoogleBooksCandidates(
        buildAuthorSearchQuery(trimmedQuery),
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage
      ),

      getOpenLibraryBooksBySearch({
        author: trimmedQuery,
        limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
      })
    )
  }

  if (possibleCombined && titlePart) {
    requests.push(
      searchGoogleBooksCandidates(
        `intitle:"${titlePart}" inauthor:${tokens.at(-1)}`,
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage
      ),

      getOpenLibraryBooksBySearch({
        title: titlePart,
        author: authorName,
        limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
      })
    )
  }

  const initialResults = await Promise.allSettled(requests)

  candidateGroups.push(
    ...getFulfilledCandidateGroups(initialResults)
  )

  if (candidateGroups.length === 0) {
    throw getFirstRejectedSearchError(initialResults)
  }

  const getIntent = () => {
    const candidates = candidateGroups.flat()

    const combined = getConfirmedTitleAuthorParts(
      candidates,
      trimmedQuery
    )

    return {
      combined,
      authorOnly:
        !combined &&
        isConfirmedAuthorSearch(candidates, trimmedQuery),
    }
  }

  let ranked = mergeAndRankSearchBooks(
    candidateGroups,
    trimmedQuery,
    SEARCH_RESULTS_LIMIT,
    getIntent()
  )

  if (!ranked.length && !getIntent().authorOnly) {
    const extra = await Promise.allSettled([
      searchGoogleBooksCandidates(
        buildTitleSearchQuery(trimmedQuery),
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage,
        TITLE_SEARCH_CANDIDATE_LIMIT
      ),
    ])

    candidateGroups.push(
      ...getFulfilledCandidateGroups(extra)
    )

    ranked = mergeAndRankSearchBooks(
      candidateGroups,
      trimmedQuery,
      SEARCH_RESULTS_LIMIT,
      getIntent()
    )
  }

  return ranked
}

/**
 * Suggestions pendant la saisie.
 */
export async function getBookSuggestions(query) {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 2) {
    return []
  }

  const tokens = trimmedQuery.split(/\s+/)

  if (tokens.length >= 2) {
    const books = await searchBooks(trimmedQuery)

    return books.slice(0, SUGGESTION_RESULTS_LIMIT)
  }

  const candidates = await searchGoogleBooksCandidates(
    trimmedQuery,
    SUGGESTION_CANDIDATE_LIMIT,
    'Impossible de récupérer les suggestions.'
  )

  return mergeAndRankSearchBooks(
    [candidates],
    trimmedQuery,
    SUGGESTION_RESULTS_LIMIT
  )
}
