import { Info, RefreshCw } from 'lucide-react'

import BookCard from '../books/BookCard'
import { discoverLarge } from './discoverResponsive'

function DiscoverShelf({
  title,
  description,
  info,
  books,
  error = '',
  isRefreshing = false,
  onRefresh,
  coverLoading = 'lazy',
}) {
  if (books.length === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              className={`
                font-heading text-2xl font-bold text-darkwood
                ${discoverLarge.title}
              `}
            >
              {title}
            </h2>

            {info && (
              <div className="group/info relative">
                <button
                  type="button"
                  aria-label={`À propos de ${title}`}
                  className="
                    grid size-5 place-items-center
                    rounded-full border border-darkwood/25
                    text-darkwood/55
                    transition
                    hover:border-darkwood/40 hover:text-darkwood
                    focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-olive/30
                    [@media_(min-width:2200px)_and_(min-height:1100px)]:size-6
                    [@media_(min-width:2400px)_and_(min-height:1300px)]:size-7
                  "
                >
                  <Info
                    aria-hidden="true"
                    className="
                      size-3
                      [@media_(min-width:2200px)_and_(min-height:1100px)]:size-3.5
                      [@media_(min-width:2400px)_and_(min-height:1300px)]:size-4
                    "
                    strokeWidth={1.8}
                  />
                </button>

                <div
                  role="tooltip"
                  className="
                    pointer-events-none absolute bottom-full left-1/2 z-20
                    mb-2 w-56 -translate-x-1/2
                    rounded-xl border border-walnut/15
                    bg-mintcream px-3 py-2
                    font-ui text-xs font-normal leading-relaxed text-darkwood/70
                    opacity-0 shadow-sm
                    transition-opacity duration-150
                    group-hover/info:opacity-100
                    group-focus-within/info:opacity-100
                  "
                >
                  {info}

                  <span
                    aria-hidden="true"
                    className="
                      absolute left-1/2 top-full
                      -translate-x-1/2
                      border-x-4 border-t-4
                      border-x-transparent border-t-mintcream
                    "
                  />
                </div>
              </div>
            )}
          </div>

          {description && (
            <p
              className={`
                mt-1 font-ui text-sm text-darkwood/60
                ${discoverLarge.description}
              `}
            >
              {description}
            </p>
          )}
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={`Rafraîchir ${title}`}
            className={`
              grid size-10 shrink-0 place-items-center
              rounded-full border border-walnut/20
              bg-mintcream
              text-darkwood
              transition
              hover:bg-lime
              disabled:cursor-wait disabled:opacity-60
              ${discoverLarge.iconButton}
            `}
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              strokeWidth={1.8}
            />
          </button>
        )}
      </div>

      {error && (
        <p
          aria-live="polite"
          className={`
            mt-3 font-ui text-sm text-darkwood/55
            ${discoverLarge.description}
          `}
        >
          {error}
        </p>
      )}

      <div
        className={`
          mt-6 grid
          grid-cols-2
          gap-5
          md:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-5
          lg:gap-8
          ${discoverLarge.bookGrid}
          ${discoverLarge.stackGap}
          ${discoverLarge.gridGap}
        `}
      >
        {books.slice(0, 7).map((book, index) => (
          <div
            key={book.id}
            className={`
              mx-auto w-full max-w-40
              ${discoverLarge.bookWrap}
              ${discoverLarge.bookVisibility}
              ${index >= 2 ? 'hidden md:block' : ''}
              ${index >= 3 ? 'md:hidden lg:block' : ''}
              ${index >= 4 ? 'lg:hidden xl:block' : ''}
            `}
          >
            <BookCard
              book={book}
              bookId={book.id}
              title={book.title}
              author={book.authors.join(', ')}
              cover={book.cover}
              isbn={book.isbn}
              source={book.source}
              coverLoading={coverLoading}
              titleClassName={discoverLarge.bookTitle}
              authorClassName={discoverLarge.bookAuthor}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default DiscoverShelf
