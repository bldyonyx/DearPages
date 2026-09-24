import { Link } from 'react-router-dom'
import BookCard from '../books/BookCard'
import useForYouRecommendations from '../../hooks/useForYouRecommendations'

function ForYouRecommendations({
  preferences,
  cacheSignature,
  isEnabled,
}) {
  const {
    preferences: discoverPreferences,
    genreState,
    refreshGenre,
  } = useForYouRecommendations(
    isEnabled,
    preferences,
    cacheSignature
  )

  return (
    <main className="mt-10 space-y-10">
      <Link
        to="/discover"
        className="
          inline-flex w-fit
          font-ui text-sm font-bold
          text-darkwood/60
          transition-colors
          hover:text-darkwood
        "
      >
        ← Retour aux découvertes
      </Link>

      <header>
        <h2 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
          Suggestions pour toi ♡
        </h2>

        <p className="mt-2 max-w-2xl font-ui text-sm leading-relaxed text-darkwood/60 md:text-base">
          Des recommandations inspirees par tes genres preferes, pour
          retrouver rapidement une lecture qui colle a tes envies.
        </p>
      </header>

      <div className="space-y-7 md:space-y-8">
        {discoverPreferences.map(({ label, subject }, sectionIndex) => {
          const currentGenre = genreState[subject]
          const books = currentGenre?.books || []
          const isLoading = Boolean(currentGenre?.isLoading)
          const error = currentGenre?.error || ''
          const refreshIconClass = `inline-block origin-center leading-none ${
            isLoading ? 'animate-spin' : ''
          }`

          return (
            <section
              key={subject}
              className="
                rounded-3xl
                border border-walnut/10
                bg-cream/45
                p-4
                md:p-5
                lg:p-6
              "
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-handwritten text-lg text-walnut">
                    parce que tu aimes ♡
                  </p>

                  <h3 className="mt-1 font-heading text-3xl font-bold text-darkwood">
                    {label}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => refreshGenre(subject)}
                  disabled={isLoading}
                  aria-label={`Rafraichir les suggestions ${label}`}
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
                      bookId={book.id}
                      title={book.title}
                      author={book.authors.join(', ')}
                      cover={book.cover}
                      isbn={book.isbn}
                      source={book.source}
                      coverLoading={
                        sectionIndex === 0 ? 'eager' : 'lazy'
                      }
                    />
                  </div>
                ))}
              </div>

              {isLoading && books.length === 0 && (
                <p className="mt-4 font-ui text-sm text-darkwood/60">
                  Preparation des suggestions...
                </p>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}

export default ForYouRecommendations
