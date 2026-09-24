import { Link } from 'react-router-dom'

import BookCover from '../books/BookCover.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

function LibraryBookCard({ book }) {
  return (
    <Link
      to={`/books/${book.googleBooksId}`}
      state={{
        book,
        libraryBook: book,
      }}
      className="
        group flex h-full min-w-0
        flex-col rounded-[20px]
        focus:outline-none
      "
    >
      <div
        className="
          aspect-2/3 overflow-hidden
          rounded-[18px]
          bg-parchment shadow-sm
          transition
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
          className="
            overflow-hidden
            font-heading text-lg
            font-bold leading-snug
            text-darkwood
          "
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {book.title}
        </h2>

        <p className="mt-1 truncate font-ui text-xs text-walnut/60">
          {book.authors?.join(', ') || 'Auteur inconnu'}
        </p>

        <div className="mt-auto pt-3">
          <StatusBadge status={book.status} />
        </div>
      </div>
    </Link>
  )
}

export default LibraryBookCard
