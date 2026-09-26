import { getBooksBySubjectWindow } from '../services/booksApi'
import {
  addBooksToIdentitySet,
  selectRecommendationBooks,
} from './recommendationSelection'

function createSeenIdentitySetFromBooks(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
}

/**
 * Fetches a bounded batch of subject recommendations until the target count is
 * reached, Google Books is exhausted, or the configured window attempt limit is
 * hit. Each window uses the existing subject relevance filtering from
 * `getBooksBySubjectWindow`, selects with the existing recommendation
 * dedupe/seen rules, and advances pagination with Google's raw returned count
 * via `nextStartIndex` rather than the filtered recommendation count.
 *
 * @param {Object} options - Recommendation batch options.
 * @param {string} options.subject - Google Books subject to fetch.
 * @param {number} options.startIndex - Google Books start index for the first window.
 * @param {number} options.limit - Target number of recommendations to return.
 * @param {Set<string>} options.shownIdentityKeys - Session identities already shown for this shelf.
 * @param {Iterable<string|Object>} options.excludedBookIds - Books to exclude from selection.
 * @param {Array<Object>} options.currentBooks - Currently displayed books, used when a cycle resets.
 * @param {number} options.windowSize - Number of raw Google candidates requested per window.
 * @param {number} options.maxAttempts - Maximum Google windows to inspect.
 * @returns {Promise<{books: Array<Object>, didResetCycle: boolean, isPoolExhausted: boolean, seenIdentityKeys: Set<string>, startIndex: number}>}
 */
export async function fetchRecommendationBatch({
  subject,
  startIndex = 0,
  limit,
  shownIdentityKeys = new Set(),
  excludedBookIds = [],
  currentBooks = [],
  windowSize,
  maxAttempts,
}) {
  if (limit <= 0) {
    return {
      books: [],
      didResetCycle: false,
      isPoolExhausted: false,
      seenIdentityKeys: shownIdentityKeys,
      startIndex,
    }
  }

  let requestedStartIndex = startIndex
  let nextStartIndex = startIndex
  let selectedBooks = []
  let candidateBooks = []
  let didResetCycle = false
  let didReachEnd = false
  let activeShownIdentityKeys = shownIdentityKeys

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const {
      books,
      returnedCount,
      nextStartIndex: windowNextStartIndex,
    } = await getBooksBySubjectWindow(
      subject,
      windowSize,
      requestedStartIndex
    )

    if (returnedCount === 0) {
      didReachEnd = true

      if (requestedStartIndex === 0) {
        break
      }

      didResetCycle = true
      activeShownIdentityKeys =
        createSeenIdentitySetFromBooks(currentBooks)
      requestedStartIndex = 0
      nextStartIndex = 0
      continue
    }

    candidateBooks = [...candidateBooks, ...books]
    nextStartIndex = windowNextStartIndex
    selectedBooks = selectRecommendationBooks(candidateBooks, {
      limit,
      alreadyShownIdentityKeys: activeShownIdentityKeys,
      excludedBookIds,
      preferBooksWithCovers: true,
    })

    if (selectedBooks.length >= limit) {
      break
    }

    requestedStartIndex = windowNextStartIndex
  }

  return {
    books: selectedBooks,
    didResetCycle,
    isPoolExhausted: didReachEnd && selectedBooks.length < limit,
    seenIdentityKeys: activeShownIdentityKeys,
    startIndex: nextStartIndex,
  }
}
