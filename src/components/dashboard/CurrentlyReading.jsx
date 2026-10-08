
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { BOOK_STATUSES } from '../../services/libraryService'
import BookCover from '../books/BookCover'
import StatusBadge from '../ui/StatusBadge'
import { dashboardLarge } from './dashboardResponsive.js'

const statusOptions = [
  { value: BOOK_STATUSES.TO_READ, labelKey: 'status.to-read' },
  { value: BOOK_STATUSES.READING, labelKey: 'status.reading' },
  { value: BOOK_STATUSES.FINISHED, labelKey: 'status.finished' },
  { value: BOOK_STATUSES.ABANDONED, labelKey: 'status.abandoned' },
]

const AUTO_ROTATION_INTERVAL_MS = 5000
const MAX_VISIBLE_COVERS = 3

function getVisibleCurrentReads(books, activeIndex) {
  const visibleCount = Math.min(
    MAX_VISIBLE_COVERS,
    books.length
  )

  return Array.from({ length: visibleCount }, (_, stackIndex) => {
    const bookIndex = (activeIndex + stackIndex) % books.length

    return {
      book: books[bookIndex],
      bookIndex,
      stackIndex,
    }
  })
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(() => {
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
      ) {
        return false
      }

      return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    })

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined
    }

    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    function handleChange(event) {
      setPrefersReducedMotion(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)

      return () => {
        mediaQuery.removeEventListener(
          'change',
          handleChange
        )
      }
    }

    mediaQuery.addListener(handleChange)

    return () => {
      mediaQuery.removeListener(handleChange)
    }
  }, [])

  return prefersReducedMotion
}

function DashboardCover({
  book,
  isSelected,
  prefersReducedMotion,
}) {
  return (
    <BookCover
      title={book.title}
      cover={book.cover}
      isbn={book.isbn}
      source={book.source}
      fallback="title"
      className={`
        aspect-2/3 w-32 overflow-hidden rounded-xl bg-parchment shadow-md
        transition-[transform,box-shadow,opacity] ease-out
        md:w-36 lg:w-40
        [@media_(min-width:2200px)_and_(min-height:1100px)]:w-48
        [@media_(min-width:2400px)_and_(min-height:1300px)]:w-56
        ${prefersReducedMotion ? 'duration-0' : 'duration-500'}
        ${isSelected ? 'scale-105 shadow-lg' : ''}
      `}
      imageClassName="h-full w-full object-cover"
    />
  )
}

function CurrentlyReading({
  books,
  updatingBookId,
  onStatusChange,
}) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusError, setStatusError] = useState('')
  const prefersReducedMotion = usePrefersReducedMotion()

  const boundedActiveIndex =
    books.length > 0 ? activeIndex % books.length : 0

  const currentBook = books[boundedActiveIndex] || books[0]

  const visibleBooks = useMemo(
    () => getVisibleCurrentReads(books, boundedActiveIndex),
    [boundedActiveIndex, books]
  )

  const navigateToIndex = useCallback(
    (nextIndex) => {
      if (books.length === 0) return

      setActiveIndex(
        ((nextIndex % books.length) + books.length) %
          books.length
      )
      setIsStatusOpen(false)
      setStatusError('')
    },
    [books.length]
  )

  const navigateBy = useCallback(
    (step) => {
      navigateToIndex(boundedActiveIndex + step)
    },
    [boundedActiveIndex, navigateToIndex]
  )

  useEffect(() => {
    if (books.length <= 1 || prefersReducedMotion) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setActiveIndex(
        (currentIndex) =>
          (currentIndex + 1) % books.length
      )
      setIsStatusOpen(false)
      setStatusError('')
    }, AUTO_ROTATION_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [
    boundedActiveIndex,
    books.length,
    prefersReducedMotion,
  ])

  async function handleStatusChange(newStatus) {
    if (!currentBook || updatingBookId) return

    if (newStatus === currentBook.status) {
      setIsStatusOpen(false)
      return
    }

    setStatusError('')

    try {
      await onStatusChange(
        currentBook.googleBooksId,
        newStatus
      )

      setIsStatusOpen(false)
    } catch {
      setStatusError(
        t('dashboard.currentlyReading.statusError')
      )
    }
  }

  if (books.length === 0) {
    return (
      <section
        className={`
          flex h-full min-h-96 flex-col
          rounded-3xl
          border border-darkwood/10
          bg-cream/80
          p-5
          md:p-6
          [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-112
          [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-120
          ${dashboardLarge.card}
        `}
      >
        <div>
          <h2
            className={`
              font-heading text-2xl font-bold text-darkwood
              ${dashboardLarge.title}
            `}
          >
            {t('dashboard.currentlyReading.title')}
          </h2>

          <p
            className={`
              mt-1 font-ui text-sm text-darkwood/60
              ${dashboardLarge.description}
            `}
          >
            {t('dashboard.currentlyReading.emptySubtitle')}
          </p>
        </div>

        <div
          className="
            flex flex-1
            flex-col
            items-center
            justify-center
            px-4 py-8
            text-center
          "
        >
          <div
            className="
              flex h-14 w-14
              items-center justify-center
              rounded-full
              bg-mintcream/70
              text-olive
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-16
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-16
            "
          >
            <BookOpen
              aria-hidden="true"
              strokeWidth={1.5}
              className="
                h-6 w-6
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-7
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-7
              "
            />
          </div>

          <p
            className="
              mt-4 max-w-sm
              font-ui text-sm
              leading-relaxed
              text-darkwood/55
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-5
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
            "
          >
            {t('dashboard.currentlyReading.emptyMessage')}
          </p>

          <Link
            to="/discover"
            className="
              mt-5 inline-flex
              items-center justify-center
              rounded-full
              border border-olive/15
              bg-lime
              px-5 py-2.5
              font-ui text-xs
              font-bold text-darkwood
              shadow-[0_3px_10px_rgba(83,55,76,0.05)]
              transition-[transform,filter] duration-200 ease-out
              hover:-translate-y-0.5
              hover:brightness-95
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-olive/30
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
            "
          >
            {t('dashboard.currentlyReading.findNext')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10 bg-cream/80 p-5
        md:p-6
        [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-96
        [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-120
        ${dashboardLarge.card}
      `}
    >
      <div>
        <h2
          className={`
            font-heading text-2xl font-bold text-darkwood
            ${dashboardLarge.title}
          `}
        >
          {t('dashboard.currentlyReading.title')}
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          {t('dashboard.currentlyReading.subtitle')}
        </p>
      </div>

      <div
        className={`
          mt-6 grid items-center gap-8
          sm:grid-cols-2
          ${dashboardLarge.stackGap}
          ${dashboardLarge.cardInnerGap}
          [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
          [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-10
          [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
          [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-12
        `}
      >
        {/* Stack de couvertures */}
        <div
          className="
            flex items-center justify-center px-4 pt-3
            sm:pt-2
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:pt-4
            [@media_(min-width:2400px)_and_(min-height:1300px)]:px-8
          "
        >
          {visibleBooks.map(
            ({
              book,
              bookIndex,
              stackIndex,
            }) => {
              const isSelected = stackIndex === 0
              const zIndex =
                MAX_VISIBLE_COVERS - stackIndex

              return (
                <button
                  key={book.googleBooksId}
                  type="button"
                  onClick={() =>
                    navigateToIndex(bookIndex)
                  }
                  className={`
                    relative cursor-pointer
                    transition-transform ease-out
                    ${
                      prefersReducedMotion
                        ? 'duration-0'
                        : 'duration-500'
                    }
                    ${
                      stackIndex === 0
                        ? ''
                        : '-ml-20 lg:-ml-24 [@media_(min-width:2200px)_and_(min-height:1100px)]:-ml-24 [@media_(min-width:2400px)_and_(min-height:1300px)]:-ml-28'
                    }
                    ${
                      isSelected
                        ? '-translate-y-3'
                        : 'hover:-translate-y-1'
                    }
                  `}
                  style={{
                    zIndex,
                    transform: `translateY(${
                      isSelected ? '-0.75rem' : '0'
                    }) rotate(${
                      stackIndex === 0
                        ? 0
                        : stackIndex === 1
                          ? -1.5
                          : 1.5
                    }deg)`,
                  }}
                  aria-label={t(
                    'dashboard.currentlyReading.showBook',
                    { title: book.title }
                  )}
                  data-testid="current-reading-cover"
                  data-active={
                    isSelected ? 'true' : 'false'
                  }
                  data-book-id={book.googleBooksId}
                  data-stack-position={stackIndex}
                >
                  <DashboardCover
                    book={book}
                    isSelected={isSelected}
                    prefersReducedMotion={
                      prefersReducedMotion
                    }
                  />
                </button>
              )
            }
          )}
        </div>

        {/* Informations du livre sélectionné */}
        <div
          className="
            flex min-w-0 flex-col justify-center
            sm:min-h-52
            [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-60
            [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-72
          "
        >
          <div>
            <StatusBadge
              status={currentBook.status}
              className="
                [@media_(min-width:2200px)_and_(min-height:1100px)]:px-4
                [@media_(min-width:2200px)_and_(min-height:1100px)]:py-1.5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              "
            />
          </div>

          {/* Titre et auteur centrés dans une hauteur stable */}
          <div
            className="
              mt-3
              flex flex-col justify-center
              min-h-[calc(3*1.25*1.5rem+2.5rem)]
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-4
              [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-[calc(3*1.25*1.875rem+3rem)]
              [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-[calc(3*1.25*2.25rem+3.5rem)]
            "
          >
            <h3
              className="
                line-clamp-3
                wrap-break-word
                font-heading text-2xl
                font-bold leading-tight
                text-darkwood
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-3xl
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-4xl
              "
            >
              {currentBook.title}
            </h3>

            <p
              className="
                mt-2 line-clamp-2
                wrap-break-word
                font-ui text-sm
                text-darkwood/60
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
              "
            >
              {currentBook.authors?.join(', ') ||
                t('dashboard.currentlyReading.unknownAuthor')}
            </p>
          </div>

          <div
            className="
              mt-5 flex min-h-9 flex-wrap
              items-start gap-2
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-10
              [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-3
              [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-8
              [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-12
            "
          >
            <Link
              to={`/books/${currentBook.googleBooksId}`}
              state={{
                book: currentBook,
                libraryBook: currentBook,
              }}
              className="
                rounded-full
                bg-darkwood
                px-4 py-2
                font-ui text-xs
                font-bold text-cream
                transition-transform
                hover:-translate-y-0.5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:py-2.5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:px-6
                [@media_(min-width:2400px)_and_(min-height:1300px)]:py-3
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              "
            >
              {t('dashboard.currentlyReading.viewDetails')}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setIsStatusOpen(
                    (current) => !current
                  )
                }
                disabled={
                  updatingBookId ===
                  currentBook.googleBooksId
                }
                className="
                  cursor-pointer
                  rounded-full
                  border border-darkwood/20
                  px-4 py-2
                  font-ui text-xs
                  font-bold text-darkwood
                  transition-transform
                  hover:-translate-y-0.5
                  disabled:cursor-wait
                  disabled:opacity-60
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:py-2.5
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:px-6
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:py-3
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
                "
              >
                {updatingBookId ===
                currentBook.googleBooksId
                  ? t('dashboard.currentlyReading.updating')
                  : t('common.changeStatus')}
              </button>

              {isStatusOpen && (
                <div className="dp-menu-enter absolute left-0 top-full z-20 mt-2 min-w-40 overflow-hidden rounded-2xl border border-darkwood/10 bg-cream p-2 shadow-lg [@media_(min-width:2200px)_and_(min-height:1100px)]:min-w-48">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          status.value
                        )
                      }
                      disabled={
                        updatingBookId ===
                        currentBook.googleBooksId
                      }
                      className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left font-ui text-xs text-darkwood transition-colors hover:bg-darkwood/10 disabled:cursor-wait disabled:opacity-60 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm"
                    >
                      {t(status.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {statusError && (
            <p
              role="alert"
              className="mt-3 font-ui text-sm text-red-700 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base"
            >
              {statusError}
            </p>
          )}

          {/* Navigation entre les lectures */}
          {books.length > 1 && (
            <div className="mt-6 inline-flex flex-col items-center gap-2.5 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <div className="flex gap-2">
                  {books.map((book, bookIndex) => (
                    <button
                      key={book.googleBooksId}
                      type="button"
                      onClick={() =>
                        navigateToIndex(bookIndex)
                      }
                      className={`
                        h-2.5 w-2.5
                        cursor-pointer
                        rounded-full
                        transition-[transform,background-color] duration-300 ease-out
                        [@media_(min-width:2200px)_and_(min-height:1100px)]:h-3
                        [@media_(min-width:2200px)_and_(min-height:1100px)]:w-3
                        ${
                          bookIndex === boundedActiveIndex
                            ? 'scale-125 bg-darkwood'
                            : 'bg-darkwood/20 hover:bg-darkwood/40'
                        }
                      `}
                      aria-label={t(
                        'dashboard.currentlyReading.selectBook',
                        { title: book.title }
                      )}
                    />
                  ))}
                </div>

                <p className="font-ui text-xs text-darkwood/50 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm">
                  {t('dashboard.currentlyReading.count', {
                    count: books.length,
                  })}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateBy(-1)}
                  className="
                    flex h-9 w-9
                    cursor-pointer
                    items-center justify-center
                    rounded-full
                    text-darkwood/65
                    transition-[transform,background-color,color] duration-200 ease-out
                    hover:-translate-y-0.5
                    hover:bg-darkwood/5
                    hover:text-darkwood
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-olive/30
                  "
                  aria-label={t('dashboard.currentlyReading.previous')}
                >
                  <ChevronLeft
                    aria-hidden="true"
                    strokeWidth={1.8}
                    className="h-3.5 w-3.5"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => navigateBy(1)}
                  className="
                    flex h-9 w-9
                    cursor-pointer
                    items-center justify-center
                    rounded-full
                    text-darkwood/65
                    transition-[transform,background-color,color] duration-200 ease-out
                    hover:-translate-y-0.5
                    hover:bg-darkwood/5
                    hover:text-darkwood
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-olive/30
                  "
                  aria-label={t('dashboard.currentlyReading.next')}
                >
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={1.8}
                    className="h-3.5 w-3.5"
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default CurrentlyReading
