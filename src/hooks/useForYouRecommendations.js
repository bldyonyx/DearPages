import { useEffect, useRef, useState } from 'react'
import { getBooksBySubject } from '../services/booksApi'
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
 * @param {string} cacheSignature - Signature des preferences Discover.
 * @param {string} subject - Subject du genre concerne.
 * @param {Array<Object>} books - Livres actuellement affiches.
 * @param {number} startIndex - Prochain curseur Google Books a essayer.
 * @param {Set<string>} seenIdentityKeys - Identites deja vues pour ce genre.
 * @returns {void}
 */
function writeGenreState(
  cacheSignature,
  subject,
  books,
  startIndex,
  seenIdentityKeys
) {
  writeRecommendationState(
    RECOMMENDATION_STORAGE_KEYS.forYouGenre(
      cacheSignature,
      subject
    ),
    {
      books,
      startIndex,
      seenIdentityKeys,
    }
  )
}

/**
 * Charge les recommandations personnalisees de la vue etendue.
 *
 * Chaque genre conserve son propre `startIndex` afin qu'un rafraichissement
 * ne recharge que la section concernee.
 *
 * @param {boolean} isEnabled - Indique si la vue recommandations est active.
 * @param {Array<{label: string, subject: string}>} preferences - Preferences Discover normalisees.
 * @param {string} cacheSignature - Signature des genres pour isoler le cache For You.
 * @param {Iterable<string|Object>} [excludedBookIds] - Identifiants a exclure plus tard depuis la bibliotheque.
 * @returns {Object} Preferences, livres par genre et action de rafraichissement.
 */
function useForYouRecommendations(
  isEnabled,
  preferences,
  cacheSignature,
  excludedBookIds = EMPTY_EXCLUDED_BOOK_IDS
) {
  const [genreState, setGenreState] = useState(
    () => createInitialGenreState(preferences)
  )
  const shownIdentityKeysByGenreRef = useRef({})

  useEffect(() => {
    if (!isEnabled) return

    let isActive = true
    const savedStateBySubject =
      preferences.reduce(
        (state, { subject }) => ({
          ...state,
          [subject]: readRecommendationState(
            RECOMMENDATION_STORAGE_KEYS.forYouGenre(
              cacheSignature,
              subject
            )
          ),
        }),
        {}
      )
    const preferencesToFetch =
      preferences.filter(
        ({ subject }) => !savedStateBySubject[subject]
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
              isLoading: !savedState,
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
          ({ subject }) =>
            getBooksBySubject(
              subject,
              CANDIDATE_POOL_SIZE,
              0
            )
        )
      )

      if (!isActive) return

      setGenreState((currentState) => {
        const nextState = { ...currentState }

        results.forEach((result, index) => {
          const { subject } = preferencesToFetch[index]
          const shownIdentityKeys =
            shownIdentityKeysByGenreRef.current[subject] ||
            new Set()
          const books =
            result.status === 'fulfilled'
              ? selectRecommendationBooks(result.value, {
                  limit: RECOMMENDATIONS_PER_GENRE,
                  alreadyShownIdentityKeys: shownIdentityKeys,
                  excludedBookIds,
                  preferBooksWithCovers: true,
                })
              : []

          addBooksToIdentitySet(shownIdentityKeys, books)
          shownIdentityKeysByGenreRef.current[subject] =
            shownIdentityKeys

          if (result.status === 'fulfilled' && books.length) {
            writeRecommendationState(
              RECOMMENDATION_STORAGE_KEYS.forYouGenre(
                cacheSignature,
                subject
              ),
              {
                books,
                startIndex: result.value.length,
                seenIdentityKeys: shownIdentityKeys,
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
              result.status === 'fulfilled' &&
              result.value.length > 0
                ? result.value.length
                : 0,
          }
        })

        return nextState
      })
    }

    loadInitialRecommendations()

    return () => {
      isActive = false
    }
  }, [isEnabled, preferences, cacheSignature, excludedBookIds])

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
      let requestedStartIndex = currentGenre.startIndex
      let nextStartIndex = requestedStartIndex
      let selectedBooks = []
      let books = []
      let didResetCycle = false
      let shownIdentityKeys =
        shownIdentityKeysByGenreRef.current[subject] ||
        new Set()

      for (
        let attempt = 0;
        attempt < MAX_REFRESH_WINDOW_ATTEMPTS;
        attempt += 1
      ) {
        books = await getBooksBySubject(
          subject,
          CANDIDATE_POOL_SIZE,
          requestedStartIndex
        )

        if (books.length === 0) {
          didResetCycle = true
          shownIdentityKeys =
            createSeenIdentitySetFromBooks(currentGenre.books)
          shownIdentityKeysByGenreRef.current[subject] =
            shownIdentityKeys
          requestedStartIndex = 0
          nextStartIndex = 0
          continue
        }

        nextStartIndex = requestedStartIndex + books.length
        selectedBooks = selectRecommendationBooks(books, {
          limit: RECOMMENDATIONS_PER_GENRE,
          alreadyShownIdentityKeys: shownIdentityKeys,
          excludedBookIds,
          preferBooksWithCovers: true,
        })

        if (selectedBooks.length) {
          break
        }

        requestedStartIndex = nextStartIndex
      }

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
            startIndex: nextStartIndex,
          }
        }))
        writeGenreState(
          cacheSignature,
          subject,
          selectedBooks,
          nextStartIndex,
          shownIdentityKeys
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
          startIndex: nextStartIndex,
        },
      }))
      writeGenreState(
        cacheSignature,
        subject,
        currentGenre.books,
        nextStartIndex,
        shownIdentityKeys
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
