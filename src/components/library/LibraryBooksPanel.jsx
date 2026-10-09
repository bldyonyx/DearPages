import { useTranslation } from 'react-i18next'

import LibraryBookCard from './LibraryBookCard.jsx'
import LibraryFilters from './LibraryFilters.jsx'
import { libraryLarge } from './libraryResponsive.js'
import { getBookRouteId } from '../../utils/bookPageUtils.js'

function LibraryBooksPanel({
  books,
  visibleBooks,
  counts,
  activeFilter,
  onFilterChange,
  search,
}) {
  const { t } = useTranslation()

  return (
    <section
      className={`
        dp-section-enter
        mt-8
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        p-5
        shadow-sm
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
            dp-card-list-enter
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
              key={getBookRouteId(book)}
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
              {t('libraryPage.panel.emptyTitle')}
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
                ? t('libraryPage.panel.emptySearch')
                : t('libraryPage.panel.emptyFilter')}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default LibraryBooksPanel
