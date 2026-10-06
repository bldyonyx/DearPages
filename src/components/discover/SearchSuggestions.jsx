import { Link } from 'react-router-dom'

import BookCover from '../books/BookCover.jsx'
import { discoverLarge } from './discoverResponsive'

function SearchSuggestions({ suggestions, isLoading }) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="
          absolute left-0 right-0 top-full z-20
          mt-2 rounded-2xl
          border border-walnut/20
          bg-cream p-4
          shadow-lg
        "
      >
        <p
          className={`
            font-ui text-sm text-darkwood/60
            ${discoverLarge.description}
          `}
        >
          Recherche...
        </p>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div
      className="
        absolute left-0 right-0 top-full z-20
        mt-2 max-h-[min(26rem,calc(100dvh-16rem-env(safe-area-inset-bottom)))]
        overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl
        border border-walnut/20
        bg-cream
        shadow-lg
      "
    >
      {suggestions.map((book) => (
        <Link
          key={book.id}
          to={`/books/${book.id}`}
          state={{ book }}
          className="
            flex items-center gap-3
            border-b border-walnut/10
            px-4 py-3
            transition-colors
            last:border-b-0
            hover:bg-mintcream
          "
        >
          <div
            className="
              flex h-16 w-11 shrink-0
              items-center justify-center
              overflow-hidden rounded-md
              bg-parchment
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-20
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-14
              [@media_(min-width:2400px)_and_(min-height:1300px)]:h-24
              [@media_(min-width:2400px)_and_(min-height:1300px)]:w-16
            "
          >
            <BookCover
              title={book.title}
              cover={book.cover}
              isbn={book.isbn}
              source={book.source}
              className="h-full w-full"
              imageClassName="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <p
              className={`
                truncate font-heading text-base font-bold text-darkwood
                ${discoverLarge.bookTitle}
              `}
            >
              {book.title}
            </p>

            <p
              className={`
                mt-1 truncate font-ui text-xs text-darkwood/60
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              `}
            >
              {book.authors.join(', ')}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default SearchSuggestions
