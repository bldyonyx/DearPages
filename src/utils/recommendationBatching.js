import { getBooksBySubjectWindow } from '../services/booksApi'
import {
  addBooksToIdentitySet,
  getBookIdentityKeys,
  selectRecommendationBooks,
} from './recommendationSelection'

function createSeenIdentitySetFromBooks(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
}

function bookMatchesIdentitySet(book, identitySet) {
  return getBookIdentityKeys(book).some((key) => identitySet.has(key))
}

function mergeUniqueBooks(books) {
  const seenIdentityKeys = new Set()
  const uniqueBooks = []

  books.forEach((book) => {
    if (bookMatchesIdentitySet(book, seenIdentityKeys)) return

    addBooksToIdentitySet(seenIdentityKeys, [book])
    uniqueBooks.push(book)
  })

  return uniqueBooks
}

function selectFromCandidates(
  candidateBooks,
  {
    limit,
    shownIdentityKeys,
    excludedBookIds,
    currentBooks,
    preferBooksWithCovers = true,
  }
) {
  const strictSelection = selectRecommendationBooks(candidateBooks, {
    limit,
    alreadyShownIdentityKeys: shownIdentityKeys,
    excludedBookIds,
    preferBooksWithCovers,
  })

  if (strictSelection.length >= limit) {
    return {
      books: strictSelection,
      didRelaxSeenHistory: false,
      seenIdentityKeys: shownIdentityKeys,
    }
  }

  const currentBookIdentityKeys =
    createSeenIdentitySetFromBooks(currentBooks)
  const relaxedSelection = selectRecommendationBooks(candidateBooks, {
    limit,
    alreadyShownIdentityKeys: currentBookIdentityKeys,
    excludedBookIds,
    preferBooksWithCovers,
  })

  if (relaxedSelection.length > strictSelection.length) {
    const resetSeenIdentityKeys =
      createSeenIdentitySetFromBooks(currentBooks)

    addBooksToIdentitySet(resetSeenIdentityKeys, relaxedSelection)

    return {
      books: relaxedSelection,
      didRelaxSeenHistory: true,
      seenIdentityKeys: resetSeenIdentityKeys,
    }
  }

  return {
    books: strictSelection,
    didRelaxSeenHistory: false,
    seenIdentityKeys: shownIdentityKeys,
  }
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
 * @param {Function} [options.fallbackBooksLoader] - Optional bounded fallback candidate loader.
 * @param {number} [options.maxFallbackAttempts=0] - Maximum fallback pages/windows to inspect.
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
  fallbackBooksLoader,
  maxFallbackAttempts = 0,
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
  let googleRequestFailed = false

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let books = []
    let returnedCount = 0
    let windowNextStartIndex = requestedStartIndex

    try {
      const result = await getBooksBySubjectWindow(
        subject,
        windowSize,
        requestedStartIndex
      )

      books = result.books
      returnedCount = result.returnedCount
      windowNextStartIndex = result.nextStartIndex
    } catch {
      googleRequestFailed = true
      break
    }

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

    candidateBooks = mergeUniqueBooks([...candidateBooks, ...books])
    nextStartIndex = windowNextStartIndex
    const selection = selectFromCandidates(candidateBooks, {
      limit,
      shownIdentityKeys: activeShownIdentityKeys,
      excludedBookIds,
      currentBooks,
      preferBooksWithCovers: true,
    })

    selectedBooks = selection.books
    didResetCycle =
      didResetCycle || selection.didRelaxSeenHistory
    activeShownIdentityKeys = selection.seenIdentityKeys

    if (selectedBooks.length >= limit) {
      break
    }

    requestedStartIndex = windowNextStartIndex
  }

  if (
    selectedBooks.length < limit &&
    typeof fallbackBooksLoader === 'function' &&
    maxFallbackAttempts > 0
  ) {
    for (
      let attempt = 0;
      attempt < maxFallbackAttempts && selectedBooks.length < limit;
      attempt += 1
    ) {
      const fallbackBooks = await fallbackBooksLoader(
        subject,
        windowSize,
        attempt + 1
      )

      candidateBooks = mergeUniqueBooks([
        ...candidateBooks,
        ...fallbackBooks,
      ])
      const selection = selectFromCandidates(candidateBooks, {
        limit,
        shownIdentityKeys: activeShownIdentityKeys,
        excludedBookIds,
        currentBooks,
        preferBooksWithCovers: true,
      })

      selectedBooks = selection.books
      didResetCycle =
        didResetCycle || selection.didRelaxSeenHistory
      activeShownIdentityKeys = selection.seenIdentityKeys
    }
  }

  if (googleRequestFailed && !candidateBooks.length) {
    throw new Error('Impossible de recuperer cette selection.')
  }

  return {
    books: selectedBooks,
    didResetCycle,
    isPoolExhausted: didReachEnd && selectedBooks.length < limit,
    seenIdentityKeys: activeShownIdentityKeys,
    startIndex: nextStartIndex,
  }
}
