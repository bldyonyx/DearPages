import { Link } from 'react-router-dom'
import StatusBadge from '../ui/StatusBadge.jsx'

function LibraryBookCard({ book }) {
  return (
    <Link
      to={`/books/${book.googleBooksId}`}
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
        {book.cover ? (
          <img
            src={book.cover}
            alt={`Couverture de ${book.title}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-5 text-center">
            <span className="font-heading text-lg font-bold leading-snug text-darkwood">
              {book.title}
            </span>
          </div>
        )}
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