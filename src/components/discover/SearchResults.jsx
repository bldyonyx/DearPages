import BookCard from '../books/BookCard'

function SearchResults({
  query,
  books,
  isLoading,
  error,
  onBackToDiscover,
}) {
  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={onBackToDiscover}
        className="
          cursor-pointer
          font-ui text-sm font-bold
          text-darkwood/60
          transition-colors
          hover:text-darkwood
        "
      >
        ← Retour aux découvertes
      </button>

      {isLoading && (
        <p className="mt-8 font-ui text-sm text-darkwood/60">
          Recherche en cours...
        </p>
      )}

      {error && (
        <p className="mt-8 font-ui text-sm text-darkwood">
          {error}
        </p>
      )}

      {!isLoading && !error && (
        <>
          {/* Header des résultats */}
          <div className="mt-5">
            <div>
              <h2 className="font-heading text-2xl font-bold text-darkwood">
                Résultats pour « {query} »
              </h2>

              <p className="mt-1 font-ui text-sm text-darkwood/60">
                {books.length} livre
                {books.length > 1 ? 's' : ''} trouvé
                {books.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Livres trouvés */}
          {books.length > 0 && (
            <div
              className="
                mt-6 grid
                grid-cols-2
                justify-items-center
                gap-x-4 gap-y-7
                sm:grid-cols-[repeat(auto-fit,minmax(9rem,10rem))]
                sm:justify-start
                sm:justify-items-start
                sm:gap-x-5
              "
            >
              {books.map((book) => (
                <div key={book.id} className="w-full max-w-40">
                  <BookCard
                    book={book}
                    bookId={book.id}
                    title={book.title}
                    author={book.authors.join(', ')}
                    cover={book.cover}
                    isbn={book.isbn}
                    source={book.source}
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
              <p className="font-heading text-xl font-bold text-darkwood">
                Aucun livre trouvé
              </p>

              <p className="mt-2 font-ui text-sm text-darkwood/60">
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
