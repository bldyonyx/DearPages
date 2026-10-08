import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BOOK_STATUSES } from '../../services/libraryService'
import StatusBadge from '../ui/StatusBadge'

const statusOptions = [
  { value: BOOK_STATUSES.TO_READ, labelKey: 'status.to-read' },
  { value: BOOK_STATUSES.READING, labelKey: 'status.reading' },
  { value: BOOK_STATUSES.FINISHED, labelKey: 'status.finished' },
  { value: BOOK_STATUSES.ABANDONED, labelKey: 'status.abandoned' },
]

function CurrentlyReadingBookInfo({
  activeIndex,
  books,
  currentBook,
  isStatusOpen,
  navigateBy,
  navigateToIndex,
  onStatusChange,
  setIsStatusOpen,
  setStatusError,
  statusError,
  updatingBookId,
}) {
  const { t } = useTranslation()

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

  return (
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
              setIsStatusOpen((current) => !current)
            }
            disabled={
              updatingBookId === currentBook.googleBooksId
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
            {updatingBookId === currentBook.googleBooksId
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
                    handleStatusChange(status.value)
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

      {books.length > 1 && (
        <div className="mt-6 inline-flex flex-col items-center gap-2.5 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <div className="flex gap-2">
              {books.map((book, bookIndex) => (
                <button
                  key={book.googleBooksId}
                  type="button"
                  onClick={() => navigateToIndex(bookIndex)}
                  className={`
                    h-2.5 w-2.5
                    cursor-pointer
                    rounded-full
                    transition-[transform,background-color] duration-300 ease-out
                    [@media_(min-width:2200px)_and_(min-height:1100px)]:h-3
                    [@media_(min-width:2200px)_and_(min-height:1100px)]:w-3
                    ${
                      bookIndex === activeIndex
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
  )
}

export default CurrentlyReadingBookInfo
