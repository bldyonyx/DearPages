import LibraryBookCard from './LibraryBookCard.jsx'
import LibraryFilters from './LibraryFilters.jsx'
import { libraryLarge } from './libraryResponsive.js'

function LibraryBooksPanel({
  books,
  visibleBooks,
  counts,
  activeFilter,
  onFilterChange,
  search,
}) {
  return (
    <section
      className={`
        mt-8
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        p-5
        shadow-sm
        backdrop-blur-[2px]
        sm:p-7
        lg:p-8
        ${libraryLarge.sectionGap}
        ${libraryLarge.panel}
      `}
    >
      <LibraryFilters
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        counts={counts}
        totalBooks={books.length}
      />

      {visibleBooks.length > 0 ? (
        <div
          className={`
            mt-7 grid
            grid-cols-2
            gap-x-5 gap-y-14
            sm:grid-cols-3
            md:grid-cols-4
            xl:grid-cols-5
            ${libraryLarge.gridGap}
            ${libraryLarge.bookGrid}
          `}
        >
          {visibleBooks.map((book) => (
            <LibraryBookCard
              key={book.googleBooksId}
              book={book}
            />
          ))}
        </div>
      ) : (
        <div
          className={`
            flex min-h-52
            items-center justify-center
            px-5 py-12
            text-center
            ${libraryLarge.emptyPanel}
          `}
        >
          <div>
            <p
              className={`
                font-heading text-xl
                font-bold text-darkwood
                ${libraryLarge.emptyTitle}
              `}
            >
              Aucun livre trouvé
            </p>

            <p
              className={`
                mt-1
                font-ui text-sm
                text-walnut/60
                ${libraryLarge.description}
              `}
            >
              {search.trim()
                ? 'Essaie une autre recherche ou un autre filtre.'
                : 'Aucun livre dans cette catégorie.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default LibraryBooksPanel
