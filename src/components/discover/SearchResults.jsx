import BookCard from '../books/BookCard'
import BackButton from '../ui/BackButton.jsx'
import { discoverLarge } from './discoverResponsive'

function SearchResults({
  query,
  books,
  isLoading,
  error,
  onBackToDiscover,
}) {
  return (
    <section className={`mt-6 ${discoverLarge.sectionGap}`}>
      <BackButton
        onClick={onBackToDiscover}
        className="
          [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
          [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
        "
      >
        Retour aux découvertes
      </BackButton>

      {isLoading && (
        <p
          className={`
            mt-8 font-ui text-sm text-darkwood/60
            ${discoverLarge.description}
          `}
        >
          Recherche en cours...
        </p>
      )}

      {error && (
        <p
          className={`
            mt-8 font-ui text-sm text-darkwood
            ${discoverLarge.description}
          `}
        >
          {error}
        </p>
      )}

      {!isLoading && !error && (
        <>
          {/* Header des résultats */}
          <div className="mt-5 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6 [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-8">
            <div>
              <h2
                className={`
                  font-heading text-2xl font-bold text-darkwood
                  ${discoverLarge.title}
                `}
              >
                Résultats pour « {query} »
              </h2>

              <p
                className={`
                  mt-1 font-ui text-sm text-darkwood/60
                  ${discoverLarge.description}
                `}
              >
                {books.length} livre
                {books.length > 1 ? 's' : ''} trouvé
                {books.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Livres trouvés */}
          {books.length > 0 && (
            <div
              className={`
                mt-6 grid
                grid-cols-2
                justify-items-center
                gap-x-4 gap-y-7
                sm:grid-cols-[repeat(auto-fit,minmax(9rem,10rem))]
                sm:justify-start
                sm:justify-items-start
                sm:gap-x-5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:grid-cols-[repeat(auto-fit,minmax(12rem,12rem))]
                [@media_(min-width:2400px)_and_(min-height:1300px)]:grid-cols-[repeat(auto-fit,minmax(14rem,14rem))]
                ${discoverLarge.stackGap}
                ${discoverLarge.gridGap}
              `}
            >
              {books.map((book) => (
                <div
                  key={book.id}
                  className={`w-full max-w-40 ${discoverLarge.bookWrap}`}
                >
                  <BookCard
                    book={book}
                    bookId={book.id}
                    title={book.title}
                    author={book.authors.join(', ')}
                    cover={book.cover}
                    isbn={book.isbn}
                    source={book.source}
                    titleClassName={discoverLarge.bookTitle}
                    authorClassName={discoverLarge.bookAuthor}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Aucun résultat */}
          {books.length === 0 && (
            <div
              className="
                mt-6 rounded-2xl
                border border-walnut/10
                bg-cream/70
                px-6 py-10
                text-center
              "
            >
              <p
                className={`
                  font-heading text-xl font-bold text-darkwood
                  ${discoverLarge.title}
                `}
              >
                Aucun livre trouvé
              </p>

              <p
                className={`
                  mt-2 font-ui text-sm text-darkwood/60
                  ${discoverLarge.description}
                `}
              >
                Essaie avec un autre titre, auteur ou mot-clé.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default SearchResults