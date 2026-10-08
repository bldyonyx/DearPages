import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getOpenLibraryBooksBySubject,
  getTrendingBooksDetails,
} from '../services/trendingBooksApi'
import { fetchRecommendationBatch } from '../utils/recommendationBatching'
import {
  addBooksToIdentitySet,
  selectRecommendationBooks,
} from '../utils/recommendationSelection'
import {
  readRecommendationState,
  RECOMMENDATION_STORAGE_KEYS,
  writeRecommendationState,
} from '../utils/recommendationSessionStorage'

const HOME_SHELF_BOOK_LIMIT = 7
const HOME_GOOGLE_CANDIDATE_POOL_SIZE = 40
const HOME_MAX_GOOGLE_WINDOW_ATTEMPTS = 4
const HOME_MAX_FALLBACK_WINDOW_ATTEMPTS = 2
const HOME_TRENDING_CANDIDATE_POOL_SIZE = 100
const EMPTY_EXCLUDED_BOOK_IDS = []

function createSeenIdentitySetFromBooks(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
}

export function selectTrendingRefreshBooks(
  candidatePool,
  {
    limit = HOME_SHELF_BOOK_LIMIT,
    shownIdentityKeys = new Set(),
    excludedBookIds = EMPTY_EXCLUDED_BOOK_IDS,
  } = {}
) {
  const unseenBooks = selectRecommendationBooks(candidatePool, {
    limit,
    alreadyShownIdentityKeys: shownIdentityKeys,
    excludedBookIds,
    preferBooksWithCovers: true,
  })

  if (unseenBooks.length >= limit) {
    const nextShownIdentityKeys = new Set(shownIdentityKeys)

    addBooksToIdentitySet(nextShownIdentityKeys, unseenBooks)

    return {
      books: unseenBooks,
      seenIdentityKeys: nextShownIdentityKeys,
      isPoolExhausted: false,
    }
  }

  const resetSeenIdentityKeys =
    createSeenIdentitySetFromBooks(unseenBooks)
  const recycledBooks = selectRecommendationBooks(candidatePool, {
    limit: limit - unseenBooks.length,
    alreadyShownIdentityKeys: resetSeenIdentityKeys,
    excludedBookIds,
    preferBooksWithCovers: true,
  })
  const books = [...unseenBooks, ...recycledBooks].slice(0, limit)
  const nextShownIdentityKeys = createSeenIdentitySetFromBooks(books)

  return {
    books,
    seenIdentityKeys: nextShownIdentityKeys,
    isPoolExhausted: books.length < limit,
  }
}

function writeTrendingState(
  userId,
  {
    books,
    candidatePool,
    seenIdentityKeys,
    isPoolExhausted = false,
  }
) {
  writeRecommendationState(
    RECOMMENDATION_STORAGE_KEYS.trending(userId),
    {
      books,
      seenIdentityKeys,
      candidatePool,
      isPoolExhausted,
    }
  )
}

function shouldFetchHomeForYou(savedState) {
  if (!savedState) return true

  return (
    savedState.books.length < HOME_SHELF_BOOK_LIMIT &&
    !savedState.isPoolExhausted
  )
}

function shouldRefillShelf(savedState) {
  if (!savedState) return true

  return (
    savedState.books.length < HOME_SHELF_BOOK_LIMIT &&
    !savedState.isPoolExhausted
  )
}

/**
 * Charge les selections de la vue Decouvrir par defaut.
 *
 * Les sections sont volontairement chargees avec `Promise.allSettled`:
 * une selection indisponible ne bloque pas les autres, et la page affiche
 * un message de disponibilite partielle si au moins une requete echoue.
 *
 * @param {Object} options - Options de chargement de la home Discover.
 * @param {boolean} options.isEnabled - Indique si la home Discover est active.
 * @param {string} options.userId - Firebase Authentication user ID.
 * @param {string} options.personalizedSubject - Subject Google Books pour l'aperçu personnalisé.
 * @param {string} options.forYouCacheSignature - Signature des genres pour le cache For You.
 * @param {Iterable<string|Object>} [excludedBookIds] - Identifiants a exclure plus tard depuis la bibliotheque.
 * @returns {Object} Livres et etats de chargement de la vue Decouvrir.
 */
function useDiscoverHomeBooks({
  isEnabled,
  userId,
  personalizedSubject,
  forYouCacheSignature,
  excludedBookIds = EMPTY_EXCLUDED_BOOK_IDS
}) {
  const { t } = useTranslation()
  const [forYouBooks, setForYouBooks] = useState([])
  const [trendingBooks, setTrendingBooks] = useState([])
  const [mustReadBooks, setMustReadBooks] = useState([])
  const [isDiscoverLoading, setIsDiscoverLoading] =
    useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [isTrendingRefreshing, setIsTrendingRefreshing] =
    useState(false)
  const [trendingRefreshError, setTrendingRefreshError] =
    useState('')
  const [isMustReadRefreshing, setIsMustReadRefreshing] =
    useState(false)
  const [mustReadRefreshError, setMustReadRefreshError] =
    useState('')
  const [mustReadStartIndex, setMustReadStartIndex] =
    useState(0)
  const forYouStartIndexRef = useRef(0)
  const forYouShownIdentityKeysRef = useRef(new Set())
  const trendingShownIdentityKeysRef = useRef(new Set())
  const trendingCandidatePoolRef = useRef([])
  const isTrendingPoolExhaustedRef = useRef(false)
  const mustReadShownIdentityKeysRef = useRef(new Set())

  useEffect(() => {
    if (!isEnabled || !userId || !personalizedSubject) return

    let isActive = true

    function loadDiscoverBooks() {
      const savedForYouState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.homeForYou(
          userId,
          forYouCacheSignature
        )
      )
      const savedTrendingState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.trending(userId)
      )
      const savedMustReadState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.mustReads(userId)
      )
      const shouldFetchForYou =
        shouldFetchHomeForYou(savedForYouState)
      const shouldFetchTrending =
        shouldRefillShelf(savedTrendingState)
      const shouldFetchMustReads =
        shouldRefillShelf(savedMustReadState)

      setIsDiscoverLoading(true)
      setDiscoverError('')
      setTrendingRefreshError('')
      setMustReadRefreshError('')
      forYouShownIdentityKeysRef.current = new Set(
        savedForYouState?.seenIdentityKeys || []
      )
      trendingShownIdentityKeysRef.current = new Set(
        savedTrendingState?.seenIdentityKeys || []
      )
      trendingCandidatePoolRef.current =
        savedTrendingState?.candidatePool || []
      isTrendingPoolExhaustedRef.current = Boolean(
        savedTrendingState?.isPoolExhausted
      )
      mustReadShownIdentityKeysRef.current = new Set(
        savedMustReadState?.seenIdentityKeys || []
      )

      if (savedForYouState) {
        addBooksToIdentitySet(
          forYouShownIdentityKeysRef.current,
          savedForYouState.books
        )
        forYouStartIndexRef.current = savedForYouState.startIndex
        setForYouBooks(savedForYouState.books)
      }

      if (savedTrendingState) {
        addBooksToIdentitySet(
          trendingShownIdentityKeysRef.current,
          savedTrendingState.books
        )
        trendingCandidatePoolRef.current =
          savedTrendingState.candidatePool || []
        isTrendingPoolExhaustedRef.current = Boolean(
          savedTrendingState.isPoolExhausted
        )
        setTrendingBooks(savedTrendingState.books)
      }

      if (savedMustReadState) {
        addBooksToIdentitySet(
          mustReadShownIdentityKeysRef.current,
          savedMustReadState.books
        )
        setMustReadBooks(savedMustReadState.books)
        setMustReadStartIndex(savedMustReadState.startIndex)
      }

      if (
        savedForYouState ||
        savedTrendingState ||
        savedMustReadState
      ) {
        setIsDiscoverLoading(false)
      }

      if (
        !shouldFetchForYou &&
        !shouldFetchTrending &&
        !shouldFetchMustReads
      ) {
        return
      }

      Promise.allSettled([
        shouldFetchForYou
          ? fetchRecommendationBatch({
              subject: personalizedSubject,
              startIndex: savedForYouState?.startIndex || 0,
              limit:
                HOME_SHELF_BOOK_LIMIT -
                (savedForYouState?.books.length || 0),
              shownIdentityKeys:
                forYouShownIdentityKeysRef.current,
              excludedBookIds,
              currentBooks: savedForYouState?.books || [],
              windowSize: HOME_GOOGLE_CANDIDATE_POOL_SIZE,
              maxAttempts: HOME_MAX_GOOGLE_WINDOW_ATTEMPTS,
              fallbackBooksLoader: getOpenLibraryBooksBySubject,
              maxFallbackAttempts: HOME_MAX_FALLBACK_WINDOW_ATTEMPTS,
            })
          : Promise.resolve({
              books: [],
              startIndex: savedForYouState.startIndex,
              seenIdentityKeys:
                forYouShownIdentityKeysRef.current,
              isPoolExhausted: savedForYouState.isPoolExhausted,
            }),
        shouldFetchTrending
          ? Promise.resolve(savedTrendingState?.candidatePool || [])
              .then((candidatePool) =>
                candidatePool.length
                  ? candidatePool
                  : getTrendingBooksDetails(
                      HOME_TRENDING_CANDIDATE_POOL_SIZE
                    )
              )
          : Promise.resolve(savedTrendingState.books),
        !shouldFetchMustReads && savedMustReadState
          ? Promise.resolve({
              books: savedMustReadState.books,
              startIndex: savedMustReadState.startIndex,
              seenIdentityKeys:
                mustReadShownIdentityKeysRef.current,
              isPoolExhausted:
                savedMustReadState.isPoolExhausted,
            })
          : fetchRecommendationBatch({
              subject: 'classics',
              startIndex: savedMustReadState?.startIndex || 0,
              limit:
                HOME_SHELF_BOOK_LIMIT -
                (savedMustReadState?.books.length || 0),
              shownIdentityKeys:
                mustReadShownIdentityKeysRef.current,
              excludedBookIds,
              currentBooks: savedMustReadState?.books || [],
              windowSize: HOME_GOOGLE_CANDIDATE_POOL_SIZE,
              maxAttempts: HOME_MAX_GOOGLE_WINDOW_ATTEMPTS,
              fallbackBooksLoader: getOpenLibraryBooksBySubject,
              maxFallbackAttempts: HOME_MAX_FALLBACK_WINDOW_ATTEMPTS,
            }),
      ]).then((results) => {

      if (!isActive) return

      const [
        forYouResult,
        trendingResult,
        mustReadsResult,
      ] = results

      // Peut-être pour toi
      if (forYouResult.status === 'fulfilled') {
        const selectedForYouBooks = [
          ...(savedForYouState?.books || []),
          ...forYouResult.value.books,
        ].slice(0, HOME_SHELF_BOOK_LIMIT)
        const nextForYouShownIdentityKeys =
          forYouResult.value.seenIdentityKeys ||
          forYouShownIdentityKeysRef.current

        addBooksToIdentitySet(
          nextForYouShownIdentityKeys,
          selectedForYouBooks
        )
        forYouShownIdentityKeysRef.current =
          nextForYouShownIdentityKeys
        forYouStartIndexRef.current =
          forYouResult.value.startIndex
        setForYouBooks(selectedForYouBooks)
        if (selectedForYouBooks.length) {
          writeRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.homeForYou(
              userId,
              forYouCacheSignature
            ),
            {
              books: selectedForYouBooks,
              startIndex: forYouStartIndexRef.current,
              seenIdentityKeys: forYouShownIdentityKeysRef.current,
              isPoolExhausted:
                forYouResult.value.isPoolExhausted,
            }
          )
        }
      } else {
        setForYouBooks(savedForYouState?.books || [])
      }

      // Tendances du moment
      if (!shouldFetchTrending && savedTrendingState) {
        setTrendingBooks(savedTrendingState.books)
      } else if (trendingResult.status === 'fulfilled') {
        trendingCandidatePoolRef.current = trendingResult.value
        isTrendingPoolExhaustedRef.current = false
        const savedTrendingBooks = savedTrendingState?.books || []
        const selectedTrendingBooks = selectRecommendationBooks(
          trendingCandidatePoolRef.current,
          {
            limit:
              HOME_SHELF_BOOK_LIMIT -
              savedTrendingBooks.length,
            alreadyShownIdentityKeys:
              trendingShownIdentityKeysRef.current,
            excludedBookIds,
            preferBooksWithCovers: true,
          }
        )
        const nextTrendingBooks = [
          ...savedTrendingBooks,
          ...selectedTrendingBooks,
        ].slice(0, HOME_SHELF_BOOK_LIMIT)
        isTrendingPoolExhaustedRef.current =
          nextTrendingBooks.length < HOME_SHELF_BOOK_LIMIT

        addBooksToIdentitySet(
          trendingShownIdentityKeysRef.current,
          nextTrendingBooks
        )
        setTrendingBooks(nextTrendingBooks)
        if (nextTrendingBooks.length) {
          writeTrendingState(userId, {
            books: nextTrendingBooks,
            candidatePool: trendingCandidatePoolRef.current,
            seenIdentityKeys: trendingShownIdentityKeysRef.current,
            isPoolExhausted: isTrendingPoolExhaustedRef.current,
          })
        }
      } else {
        setTrendingBooks(savedTrendingState?.books || [])
      }

      // Les incontournables
      if (!shouldFetchMustReads && savedMustReadState) {
        setMustReadBooks(savedMustReadState.books)
        setMustReadStartIndex(savedMustReadState.startIndex)
      } else if (mustReadsResult.status === 'fulfilled') {
        const selectedMustReadBooks = [
          ...(savedMustReadState?.books || []),
          ...mustReadsResult.value.books,
        ].slice(0, HOME_SHELF_BOOK_LIMIT)

        mustReadShownIdentityKeysRef.current =
          mustReadsResult.value.seenIdentityKeys ||
          mustReadShownIdentityKeysRef.current
        addBooksToIdentitySet(
          mustReadShownIdentityKeysRef.current,
          selectedMustReadBooks
        )
        setMustReadBooks(selectedMustReadBooks)
        setMustReadStartIndex(mustReadsResult.value.startIndex)
        if (selectedMustReadBooks.length) {
          writeRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.mustReads(userId),
            {
              books: selectedMustReadBooks,
              startIndex: mustReadsResult.value.startIndex,
              seenIdentityKeys:
                mustReadShownIdentityKeysRef.current,
              isPoolExhausted:
                mustReadsResult.value.isPoolExhausted ||
                selectedMustReadBooks.length < HOME_SHELF_BOOK_LIMIT,
            }
          )
        }
      } else {
        setMustReadBooks(savedMustReadState?.books || [])
      }

      const hasFailedRequest = results.some(
        (result) => result.status === 'rejected'
      )

      if (hasFailedRequest) {
        setDiscoverError(
          t('discoverPage.partialError')
        )
      }

      setIsDiscoverLoading(false)
      })
    }

    loadDiscoverBooks()

    return () => {
      isActive = false
    }
  }, [
    isEnabled,
    userId,
    personalizedSubject,
    forYouCacheSignature,
    excludedBookIds,
    t,
  ])

  async function refreshTrendingBooks() {
    if (isTrendingRefreshing) return

    setIsTrendingRefreshing(true)
    setTrendingRefreshError('')

    try {
      let candidatePool = trendingCandidatePoolRef.current
      let shownIdentityKeys = trendingShownIdentityKeysRef.current

      if (!candidatePool.length || isTrendingPoolExhaustedRef.current) {
        candidatePool = await getTrendingBooksDetails(
          HOME_TRENDING_CANDIDATE_POOL_SIZE
        )
        trendingCandidatePoolRef.current = candidatePool
        isTrendingPoolExhaustedRef.current = false

        shownIdentityKeys =
          createSeenIdentitySetFromBooks(trendingBooks)
        trendingShownIdentityKeysRef.current = shownIdentityKeys
      }

      const {
        books: selectedBooks,
        seenIdentityKeys: nextShownIdentityKeys,
        isPoolExhausted,
      } = selectTrendingRefreshBooks(candidatePool, {
        limit: HOME_SHELF_BOOK_LIMIT,
        shownIdentityKeys,
        excludedBookIds,
      })

      if (selectedBooks.length) {
        trendingShownIdentityKeysRef.current =
          nextShownIdentityKeys
        isTrendingPoolExhaustedRef.current = isPoolExhausted
        setTrendingBooks(selectedBooks)
        setTrendingRefreshError('')
        writeTrendingState(userId, {
          books: selectedBooks,
          candidatePool,
          seenIdentityKeys: nextShownIdentityKeys,
          isPoolExhausted,
        })
      } else {
        isTrendingPoolExhaustedRef.current = true
        setTrendingRefreshError(
          t('discoverPage.shelves.noNewTrending')
        )
        writeTrendingState(userId, {
          books: trendingBooks,
          candidatePool,
          seenIdentityKeys: shownIdentityKeys,
          isPoolExhausted: true,
        })
      }
    } catch {
      setTrendingRefreshError(
        t('discoverPage.shelves.trendingRefreshError')
      )
    } finally {
      setIsTrendingRefreshing(false)
    }
  }

  async function refreshMustReadBooks() {
    if (isMustReadRefreshing) return

    setIsMustReadRefreshing(true)
    setMustReadRefreshError('')

    try {
      const {
        books: selectedBooks,
        isPoolExhausted,
        seenIdentityKeys,
        startIndex,
      } = await fetchRecommendationBatch({
        subject: 'classics',
        startIndex: mustReadStartIndex,
        limit: HOME_SHELF_BOOK_LIMIT,
        shownIdentityKeys: mustReadShownIdentityKeysRef.current,
        excludedBookIds,
        currentBooks: mustReadBooks,
        windowSize: HOME_GOOGLE_CANDIDATE_POOL_SIZE,
        maxAttempts: HOME_MAX_GOOGLE_WINDOW_ATTEMPTS,
        fallbackBooksLoader: getOpenLibraryBooksBySubject,
        maxFallbackAttempts: HOME_MAX_FALLBACK_WINDOW_ATTEMPTS,
      })

      if (selectedBooks.length) {
        mustReadShownIdentityKeysRef.current = seenIdentityKeys
        addBooksToIdentitySet(
          mustReadShownIdentityKeysRef.current,
          selectedBooks
        )
        setMustReadBooks(selectedBooks)
        setMustReadStartIndex(startIndex)
        setMustReadRefreshError('')
        writeRecommendationState(
          RECOMMENDATION_STORAGE_KEYS.mustReads(userId),
          {
            books: selectedBooks,
            startIndex,
            seenIdentityKeys: mustReadShownIdentityKeysRef.current,
            isPoolExhausted,
          }
        )
      } else {
        setMustReadRefreshError(
          t('discoverPage.shelves.noNewMustRead')
        )
        mustReadShownIdentityKeysRef.current = seenIdentityKeys
        setMustReadStartIndex(startIndex)
        writeRecommendationState(
          RECOMMENDATION_STORAGE_KEYS.mustReads(userId),
          {
            books: mustReadBooks,
            startIndex,
            seenIdentityKeys: mustReadShownIdentityKeysRef.current,
            isPoolExhausted,
          }
        )
      }
    } catch {
      setMustReadRefreshError(
        t('discoverPage.shelves.mustReadRefreshError')
      )
    } finally {
      setIsMustReadRefreshing(false)
    }
  }

  return {
    forYouBooks,
    trendingBooks,
    mustReadBooks,
    isDiscoverLoading,
    discoverError,
    isTrendingRefreshing,
    trendingRefreshError,
    refreshTrendingBooks,
    isMustReadRefreshing,
    mustReadRefreshError,
    refreshMustReadBooks,
  }
}

export default useDiscoverHomeBooks
