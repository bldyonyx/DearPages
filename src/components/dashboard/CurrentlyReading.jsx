import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

import {
  BOOK_STATUSES,
} from '../../services/libraryService'
import BookCover from '../books/BookCover'
import StatusBadge from '../ui/StatusBadge'
import { dashboardLarge } from './dashboardResponsive.js'

const statusOptions = [
  { value: BOOK_STATUSES.TO_READ, label: 'À lire' },
  { value: BOOK_STATUSES.READING, label: 'En cours' },
  { value: BOOK_STATUSES.FINISHED, label: 'Terminé' },
  { value: BOOK_STATUSES.ABANDONED, label: 'Abandonné' },
]

function DashboardCover({
  book,
  isSelected,
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
        transition-[transform,box-shadow,opacity] duration-300 ease-out
        md:w-36 lg:w-40
        [@media_(min-width:2200px)_and_(min-height:1100px)]:w-48
        [@media_(min-width:2400px)_and_(min-height:1300px)]:w-56
        ${
          isSelected
            ? 'scale-105 shadow-lg'
            : 'opacity-80'
        }
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
  const [selectedBookId, setSelectedBookId] = useState(
    books[0]?.googleBooksId || null
  )

  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusError, setStatusError] = useState('')

  const currentBook =
    books.find(
      (book) => book.googleBooksId === selectedBookId
    ) || books[0]

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
        'Impossible de modifier ce statut pour le moment.'
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
            Lecture en cours
          </h2>

          <p
            className={`
              mt-1 font-ui text-sm text-darkwood/60
              ${dashboardLarge.description}
            `}
          >
            Aucun livre en cours pour le moment.
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
            Peut-être que ta prochaine lecture t’attend déjà ♡
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
            Trouver ma prochaine lecture
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
          Lecture en cours
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          Les livres que tu lis en ce moment.
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
            flex items-center justify-center px-4
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2400px)_and_(min-height:1300px)]:px-8
          "
        >
          {books.map((book, index) => {
            const isSelected =
              book.googleBooksId ===
              currentBook.googleBooksId

            return (
              <button
                key={book.googleBooksId}
                type="button"
                onClick={() => {
                  setSelectedBookId(
                    book.googleBooksId
                  )
                  setIsStatusOpen(false)
                }}
                className={`
                  relative cursor-pointer
                  transition-transform duration-300 ease-out
                  ${
                    index === 0
                      ? ''
                      : '-ml-20 [@media_(min-width:2200px)_and_(min-height:1100px)]:-ml-24 [@media_(min-width:2400px)_and_(min-height:1300px)]:-ml-28'
                  }
                  ${
                    isSelected
                      ? '-translate-y-3'
                      : 'hover:-translate-y-1'
                  }
                `}
                style={{
                  zIndex: isSelected
                    ? books.length + 1
                    : books.length - index,
                }}
                aria-label={`Afficher ${book.title}`}
              >
                <DashboardCover
                  book={book}
                  isSelected={isSelected}
                />
              </button>
            )
          })}
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

          <h3
            className="
              mt-3 line-clamp-3
              wrap-break-word
              font-heading text-2xl
              font-bold leading-tight
              text-darkwood
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-4
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-3xl
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-4xl
            "
          >
            {currentBook.title}
          </h3>

          <p
            className="
              mt-1 line-clamp-2
              wrap-break-word
              font-ui text-sm
              text-darkwood/60
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
            "
          >
            {currentBook.authors?.join(', ') ||
              'Auteur inconnu'}
          </p>

          <div
            className="
              mt-5 flex flex-wrap
              items-start gap-2
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-3
              [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-8
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
              Voir la fiche
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
                  ? 'Modification...'
                  : 'Changer le statut'}
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
                      {status.label}
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
            <div className="mt-6 flex flex-wrap items-center gap-4 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8 [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-5">
              <div className="flex gap-2">
                {books.map((book) => (
                  <button
                    key={book.googleBooksId}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(
                        book.googleBooksId
                      )
                      setIsStatusOpen(false)
                    }}
                    className={`
                      h-2.5 w-2.5
                      cursor-pointer
                      rounded-full
                      transition-[transform,background-color] duration-300 ease-out
                      [@media_(min-width:2200px)_and_(min-height:1100px)]:h-3
                      [@media_(min-width:2200px)_and_(min-height:1100px)]:w-3
                      ${
                        book.googleBooksId ===
                        currentBook.googleBooksId
                          ? 'scale-125 bg-darkwood'
                          : 'bg-darkwood/20 hover:bg-darkwood/40'
                      }
                    `}
                    aria-label={`Sélectionner ${book.title}`}
                  />
                ))}
              </div>

              <p className="font-ui text-xs text-darkwood/50 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm">
                {books.length}{' '}
                {books.length === 1
                  ? 'lecture en cours'
                  : 'lectures en cours'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default CurrentlyReading
