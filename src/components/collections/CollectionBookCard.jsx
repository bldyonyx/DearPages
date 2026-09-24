import { Link } from 'react-router-dom'
import { BookMinus } from 'lucide-react'

import BookCover from '../books/BookCover.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function CollectionBookCard({
  book,
  isRemoving = false,
  onRemove,
}) {
  const bookId = getBookId(book)

  function handleRemoveClick(event) {
    event.preventDefault()
    event.stopPropagation()
    onRemove(book)
  }

  return (
    <article className="group relative flex h-full min-w-0 flex-col rounded-[20px]">
      <div className="absolute right-2 top-2 z-10">
        <button
          type="button"
          onClick={handleRemoveClick}
          disabled={isRemoving}
          aria-label="Retirer de la collection"
          className="
            peer flex h-8 w-8 cursor-pointer
            items-center justify-center rounded-full
            border border-walnut/10
            bg-cream/90 text-walnut
            shadow-sm backdrop-blur-[1px]
            transition-colors
            hover:border-walnut/25
            hover:bg-cream
            hover:text-darkwood
            focus:border-walnut/25
            focus:bg-cream
            focus:text-darkwood
            focus:outline-none
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <BookMinus
            className="h-4 w-4"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <span
          className="
            pointer-events-none absolute
            right-0 top-[calc(100%+0.375rem)]
            w-max max-w-[calc(100vw-1rem)]
            rounded-lg border border-walnut/10
            bg-cream px-2 py-1
            font-ui text-xs font-bold
            text-darkwood opacity-0
            shadow-sm transition-opacity
            peer-hover:opacity-100
            peer-focus:opacity-100
          "
        >
          Retirer de la collection
        </span>
      </div>

      <Link
        to={`/books/${bookId}`}
        className="
          flex h-full min-w-0
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
    </article>
  )
}

export default CollectionBookCard
