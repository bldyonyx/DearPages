import { useEffect, useRef, useState } from 'react'
import { getBooksBySubject } from '../services/booksApi'
import { getTrendingBooksDetails } from '../services/trendingBooksApi'
import {
  addBooksToIdentitySet,
  selectRecommendationBooks,
} from '../utils/recommendationSelection'
import {
  readRecommendationState,
  RECOMMENDATION_STORAGE_KEYS,
  writeRecommendationState,
} from '../utils/recommendationSessionStorage'

const HOME_SHELF_BOOK_LIMIT = 5
const HOME_GOOGLE_CANDIDATE_POOL_SIZE = 40
const HOME_TRENDING_CANDIDATE_POOL_SIZE = 100
const EMPTY_EXCLUDED_BOOK_IDS = []

function createSeenIdentitySetFromBooks(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
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
 * @param {string} options.personalizedSubject - Subject Google Books pour l'aperçu personnalisé.
 * @param {string} options.forYouCacheSignature - Signature des genres pour le cache For You.
 * @param {Iterable<string|Object>} [excludedBookIds] - Identifiants a exclure plus tard depuis la bibliotheque.
 * @returns {Object} Livres et etats de chargement de la vue Decouvrir.
 */
function useDiscoverHomeBooks({
  isEnabled,
  personalizedSubject,
  forYouCacheSignature,
  excludedBookIds = EMPTY_EXCLUDED_BOOK_IDS
}) {
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

  function writeTrendingState({
    books = trendingBooks,
    candidatePool = trendingCandidatePoolRef.current,
    seenIdentityKeys = trendingShownIdentityKeysRef.current,
    isPoolExhausted = isTrendingPoolExhaustedRef.current,
  }) {
    writeRecommendationState(RECOMMENDATION_STORAGE_KEYS.trending, {
      books,
      seenIdentityKeys,
      candidatePool,
      isPoolExhausted,
    })
  }

  useEffect(() => {
    if (!isEnabled || !personalizedSubject) return

    let isActive = true

    function loadDiscoverBooks() {
      const savedForYouState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.homeForYou(
          forYouCacheSignature
        )
      )
      const savedTrendingState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.trending
      )
      const savedMustReadState = readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.mustReads
      )

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
        savedForYouState &&
        savedTrendingState &&
        savedMustReadState
      ) {
        return
      }

      Promise.allSettled([
        savedForYouState
          ? Promise.resolve(savedForYouState.books)
          : getBooksBySubject(
              personalizedSubject,
              HOME_GOOGLE_CANDIDATE_POOL_SIZE,
              0
            ),
        savedTrendingState
          ? Promise.resolve(savedTrendingState.books)
          : getTrendingBooksDetails(
              HOME_TRENDING_CANDIDATE_POOL_SIZE
            ),
        savedMustReadState
          ? Promise.resolve(savedMustReadState.books)
          : getBooksBySubject(
              'classics',
              HOME_GOOGLE_CANDIDATE_POOL_SIZE,
              0
            ),
      ]).then((results) => {

      if (!isActive) return

      const [
        forYouResult,
        trendingResult,
        mustReadsResult,
      ] = results

      // Peut-être pour toi
      if (savedForYouState) {
        forYouStartIndexRef.current = savedForYouState.startIndex
        setForYouBooks(savedForYouState.books)
      } else if (forYouResult.status === 'fulfilled') {
        const selectedForYouBooks = selectRecommendationBooks(
          forYouResult.value,
          {
            limit: HOME_SHELF_BOOK_LIMIT,
            alreadyShownIdentityKeys:
              forYouShownIdentityKeysRef.current,
            excludedBookIds,
            preferBooksWithCovers: true,
          }
        )

        addBooksToIdentitySet(
          forYouShownIdentityKeysRef.current,
          selectedForYouBooks
        )
        forYouStartIndexRef.current =
          HOME_GOOGLE_CANDIDATE_POOL_SIZE
        setForYouBooks(selectedForYouBooks)
        if (selectedForYouBooks.length) {
          writeRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.homeForYou(
              forYouCacheSignature
            ),
            {
              books: selectedForYouBooks,
              startIndex: forYouStartIndexRef.current,
              seenIdentityKeys: forYouShownIdentityKeysRef.current,
            }
          )
        }
      } else {
        setForYouBooks([])
      }

      // Tendances du moment
      if (savedTrendingState) {
        setTrendingBooks(savedTrendingState.books)
      } else if (trendingResult.status === 'fulfilled') {
        trendingCandidatePoolRef.current = trendingResult.value
        isTrendingPoolExhaustedRef.current = false
        const selectedTrendingBooks = selectRecommendationBooks(
          trendingCandidatePoolRef.current,
          {
            limit: HOME_SHELF_BOOK_LIMIT,
            alreadyShownIdentityKeys:
              trendingShownIdentityKeysRef.current,
            excludedBookIds,
            preferBooksWithCovers: true,
          }
        )

        addBooksToIdentitySet(
          trendingShownIdentityKeysRef.current,
          selectedTrendingBooks
        )
        setTrendingBooks(selectedTrendingBooks)
        if (selectedTrendingBooks.length) {
          writeTrendingState({ books: selectedTrendingBooks })
        }
      } else {
        setTrendingBooks([])
      }

      // Les incontournables
      if (savedMustReadState) {
        setMustReadBooks(savedMustReadState.books)
        setMustReadStartIndex(savedMustReadState.startIndex)
      } else if (mustReadsResult.status === 'fulfilled') {
        const selectedMustReadBooks = selectRecommendationBooks(
          mustReadsResult.value,
          {
            limit: HOME_SHELF_BOOK_LIMIT,
            alreadyShownIdentityKeys:
              mustReadShownIdentityKeysRef.current,
            excludedBookIds,
            preferBooksWithCovers: true,
          }
        )

        addBooksToIdentitySet(
          mustReadShownIdentityKeysRef.current,
          selectedMustReadBooks
        )
        setMustReadBooks(selectedMustReadBooks)
        setMustReadStartIndex(HOME_GOOGLE_CANDIDATE_POOL_SIZE)
        if (selectedMustReadBooks.length) {
          writeRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.mustReads,
            {
              books: selectedMustReadBooks,
              startIndex: HOME_GOOGLE_CANDIDATE_POOL_SIZE,
              seenIdentityKeys:
                mustReadShownIdentityKeysRef.current,
            }
          )
        }
      } else {
        setMustReadBooks([])
      }

      const hasFailedRequest = results.some(
        (result) => result.status === 'rejected'
      )

      if (hasFailedRequest) {
        setDiscoverError(
          'Certaines sélections sont temporairement indisponibles.'
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
    personalizedSubject,
    forYouCacheSignature,
    excludedBookIds,
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

      const selectedBooks = selectRecommendationBooks(candidatePool, {
        limit: HOME_SHELF_BOOK_LIMIT,
        alreadyShownIdentityKeys: shownIdentityKeys,
        excludedBookIds,
        preferBooksWithCovers: true,
      })

      if (selectedBooks.length) {
        addBooksToIdentitySet(shownIdentityKeys, selectedBooks)
        trendingShownIdentityKeysRef.current = shownIdentityKeys
        setTrendingBooks(selectedBooks)
        setTrendingRefreshError('')
        writeTrendingState({
          books: selectedBooks,
          candidatePool,
          seenIdentityKeys: shownIdentityKeys,
          isPoolExhausted: false,
        })
      } else {
        isTrendingPoolExhaustedRef.current = true
        setTrendingRefreshError(
          'Aucune nouvelle tendance disponible pour le moment.'
        )
        writeTrendingState({
          books: trendingBooks,
          candidatePool,
          seenIdentityKeys: shownIdentityKeys,
          isPoolExhausted: true,
        })
      }
    } catch {
      setTrendingRefreshError(
        'Impossible de rafraichir les tendances pour le moment.'
      )
    } finally {
      setIsTrendingRefreshing(false)
    }
  }

  async function refreshMustReadBooks() {
    if (isMustReadRefreshing) return

    const requestedStartIndex = mustReadStartIndex
    const nextStartIndex =
      requestedStartIndex + HOME_GOOGLE_CANDIDATE_POOL_SIZE

    setIsMustReadRefreshing(true)
    setMustReadRefreshError('')

    try {
      const books = await getBooksBySubject(
        'classics',
        HOME_GOOGLE_CANDIDATE_POOL_SIZE,
        requestedStartIndex
      )
      const selectedBooks = selectRecommendationBooks(books, {
        limit: HOME_SHELF_BOOK_LIMIT,
        alreadyShownIdentityKeys:
          mustReadShownIdentityKeysRef.current,
        excludedBookIds,
        preferBooksWithCovers: true,
      })
      const shouldAdvanceStartIndex = books.length > 0
      const shouldResetCycle = books.length === 0

      if (selectedBooks.length) {
        addBooksToIdentitySet(
          mustReadShownIdentityKeysRef.current,
          selectedBooks
        )
        setMustReadBooks(selectedBooks)
        setMustReadStartIndex(nextStartIndex)
        setMustReadRefreshError('')
        writeRecommendationState(
          RECOMMENDATION_STORAGE_KEYS.mustReads,
          {
            books: selectedBooks,
            startIndex: nextStartIndex,
            seenIdentityKeys: mustReadShownIdentityKeysRef.current,
          }
        )
      } else if (shouldResetCycle) {
        const resetSeenIdentityKeys =
          createSeenIdentitySetFromBooks(mustReadBooks)

        mustReadShownIdentityKeysRef.current =
          resetSeenIdentityKeys
        setMustReadStartIndex(0)
        setMustReadRefreshError(
          'Aucun nouvel incontournable disponible pour le moment.'
        )
        writeRecommendationState(
          RECOMMENDATION_STORAGE_KEYS.mustReads,
          {
            books: mustReadBooks,
            startIndex: 0,
            seenIdentityKeys: resetSeenIdentityKeys,
          }
        )
      } else {
        setMustReadRefreshError(
          'Aucun nouvel incontournable disponible pour le moment.'
        )
        if (shouldAdvanceStartIndex) {
          setMustReadStartIndex(nextStartIndex)
          writeRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.mustReads,
            {
              books: mustReadBooks,
              startIndex: nextStartIndex,
              seenIdentityKeys: mustReadShownIdentityKeysRef.current,
            }
          )
        }
      }
    } catch {
      setMustReadRefreshError(
        'Impossible de rafraichir les incontournables pour le moment.'
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
