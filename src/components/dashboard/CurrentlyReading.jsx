import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BOOK_STATUSES,
} from '../../services/libraryService'
import BookCover from '../books/BookCover'
import StatusBadge from '../ui/StatusBadge'

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
        transition-all duration-300
        md:w-36 lg:w-40
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
    books.find((book) => book.googleBooksId === selectedBookId) ||
    books[0]

  async function handleStatusChange(newStatus) {
    if (!currentBook || updatingBookId) return

    if (newStatus === currentBook.status) {
      setIsStatusOpen(false)
      return
    }

    setStatusError('')

    try {
      await onStatusChange(currentBook.googleBooksId, newStatus)
      setIsStatusOpen(false)
    } catch {
      setStatusError(
        'Impossible de modifier ce statut pour le moment.'
      )
    }
  }

  if (books.length === 0) {
    return (
      <section className="rounded-3xl border border-darkwood/10 bg-cream/80 p-5 md:p-6">
        <h2 className="font-heading text-2xl font-bold text-darkwood">
          Lecture en cours
        </h2>

        <p className="mt-1 font-ui text-sm text-darkwood/60">
          Aucun livre en cours pour le moment.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-darkwood/10 bg-cream/80 p-5 md:p-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-darkwood">
          Lecture en cours
        </h2>

        <p className="mt-1 font-ui text-sm text-darkwood/60">
          Les livres que tu lis en ce moment.
        </p>
      </div>

      <div className="mt-6 grid items-center gap-8 sm:grid-cols-2">
        {/* Stack de couvertures */}
        <div className="flex items-center justify-center px-4">
          {books.map((book, index) => {
            const isSelected =
              book.googleBooksId === currentBook.googleBooksId

            return (
              <button
                key={book.googleBooksId}
                type="button"
                onClick={() => {
                  setSelectedBookId(book.googleBooksId)
                  setIsStatusOpen(false)
                }}
                className={`
                  relative cursor-pointer transition-all duration-300 ease-out
                  ${index === 0 ? '' : '-ml-20'}
                  ${isSelected ? '-translate-y-3' : 'hover:-translate-y-1'}
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
        <div className="flex min-w-0 flex-col justify-center sm:min-h-52">
          <div>
            <StatusBadge status={currentBook.status} />
          </div>

          <h3 className="mt-3 line-clamp-3 wrap-break-word font-heading text-2xl font-bold leading-tight text-darkwood">
            {currentBook.title}
          </h3>

          <p className="mt-1 line-clamp-2 wrap-break-word font-ui text-sm text-darkwood/60">
            {currentBook.authors?.join(', ') || 'Auteur inconnu'}
          </p>

          <div className="mt-5 flex flex-wrap items-start gap-2">
            <Link
              to={`/books/${currentBook.googleBooksId}`}
              className="rounded-full bg-darkwood px-4 py-2 font-ui text-xs font-bold text-cream transition-transform hover:-translate-y-0.5"
            >
              Voir la fiche
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStatusOpen((current) => !current)}
                disabled={updatingBookId === currentBook.googleBooksId}
                className="cursor-pointer rounded-full border border-darkwood/20 px-4 py-2 font-ui text-xs font-bold text-darkwood transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {updatingBookId === currentBook.googleBooksId
                  ? 'Modification...'
                  : 'Changer le statut'}
              </button>

              {isStatusOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 min-w-40 overflow-hidden rounded-2xl border border-darkwood/10 bg-cream p-2 shadow-lg">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => handleStatusChange(status.value)}
                      disabled={
                        updatingBookId === currentBook.googleBooksId
                      }
                      className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left font-ui text-xs text-darkwood transition-colors hover:bg-darkwood/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {statusError && (
            <p className="mt-3 font-ui text-sm text-red-700">
              {statusError}
            </p>
          )}

          {/* Navigation entre les lectures */}
          {books.length > 1 && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                {books.map((book) => (
                  <button
                    key={book.googleBooksId}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(book.googleBooksId)
                      setIsStatusOpen(false)
                    }}
                    className={`
                      h-2.5 w-2.5 cursor-pointer rounded-full
                      transition-all duration-300
                      ${
                        book.googleBooksId === currentBook.googleBooksId
                          ? 'scale-125 bg-darkwood'
                          : 'bg-darkwood/20 hover:bg-darkwood/40'
                      }
                    `}
                    aria-label={`Sélectionner ${book.title}`}
                  />
                ))}
              </div>

              <p className="font-ui text-xs text-darkwood/50">
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
