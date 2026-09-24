import BookCard from '../books/BookCard'

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

  const refreshIconClass = `inline-block origin-center leading-none ${
    isRefreshing ? 'animate-spin' : ''
  }`

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-2xl font-bold text-darkwood">
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
                    font-ui text-[11px] font-bold text-darkwood/55
                    transition
                    hover:border-darkwood/40 hover:text-darkwood
                    focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-olive/30
                  "
                >
                  ?
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
            <p className="mt-1 font-ui text-sm text-darkwood/60">
              {description}
            </p>
          )}
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={`Rafraichir ${title}`}
            className="
              grid size-10 shrink-0 place-items-center
              rounded-full border border-walnut/20
              bg-mintcream
              font-ui text-xl font-bold text-darkwood
              transition
              hover:bg-lime
              disabled:cursor-wait disabled:opacity-60
            "
          >
            <span
              className={refreshIconClass}
              aria-hidden="true"
            >
              ↻
            </span>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 font-ui text-sm text-darkwood/55">
          {error}
        </p>
      )}

      <div
        className="
          mt-6 grid
          grid-cols-2
          gap-5
          md:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-5
          lg:gap-8
        "
      >
        {books.map((book, index) => (
          <div
            key={book.id}
            className={`
              mx-auto w-full max-w-40
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
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default DiscoverShelf
