import { useEffect, useRef, useState } from 'react'
import { getBooksBySubjectWindow } from '../services/booksApi'
import {
  addBooksToIdentitySet,
  selectRecommendationBooks,
} from '../utils/recommendationSelection'
import {
  readRecommendationState,
  RECOMMENDATION_STORAGE_KEYS,
  writeRecommendationState,
} from '../utils/recommendationSessionStorage'

const RECOMMENDATIONS_PER_GENRE = 5
const CANDIDATE_POOL_SIZE = 40
const MAX_REFRESH_WINDOW_ATTEMPTS = 4
const EMPTY_EXCLUDED_BOOK_IDS = []

function createInitialGenreState(preferences) {
  return preferences.reduce(
    (state, preference) => ({
      ...state,
      [preference.subject]: {
        books: [],
        error: '',
        isLoading: false,
        startIndex: 0,
      },
    }),
    {}
  )
}

function createSeenIdentitySetFromBooks(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
}

/**
 * Persists the current genre shelf after a refresh attempt that advanced the
 * Google Books cursor without finding displayable books.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} cacheSignature - Signature des preferences Discover.
 * @param {string} subject - Subject du genre concerne.
 * @param {Array<Object>} books - Livres actuellement affiches.
 * @param {number} startIndex - Prochain curseur Google Books a essayer.
 * @param {Set<string>} seenIdentityKeys - Identites deja vues pour ce genre.
 * @param {boolean} [isPoolExhausted=false] - Indique si Google n'a plus de fenetre exploitable.
 * @returns {void}
 */
function writeGenreState(
  userId,
  cacheSignature,
  subject,
  books,
  startIndex,
  seenIdentityKeys,
  isPoolExhausted = false
) {
  writeRecommendationState(
    RECOMMENDATION_STORAGE_KEYS.forYouGenre(
      userId,
      cacheSignature,
      subject
    ),
    {
      books,
      startIndex,
      seenIdentityKeys,
      isPoolExhausted,
    }
  )
}

function shouldFetchGenreRecommendations(savedState) {
  if (!savedState) return true

  return (
    savedState.books.length < RECOMMENDATIONS_PER_GENRE &&
    !savedState.isPoolExhausted
  )
}

async function fetchRecommendationBatch({
  subject,
  startIndex = 0,
  limit = RECOMMENDATIONS_PER_GENRE,
  shownIdentityKeys = new Set(),
  excludedBookIds,
  currentBooks = [],
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

  for (
    let attempt = 0;
    attempt < MAX_REFRESH_WINDOW_ATTEMPTS;
    attempt += 1
  ) {
    const {
      books,
      returnedCount,
      nextStartIndex: windowNextStartIndex,
    } = await getBooksBySubjectWindow(
      subject,
      CANDIDATE_POOL_SIZE,
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
    isPoolExhausted:
      didReachEnd && selectedBooks.length < limit,
    seenIdentityKeys: activeShownIdentityKeys,
    startIndex: nextStartIndex,
  }
}

/**
 * Charge les recommandations personnalisees de la vue etendue.
 *
 * Chaque genre conserve son propre `startIndex` afin qu'un rafraichissement
 * ne recharge que la section concernee.
 *
 * @param {boolean} isEnabled - Indique si la vue recommandations est active.
 * @param {string} userId - Firebase Authentication user ID.
 * @param {Array<{label: string, subject: string}>} preferences - Preferences Discover normalisees.
 * @param {string} cacheSignature - Signature des genres pour isoler le cache For You.
 * @param {Iterable<string|Object>} [excludedBookIds] - Identifiants a exclure plus tard depuis la bibliotheque.
 * @returns {Object} Preferences, livres par genre et action de rafraichissement.
 */
function useForYouRecommendations(
  isEnabled,
  userId,
  preferences,
  cacheSignature,
  excludedBookIds = EMPTY_EXCLUDED_BOOK_IDS
) {
  const [genreState, setGenreState] = useState(
    () => createInitialGenreState(preferences)
  )
  const shownIdentityKeysByGenreRef = useRef({})

  useEffect(() => {
    if (!isEnabled || !userId) return

    let isActive = true
    const savedStateBySubject =
      preferences.reduce(
        (state, { subject }) => ({
          ...state,
          [subject]: readRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.forYouGenre(
              userId,
              cacheSignature,
              subject
            )
          ),
        }),
        {}
      )
    const preferencesToFetch =
      preferences.filter(
        ({ subject }) =>
          shouldFetchGenreRecommendations(
            savedStateBySubject[subject]
          )
      )

    shownIdentityKeysByGenreRef.current =
      preferences.reduce(
        (state, { subject }) => ({
          ...state,
          [subject]: new Set(
            savedStateBySubject[subject]?.seenIdentityKeys || []
          ),
        }),
        {}
      )

    preferences.forEach(({ subject }) => {
      const savedState = savedStateBySubject[subject]

      if (!savedState) return

      addBooksToIdentitySet(
        shownIdentityKeysByGenreRef.current[subject],
        savedState.books
      )
    })

    async function loadInitialRecommendations() {
      setGenreState(() => {
        const nextState = createInitialGenreState(preferences)

        preferences.forEach(
          ({ subject }) => {
            const savedState = savedStateBySubject[subject]

            nextState[subject] = {
              ...nextState[subject],
              books: savedState
                ? savedState.books
                : nextState[subject].books,
              error: '',
              isLoading:
                shouldFetchGenreRecommendations(savedState),
              startIndex: savedState
                ? savedState.startIndex
                : nextState[subject].startIndex,
            }
          }
        )

        return nextState
      })

      if (!preferencesToFetch.length) return

      const results = await Promise.allSettled(
        preferencesToFetch.map(
          ({ subject }) => {
            const savedState = savedStateBySubject[subject]
            const shownIdentityKeys =
              shownIdentityKeysByGenreRef.current[subject] ||
              new Set()
            const remainingBookCount =
              RECOMMENDATIONS_PER_GENRE -
              (savedState?.books.length || 0)

            return fetchRecommendationBatch({
              subject,
              startIndex: savedState?.startIndex || 0,
              limit: remainingBookCount,
              shownIdentityKeys,
              excludedBookIds,
              currentBooks: savedState?.books || [],
            })
          }
        )
      )

      if (!isActive) return

      setGenreState((currentState) => {
        const nextState = { ...currentState }

        results.forEach((result, index) => {
          const { subject } = preferencesToFetch[index]
          const savedState = savedStateBySubject[subject]
          const shownIdentityKeys =
            shownIdentityKeysByGenreRef.current[subject] ||
            new Set()
          const fetchedBooks =
            result.status === 'fulfilled'
              ? result.value.books
              : []
          const books = [
            ...(savedState?.books || []),
            ...fetchedBooks,
          ].slice(0, RECOMMENDATIONS_PER_GENRE)
          const nextShownIdentityKeys =
            result.status === 'fulfilled'
              ? result.value.seenIdentityKeys
              : shownIdentityKeys

          addBooksToIdentitySet(nextShownIdentityKeys, books)
          shownIdentityKeysByGenreRef.current[subject] =
            nextShownIdentityKeys

          if (result.status === 'fulfilled' && books.length) {
            writeRecommendationState(
              RECOMMENDATION_STORAGE_KEYS.forYouGenre(
                userId,
                cacheSignature,
                subject
              ),
              {
                books,
                startIndex: result.value.startIndex,
                seenIdentityKeys:
                  shownIdentityKeysByGenreRef.current[subject],
                isPoolExhausted: result.value.isPoolExhausted,
              }
            )
          }

          nextState[subject] = {
            books,
            error:
              result.status === 'rejected'
                ? 'Cette selection est temporairement indisponible.'
                : '',
            isLoading: false,
            startIndex:
              result.status === 'fulfilled'
                ? result.value.startIndex
                : savedState?.startIndex || 0,
          }
        })

        return nextState
      })
    }

    loadInitialRecommendations()

    return () => {
      isActive = false
    }
  }, [
    isEnabled,
    userId,
    preferences,
    cacheSignature,
    excludedBookIds,
  ])

  async function refreshGenre(subject) {
    const currentGenre = genreState[subject]

    if (!currentGenre || currentGenre.isLoading) return

    setGenreState((currentState) => ({
      ...currentState,
      [subject]: {
        ...currentState[subject],
        error: '',
        isLoading: true,
      },
    }))

    try {
      let shownIdentityKeys =
        shownIdentityKeysByGenreRef.current[subject] ||
        new Set()
      const {
        books: selectedBooks,
        didResetCycle,
        isPoolExhausted,
        seenIdentityKeys,
        startIndex,
      } = await fetchRecommendationBatch({
        subject,
        startIndex: currentGenre.startIndex,
        shownIdentityKeys,
        excludedBookIds,
        currentBooks: currentGenre.books,
      })

      shownIdentityKeys = seenIdentityKeys

      if (selectedBooks.length) {
        addBooksToIdentitySet(shownIdentityKeys, selectedBooks)
        shownIdentityKeysByGenreRef.current[subject] =
          shownIdentityKeys

        setGenreState((currentState) => ({
          ...currentState,
          [subject]: {
            books: selectedBooks,
            error: '',
            isLoading: false,
            startIndex,
          }
        }))
        writeGenreState(
          userId,
          cacheSignature,
          subject,
          selectedBooks,
          startIndex,
          shownIdentityKeys,
          isPoolExhausted
        )
        return
      }

      setGenreState((currentState) => ({
        ...currentState,
        [subject]: {
          ...currentState[subject],
          error: didResetCycle
            ? 'Nouveau cycle prepare pour ce genre.'
            : 'Aucune nouvelle suggestion disponible pour ce genre.',
          isLoading: false,
          startIndex,
        },
      }))
      writeGenreState(
        userId,
        cacheSignature,
        subject,
        currentGenre.books,
        startIndex,
        shownIdentityKeys,
        isPoolExhausted
      )
    } catch {
      setGenreState((currentState) => ({
        ...currentState,
        [subject]: {
          ...currentState[subject],
          error: 'Impossible de rafraichir ce genre pour le moment.',
          isLoading: false,
        },
      }))
    }
  }

  return {
    preferences,
    genreState,
    refreshGenre,
  }
}

export default useForYouRecommendations
