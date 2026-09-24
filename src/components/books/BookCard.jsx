import { Link } from 'react-router-dom'

import StatusBadge from '../ui/StatusBadge'
import BookCover from './BookCover.jsx'

function BookCard({
  book,
  bookId,
  title,
  author,
  cover,
  isbn,
  source,
  status,
  coverLoading = 'eager',
}) {
  const routeBook =
    book ||
    (bookId
      ? {
          id: bookId,
          googleBooksId: bookId,
          title,
          authors: author ? [author] : ['Auteur inconnu'],
          cover: cover || null,
          isbn: isbn || null,
          isbns: isbn ? [isbn] : [],
          source: source || null,
          status,
        }
      : null)
  const linkState = routeBook
    ? {
        book: routeBook,
        ...(routeBook.status
          ? { libraryBook: routeBook }
          : {}),
      }
    : undefined
  const coverContent = (
    <BookCover
      title={title}
      cover={cover}
      isbn={isbn}
      source={source}
      coverLoading={coverLoading}
      className="aspect-2/3 overflow-hidden rounded-xl bg-cream"
      imageClassName="
        h-full w-full object-cover
        transition-transform duration-200
        group-hover:scale-[1.02]
      "
    />
  )

  return (
    <article className="w-full">
      {bookId ? (
        <Link
          to={`/books/${bookId}`}
          state={linkState}
          className="group block"
          aria-label={`Voir ${title}`}
        >
          {coverContent}
        </Link>
      ) : (
        coverContent
      )}

      <div className="mt-3 text-center">
        {bookId ? (
          <h3 className="line-clamp-3 wrap-break-word font-heading text-lg font-bold leading-tight text-darkwood">
            <Link
              to={`/books/${bookId}`}
              state={linkState}
              className="transition-colors hover:text-walnut"
            >
              {title}
            </Link>
          </h3>
        ) : (
          <h3 className="line-clamp-3 wrap-break-word font-heading text-lg font-bold leading-tight text-darkwood">
            {title}
          </h3>
        )}

        <p className="mt-1 line-clamp-2 wrap-break-word font-ui text-sm text-darkwood/60">
          {author || 'Auteur inconnu'}
        </p>

        {status && (
          <div className="mt-2 flex justify-center">
            <StatusBadge status={status} />
          </div>
        )}
      </div>
    </article>
  )
}

export default BookCard
