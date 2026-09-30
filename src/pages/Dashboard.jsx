import { useMemo } from 'react'

import CurrentlyReading from '../components/dashboard/CurrentlyReading'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import ReadingCompanion from '../components/dashboard/ReadingCompanion'
import ReadingGoal from '../components/dashboard/ReadingGoal'
import RecentlyAdded from '../components/dashboard/RecentlyAdded'
import ReadingStats from '../components/dashboard/ReadingStats'
import { dashboardLarge } from '../components/dashboard/dashboardResponsive.js'
import { useAuth } from '../context/AuthContext.jsx'
import useDashboardLibrary from '../hooks/useDashboardLibrary.js'
import { BOOK_STATUSES } from '../services/libraryService.js'
import { getFavoriteGenreLabelFromLibrary } from '../utils/dashboardGenres.js'

const DEFAULT_ANNUAL_GOAL = 24
const RECENT_BOOK_LIMIT = 5

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

function Dashboard() {
  const { user, preferences } = useAuth()

  const {
    library,
    isLibraryLoading,
    libraryError,
    updatingBookId,
    handleDashboardStatusChange,
  } = useDashboardLibrary(user?.uid)

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

  return (
    <div className={`p-6 ${dashboardLarge.shell}`}>
      <DashboardHeader user={user} />

      {isLibraryLoading && (
        <p
          role="status"
          aria-live="polite"
          className="mt-8 font-ui text-sm text-walnut/65"
        >
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
          <div
            className={`
              mt-8 grid gap-6
              xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]
              ${dashboardLarge.firstSectionGap}
              ${dashboardLarge.gridGap}
            `}
          >
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
          <div className={`mt-6 ${dashboardLarge.sectionGap}`}>
            <RecentlyAdded books={recentBooks} />
          </div>

          {/* Statistiques + compagnon */}
          <div
            className={`
              mt-6
              flex flex-col gap-6
              min-[1380px]:flex-row
              min-[1380px]:items-center
              ${dashboardLarge.sectionGap}
              ${dashboardLarge.gridGap}
            `}
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
