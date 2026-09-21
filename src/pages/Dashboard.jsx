import { useEffect, useMemo, useState } from 'react'

import CurrentlyReading from '../components/dashboard/CurrentlyReading'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import ReadingCompanion from '../components/dashboard/ReadingCompanion'
import ReadingGoal from '../components/dashboard/ReadingGoal'
import RecentlyAdded from '../components/dashboard/RecentlyAdded'
import ReadingStats from '../components/dashboard/ReadingStats'
import { AVAILABLE_GENRES } from '../constants/genres.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  BOOK_STATUSES,
  getUserLibrary,
  updateBookStatus,
} from '../services/libraryService.js'

const DEFAULT_ANNUAL_GOAL = 24
const RECENT_BOOK_LIMIT = 5

const GENERIC_CATEGORY_KEYS = new Set([
  'fiction',
  'general',
  'non fiction',
  'nonfiction',
])

const CATEGORY_SUBJECT_ALIASES = {
  autobiography: 'biography',
  biographies: 'biography',
  biography: 'biography',
  classics: 'classics',
  comics: 'comics',
  'comics graphic novels': 'comics',
  crime: 'crime',
  fantasy: 'fantasy',
  'graphic novels': 'comics',
  history: 'history',
  horror: 'horror',
  memoir: 'biography',
  memoirs: 'biography',
  mystery: 'mystery',
  'mystery detective': 'mystery',
  philosophy: 'philosophy',
  poetry: 'poetry',
  romance: 'romance',
  'science fiction': 'science fiction',
  'self help': 'self help',
  'self-help': 'self help',
  thriller: 'thriller',
  'young adult': 'young adult',
}

const GENRE_LABELS_BY_SUBJECT = AVAILABLE_GENRES.reduce(
  (labels, genre) => ({
    ...labels,
    [genre.subject]: genre.label,
  }),
  {}
)

function isValidAnnualGoal(value) {
  return Number.isInteger(value) && value > 0
}

function isFinishedThisYear(book) {
  if (
    book.status !== BOOK_STATUSES.FINISHED ||
    !book.finishedAt
  ) {
    return false
  }

  return (
    new Date(book.finishedAt).getFullYear() ===
    new Date().getFullYear()
  )
}

function normalizeCategoryKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function formatCategoryLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getDisplayGenreForCategory(category) {
  const key = normalizeCategoryKey(category)
  const subject = CATEGORY_SUBJECT_ALIASES[key]

  return {
    key: subject || key,
    label: subject
      ? GENRE_LABELS_BY_SUBJECT[subject]
      : formatCategoryLabel(category),
  }
}

/**
 * Computes the most represented library genre from stored Google Books
 * categories. Abandoned books are ignored.
 *
 * @param {Object[]} library Books already loaded for the dashboard.
 * @returns {string} User-facing genre label, or "Non défini".
 */
function getFavoriteGenreLabelFromLibrary(library) {
  const genreCounts = new Map()
  const firstSeenByGenre = new Map()
  let genreOrder = 0

  library
    .filter((book) => book.status !== BOOK_STATUSES.ABANDONED)
    .forEach((book) => {
      const categoryParts = (book.categories || [])
        .flatMap((category) => String(category).split('/'))
        .map((category) => category.trim())
        .filter(Boolean)

      const usefulParts = categoryParts.filter(
        (category) =>
          !GENERIC_CATEGORY_KEYS.has(
            normalizeCategoryKey(category)
          )
      )

      const categoriesToCount = usefulParts.length
        ? usefulParts
        : categoryParts.filter(
            (category) =>
              !GENERIC_CATEGORY_KEYS.has(
                normalizeCategoryKey(category)
              )
          )

      const bookGenres = new Map()

      categoriesToCount.forEach((category) => {
        const genre = getDisplayGenreForCategory(category)

        if (!genre.key) return

        bookGenres.set(genre.key, genre.label)
      })

      bookGenres.forEach((label, key) => {
        if (!firstSeenByGenre.has(key)) {
          firstSeenByGenre.set(key, genreOrder)
          genreOrder += 1
        }

        genreCounts.set(key, {
          label,
          count: (genreCounts.get(key)?.count || 0) + 1,
        })
      })
    })

  let favoriteGenre = null

  genreCounts.forEach((genre, key) => {
    if (
      !favoriteGenre ||
      genre.count > favoriteGenre.count ||
      (genre.count === favoriteGenre.count &&
        firstSeenByGenre.get(key) < favoriteGenre.firstSeen)
    ) {
      favoriteGenre = {
        ...genre,
        firstSeen: firstSeenByGenre.get(key),
      }
    }
  })

  return favoriteGenre?.label || 'Non défini'
}

function Dashboard() {
  const { user, preferences } = useAuth()

  const [library, setLibrary] = useState([])
  const [isLibraryLoading, setIsLibraryLoading] =
    useState(true)
  const [libraryError, setLibraryError] = useState('')
  const [updatingBookId, setUpdatingBookId] = useState(null)

  useEffect(() => {
    if (!user?.uid) return

    let isActive = true

    async function loadDashboardLibrary() {
      setIsLibraryLoading(true)
      setLibraryError('')

      try {
        const libraryBooks = await getUserLibrary(user.uid)

        if (isActive) {
          setLibrary(libraryBooks)
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (isActive) {
          setLibraryError(
            'Impossible de charger ton dashboard pour le moment.'
          )
        }
      } finally {
        if (isActive) {
          setIsLibraryLoading(false)
        }
      }
    }

    loadDashboardLibrary()

    return () => {
      isActive = false
    }
  }, [user?.uid])

  const readingBooks = useMemo(
    () =>
      library.filter(
        (book) => book.status === BOOK_STATUSES.READING
      ),
    [library]
  )

  const recentBooks = library.slice(0, RECENT_BOOK_LIMIT)

  const completedThisYear =
    library.filter(isFinishedThisYear).length

  const annualGoal = isValidAnnualGoal(preferences?.annualGoal)
    ? preferences.annualGoal
    : DEFAULT_ANNUAL_GOAL

  const favoriteGenreLabel = useMemo(
    () => getFavoriteGenreLabelFromLibrary(library),
    [library]
  )

  async function handleDashboardStatusChange(bookId, status) {
    if (!user?.uid || !bookId || !status) return

    setUpdatingBookId(bookId)

    try {
      const updatedBook = await updateBookStatus(
        user.uid,
        bookId,
        status
      )

      if (!updatedBook) return

      setLibrary((currentLibrary) =>
        currentLibrary.map((book) => {
          if (book.googleBooksId !== bookId) {
            return book
          }

          return {
            ...book,
            ...updatedBook,
          }
        })
      )
    } catch (firebaseError) {
      console.error(firebaseError)
      throw firebaseError
    } finally {
      setUpdatingBookId(null)
    }
  }

  return (
    <div className="p-6">
      <DashboardHeader user={user} />

      {isLibraryLoading && (
        <p className="mt-8 font-ui text-sm text-walnut/65">
          Chargement de ton dashboard...
        </p>
      )}

      {!isLibraryLoading && libraryError && (
        <div
          className="
            mt-8 rounded-3xl
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
            font-ui text-sm
            text-darkwood
          "
        >
          {libraryError}
        </div>
      )}

      {!isLibraryLoading && !libraryError && (
        <>
          {/* Lecture en cours + objectif */}
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <CurrentlyReading
              books={readingBooks}
              updatingBookId={updatingBookId}
              onStatusChange={handleDashboardStatusChange}
            />

            <ReadingGoal
              completedBooks={completedThisYear}
              goal={annualGoal}
            />
          </div>

          {/* Livres récemment ajoutés */}
          <div className="mt-6">
            <RecentlyAdded books={recentBooks} />
          </div>

          {/* Statistiques + compagnon */}
          <div
            className="
              mt-6
              flex flex-col gap-6
              min-[1380px]:flex-row
              min-[1380px]:items-center
            "
          >
            <div className="min-w-0 flex-1">
              <ReadingStats
                totalBooks={library.length}
                currentlyReading={readingBooks.length}
                favoriteGenre={favoriteGenreLabel}
              />
            </div>

            <ReadingCompanion />
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard