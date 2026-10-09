
import { getBooksBySubjectWindow } from '../services/booksApi'
import { isExplicitDiscoveryBook } from './discoveryContentSafety'
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
  return getBookIdentityKeys(book).some((key) =>
    identitySet.has(key)
  )
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

function filterSafeDiscoveryBooks(books) {
  return books.filter(
    (book) => !isExplicitDiscoveryBook(book)
  )
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
  const strictSelection = selectRecommendationBooks(
    candidateBooks,
    {
      limit,
      alreadyShownIdentityKeys: shownIdentityKeys,
      excludedBookIds,
      preferBooksWithCovers,
    }
  )

  if (strictSelection.length >= limit) {
    return {
      books: strictSelection,
      didRelaxSeenHistory: false,
      seenIdentityKeys: shownIdentityKeys,
    }
  }

  const currentBookIdentityKeys =
    createSeenIdentitySetFromBooks(currentBooks)

  const relaxedSelection = selectRecommendationBooks(
    candidateBooks,
    {
      limit,
      alreadyShownIdentityKeys: currentBookIdentityKeys,
      excludedBookIds,
      preferBooksWithCovers,
    }
  )

  if (
    relaxedSelection.length >
    strictSelection.length
  ) {
    const resetSeenIdentityKeys =
      createSeenIdentitySetFromBooks(currentBooks)

    addBooksToIdentitySet(
      resetSeenIdentityKeys,
      relaxedSelection
    )

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
 * Recupere une selection de recommandations Google Books.
 *
 * Si Google Books ne fournit pas assez de livres, Open Library
 * peut completer la selection.
 *
 * Une erreur du fallback Open Library ne doit jamais supprimer
 * les livres deja recuperes depuis Google Books.
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

  // 1. Google Books reste la source principale.
  for (
    let attempt = 0;
    attempt < maxAttempts;
    attempt += 1
  ) {
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

    candidateBooks = mergeUniqueBooks([
      ...candidateBooks,
      ...filterSafeDiscoveryBooks(books),
    ])

    nextStartIndex = windowNextStartIndex

    const selection = selectFromCandidates(
      candidateBooks,
      {
        limit,
        shownIdentityKeys: activeShownIdentityKeys,
        excludedBookIds,
        currentBooks,
        preferBooksWithCovers: true,
      }
    )

    selectedBooks = selection.books
    didResetCycle =
      didResetCycle ||
      selection.didRelaxSeenHistory

    activeShownIdentityKeys =
      selection.seenIdentityKeys

    if (selectedBooks.length >= limit) {
      break
    }

    requestedStartIndex = windowNextStartIndex
  }

  // 2. Open Library est un complement facultatif.
  if (
    selectedBooks.length < limit &&
    typeof fallbackBooksLoader === 'function' &&
    maxFallbackAttempts > 0
  ) {
    for (
      let attempt = 0;
      attempt < maxFallbackAttempts &&
      selectedBooks.length < limit;
      attempt += 1
    ) {
      let fallbackBooks

      try {
        fallbackBooks = await fallbackBooksLoader(
          subject,
          windowSize,
          attempt + 1
        )
      } catch {
        // Open Library est indisponible.
        // On conserve les resultats Google Books
        // et on arrete les tentatives de fallback.
        break
      }

      candidateBooks = mergeUniqueBooks([
        ...candidateBooks,
        ...filterSafeDiscoveryBooks(fallbackBooks),
      ])

      const selection = selectFromCandidates(
        candidateBooks,
        {
          limit,
          shownIdentityKeys: activeShownIdentityKeys,
          excludedBookIds,
          currentBooks,
          preferBooksWithCovers: true,
        }
      )

      selectedBooks = selection.books
      didResetCycle =
        didResetCycle ||
        selection.didRelaxSeenHistory

      activeShownIdentityKeys =
        selection.seenIdentityKeys
    }
  }

  // 3. On ne signale une erreur Google Books
  // que si aucune source n'a fourni de candidats.
  if (
    googleRequestFailed &&
    !candidateBooks.length
  ) {
    throw new Error(
      'Impossible de recuperer cette selection.'
    )
  }

  return {
    books: selectedBooks,
    didResetCycle,
    isPoolExhausted:
      didReachEnd &&
      selectedBooks.length < limit,
    seenIdentityKeys: activeShownIdentityKeys,
    startIndex: nextStartIndex,
  }
}
