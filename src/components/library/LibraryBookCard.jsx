import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import BookCover from '../books/BookCover.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { BOOK_STATUSES } from '../../services/libraryService.js'
import { getBookRouteId } from '../../utils/bookPageUtils.js'
import { formatReadingMonthYear } from '../../utils/readingDateUtils.js'
import { libraryLarge } from './libraryResponsive.js'

function LibraryBookCard({ book }) {
  const { i18n, t } = useTranslation()
  const isFinished =
    book.status === BOOK_STATUSES.FINISHED
  const isAbandoned =
    book.status === BOOK_STATUSES.ABANDONED

  const finalStatusDate = isFinished
    ? formatReadingMonthYear(book.finishedAt, i18n.language)
    : isAbandoned
      ? formatReadingMonthYear(book.abandonedAt, i18n.language)
      : ''

  const showsFinalStatusDate = isFinished || isAbandoned
  const bookId = getBookRouteId(book)

  return (
    <Link
      to={`/books/${bookId}`}
      state={{
        book,
        libraryBook: book,
      }}
      className="
        group flex h-full min-w-0
        flex-col rounded-[20px]
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-olive/35
      "
    >
      <div
        className="
          aspect-2/3 overflow-hidden
          rounded-[18px]
          bg-parchment shadow-sm
          transition-[transform,box-shadow] duration-200 ease-out
          group-hover:-translate-y-1
          group-hover:shadow-md
        "
      >
        <BookCover
          title={book.title}
          cover={book.cover}
          isbn={book.isbn}
          source={book.source}
          fallback="title"
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <h2
          title={book.title}
          className={`
            overflow-hidden
            font-heading text-lg
            font-bold leading-snug
            text-darkwood
            ${libraryLarge.bookTitle}
          `}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {book.title}
        </h2>

        <p
          className={`
            mt-1 truncate
            font-ui text-xs text-walnut/60
            ${libraryLarge.bookAuthor}
          `}
        >
          {book.authors?.join(', ') || t('common.unknownAuthor')}
        </p>

        <div className="mt-auto pt-3">
          <StatusBadge status={book.status} />

          {showsFinalStatusDate && (
            <p
              className={`
                mt-1.5
                font-ui text-xs
                text-walnut/55
                ${libraryLarge.bookAuthor}
              `}
            >
              {finalStatusDate || t('libraryPage.unknownDate')}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default LibraryBookCard
