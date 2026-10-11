
import {
  buildAuthorSearchQuery,
  buildTitleSearchQueries,
  getConfirmedTitleAuthorParts,
  getSearchBookIdentityKeys,
  getTitleAuthorSplitCandidates,
  isConfirmedAuthorSearch,
  mergeAndRankSearchBooks,
  normalizeSearchText,
} from '../../utils/bookSearchRelevance.js'

import {
  getGoogleBooksData,
  createVolumesSearchUrl,
} from './googleBooksApi.js'

import { formatGoogleBook } from './googleBooksFormatter.js'
import {
  getOpenLibraryBooksByKeywordSearch,
  getOpenLibraryBooksBySearch,
} from './trendingBooksApi.js'

const SEARCH_RESULTS_LIMIT = 20
const SEARCH_CANDIDATE_LIMIT = 40
const TITLE_SEARCH_CANDIDATE_LIMIT = 20
const OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT = 20
const SUGGESTION_CANDIDATE_LIMIT = 10
const SUGGESTION_RESULTS_LIMIT = 5
const FALLBACK_TITLE_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'au',
  'aux',
  'de',
  'des',
  'du',
  'et',
  'la',
  'le',
  'les',
  'of',
  'the',
  'un',
  'une',
])

function getKeywordSearchQueries(query) {
  const trimmed = String(query || '').trim()
  const normalized = normalizeSearchText(trimmed)
  const shouldAddNormalizedQuery =
    normalized && normalized !== trimmed.toLowerCase()

  return Array.from(
    new Set(
      [
        trimmed,
        shouldAddNormalizedQuery ? normalized : '',
      ].filter(Boolean)
    )
  )
}

function getAuthorSurname(author) {
  return author.split(/\s+/).at(-1)
}

function buildTitleAuthorRequests(parts, errorMessage) {
  return parts.flatMap(({ title, author }) => [
    searchGoogleBooksCandidates(
      `intitle:"${title}" inauthor:${getAuthorSurname(author)}`,
      TITLE_SEARCH_CANDIDATE_LIMIT,
      errorMessage
    ),

    getOpenLibraryBooksBySearch({
      title,
      author,
      limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
    }),
  ])
}

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

function hasGoogleBooksServiceUnavailable(results) {
  return results.some(
    (result) =>
      result.status === 'rejected' && result.reason?.status === 503
  )
}

function rankCandidates(candidateGroups, query, limit, getIntent) {
  return mergeAndRankSearchBooks(
    candidateGroups,
    query,
    limit,
    getIntent()
  )
}

async function addFulfilledResults(candidateGroups, requests) {
  const results = await Promise.allSettled(requests)

  candidateGroups.push(...getFulfilledCandidateGroups(results))

  return results
}

function hasKnownAuthor(book) {
  return (book?.authors || []).some((author) => {
    const normalizedAuthor = normalizeSearchText(author)

    return (
      normalizedAuthor &&
      normalizedAuthor !== 'auteur inconnu' &&
      normalizedAuthor !== 'unknown author'
    )
  })
}

function hasUsefulMetadata(book) {
  return Boolean(book?.cover || book?.description)
}

function getKnownAuthorKeys(book) {
  return (book?.authors || [])
    .map((author) => normalizeSearchText(author))
    .filter(
      (author) =>
        author &&
        author !== 'auteur inconnu' &&
        author !== 'unknown author'
    )
}

function getMeaningfulTitleTokens(value) {
  return normalizeSearchText(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 2 && !FALLBACK_TITLE_STOP_WORDS.has(token)
    )
}

function getTitleKey(book) {
  return normalizeSearchText(book?.title || '')
}

function hasMeaningfulTitleOverlap(title, query) {
  const queryTokens = getMeaningfulTitleTokens(query)
  const titleTokens = new Set(getMeaningfulTitleTokens(title))

  if (!queryTokens.length) return false

  const matchCount = queryTokens.filter((token) =>
    titleTokens.has(token)
  ).length

  return (
    matchCount >= Math.min(2, queryTokens.length) &&
    matchCount / queryTokens.length >= 0.5
  )
}

function titleMatchesAcceptedFallbackTitle(book, acceptedTitleKeys) {
  const titleKey = getTitleKey(book)

  if (!titleKey) return false

  return Array.from(acceptedTitleKeys).some(
    (acceptedTitle) =>
      acceptedTitle &&
      (titleKey.includes(acceptedTitle) ||
        acceptedTitle.includes(titleKey))
  )
}

function shouldEnrichSparseTitleResults(ranked, intent) {
  return (
    !intent.combined &&
    !intent.authorOnly &&
    ranked.length === 1 &&
    !hasUsefulMetadata(ranked[0])
  )
}

function mergeRankedWithFallbackBooks(ranked, fallbackBooks, limit) {
  const seenKeys = new Set()
  const merged = []

  for (const book of [...ranked, ...fallbackBooks]) {
    const keys = getSearchBookIdentityKeys(book)

    if (keys.some((key) => seenKeys.has(key))) {
      continue
    }

    keys.forEach((key) => seenKeys.add(key))
    merged.push(book)

    if (merged.length >= limit) break
  }

  return merged
}

function addAcceptedFallbackSignals(book, acceptedAuthorKeys, acceptedTitleKeys) {
  getKnownAuthorKeys(book).forEach((author) =>
    acceptedAuthorKeys.add(author)
  )

  const titleKey = getTitleKey(book)

  if (getMeaningfulTitleTokens(titleKey).length >= 2) {
    acceptedTitleKeys.add(titleKey)
  }
}

function rankOpenLibraryKeywordFallbackBooks(
  candidateGroups,
  limit,
  { query = '', ranked = [] } = {}
) {
  const seenKeys = new Set()
  const fallbackRanked = []
  const acceptedAuthorKeys = new Set()
  const acceptedTitleKeys = new Set()

  ranked.forEach((book) => {
    addAcceptedFallbackSignals(
      book,
      acceptedAuthorKeys,
      acceptedTitleKeys
    )
  })

  for (const book of candidateGroups.flat()) {
    if (
      book?.source !== 'open-library' ||
      !hasKnownAuthor(book)
    ) {
      continue
    }

    const authorKeys = getKnownAuthorKeys(book)
    const sharesAcceptedAuthor = authorKeys.some((author) =>
      acceptedAuthorKeys.has(author)
    )
    const titleOverlapsQuery = hasMeaningfulTitleOverlap(
      book.title,
      query
    )
    const matchesAcceptedTitle = titleMatchesAcceptedFallbackTitle(
      book,
      acceptedTitleKeys
    )
    const canTrustTopNativeCandidate =
      fallbackRanked.length === 0 &&
      acceptedAuthorKeys.size === 0 &&
      hasUsefulMetadata(book)

    if (
      !sharesAcceptedAuthor &&
      !titleOverlapsQuery &&
      !matchesAcceptedTitle &&
      !canTrustTopNativeCandidate
    ) {
      continue
    }

    if (
      !hasUsefulMetadata(book) &&
      !titleOverlapsQuery &&
      !matchesAcceptedTitle
    ) {
      continue
    }

    const keys = getSearchBookIdentityKeys(book)

    if (keys.some((key) => seenKeys.has(key))) {
      continue
    }

    keys.forEach((key) => seenKeys.add(key))
    fallbackRanked.push(book)
    addAcceptedFallbackSignals(
      book,
      acceptedAuthorKeys,
      acceptedTitleKeys
    )

    if (fallbackRanked.length >= limit) break
  }

  return fallbackRanked
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
    ...buildTitleSearchQueries(trimmedQuery).map((titleQuery) =>
      searchGoogleBooksCandidates(
        titleQuery,
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage
      )
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
  const hasGoogle503 =
    hasGoogleBooksServiceUnavailable(initialResults)

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

  let intent = getIntent()
  let ranked = mergeAndRankSearchBooks(
    candidateGroups,
    trimmedQuery,
    SEARCH_RESULTS_LIMIT,
    intent
  )

  if (
    (!ranked.length ||
      shouldEnrichSparseTitleResults(ranked, intent)) &&
    !intent.authorOnly
  ) {
    const titleAuthorSplits = getTitleAuthorSplitCandidates(
      trimmedQuery
    )

    if (!ranked.length && possibleCombined && !hasGoogle503) {
      for (const parts of titleAuthorSplits) {
        await addFulfilledResults(
          candidateGroups,
          buildTitleAuthorRequests([parts], errorMessage)
        )

        ranked = rankCandidates(
          candidateGroups,
          trimmedQuery,
          SEARCH_RESULTS_LIMIT,
          getIntent
        )

        if (ranked.length) break
      }
    }

    intent = getIntent()

    if (
      (!ranked.length ||
        shouldEnrichSparseTitleResults(ranked, intent)) &&
      possibleCombined
    ) {
      const keywordResults = await addFulfilledResults(
        candidateGroups,
        getKeywordSearchQueries(trimmedQuery).map((keywordQuery) =>
          getOpenLibraryBooksByKeywordSearch(
            keywordQuery,
            OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT
          )
        )
      )

      intent = getIntent()
      ranked = mergeAndRankSearchBooks(
        candidateGroups,
        trimmedQuery,
        SEARCH_RESULTS_LIMIT,
        intent
      )

      const fallbackBooks = rankOpenLibraryKeywordFallbackBooks(
        getFulfilledCandidateGroups(keywordResults),
        SEARCH_RESULTS_LIMIT,
        { query: trimmedQuery, ranked }
      )

      if (fallbackBooks.length) {
        ranked = mergeRankedWithFallbackBooks(
          ranked,
          fallbackBooks,
          SEARCH_RESULTS_LIMIT
        )
      }
    }

    if (!ranked.length && !hasGoogle503) {
      await addFulfilledResults(
        candidateGroups,
        buildTitleSearchQueries(trimmedQuery).map((titleQuery) =>
          searchGoogleBooksCandidates(
            titleQuery,
            TITLE_SEARCH_CANDIDATE_LIMIT,
            errorMessage,
            TITLE_SEARCH_CANDIDATE_LIMIT
          )
        )
      )

      ranked = rankCandidates(
        candidateGroups,
        trimmedQuery,
        SEARCH_RESULTS_LIMIT,
        getIntent
      )
    }

    if (!ranked.length && possibleCombined) {
      for (const { author } of titleAuthorSplits) {
        ranked = mergeAndRankSearchBooks(
          candidateGroups,
          trimmedQuery,
          SEARCH_RESULTS_LIMIT,
          { authorOnly: true, authorQuery: author }
        )

        if (ranked.length) break
      }
    }
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
