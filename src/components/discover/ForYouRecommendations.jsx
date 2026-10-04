import { RefreshCw } from 'lucide-react'

import useForYouRecommendations from '../../hooks/useForYouRecommendations'
import BookCard from '../books/BookCard'
import BackButton from '../ui/BackButton.jsx'
import { discoverLarge } from './discoverResponsive'

function ForYouRecommendations({
  userId,
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
    userId,
    preferences,
    cacheSignature
  )

  return (
    <main className={`dp-section-enter mt-10 space-y-10 ${discoverLarge.sectionStack}`}>
      <BackButton
        to="/discover"
        className="
          [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
          [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
        "
      >
        Retour aux découvertes
      </BackButton>

      <header className="dp-page-enter">
        <h2
          className={`
            font-heading text-3xl font-bold text-darkwood md:text-4xl
            ${discoverLarge.pageTitle}
          `}
        >
          Suggestions pour toi ♡
        </h2>

        <p
          className={`
            mt-2 max-w-2xl font-ui text-sm leading-relaxed text-darkwood/60
            md:text-base
            [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-3xl
            ${discoverLarge.pageDescription}
          `}
        >
          Des recommandations inspirees par tes genres preferes, pour
          retrouver rapidement une lecture qui colle a tes envies.
        </p>
      </header>

      <div className="space-y-7 md:space-y-8 [@media_(min-width:2200px)_and_(min-height:1100px)]:space-y-10 [@media_(min-width:2400px)_and_(min-height:1300px)]:space-y-12">
        {discoverPreferences.map(({ label, subject }, sectionIndex) => {
          const currentGenre = genreState[subject]
          const books = currentGenre?.books || []
          const isLoading = Boolean(currentGenre?.isLoading)
          const error = currentGenre?.error || ''

          return (
            <section
              key={subject}
              className={`
                dp-section-enter
                rounded-3xl
                border border-darkwood/10
                bg-cream/80
                p-4
                md:p-5
                lg:p-6
                ${discoverLarge.card}
              `}
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p
                    className={`
                      font-handwritten text-lg text-walnut
                      ${discoverLarge.handwritten}
                    `}
                  >
                    parce que tu aimes ♡
                  </p>

                  <h3
                    className={`
                      mt-1 font-heading text-3xl font-bold text-darkwood
                      ${discoverLarge.featuredTitle}
                    `}
                  >
                    {label}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => refreshGenre(subject)}
                  disabled={isLoading}
                  aria-label={`Rafraîchir les suggestions ${label}`}
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
                      isLoading ? 'animate-spin' : ''
                    }`}
                    strokeWidth={1.8}
                  />
                </button>
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
                  dp-card-list-enter
                  mt-6 grid
                  grid-cols-2
                  gap-5
                  md:grid-cols-3
                  lg:grid-cols-4
                  xl:grid-cols-5
                  lg:gap-8
                  ${discoverLarge.stackGap}
                  ${discoverLarge.gridGap}
                  ${discoverLarge.bookGrid}
                `}
              >
                {books.map((book, index) => (
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
                      coverLoading={
                        sectionIndex === 0 ? 'eager' : 'lazy'
                      }
                      titleClassName={discoverLarge.bookTitle}
                      authorClassName={discoverLarge.bookAuthor}
                    />
                  </div>
                ))}
              </div>

              {isLoading && books.length === 0 && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`
                    mt-4 font-ui text-sm text-darkwood/60
                    ${discoverLarge.description}
                  `}
                >
                  Préparation des suggestions...
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
