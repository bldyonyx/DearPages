
import { useTranslation } from 'react-i18next'

import BookCard from '../books/BookCard'
import BackButton from '../ui/BackButton.jsx'
import DiscoverSearchTip from './DiscoverSearchTip'
import { discoverLarge } from './discoverResponsive'

function SearchResults({
  query,
  books,
  isLoading,
  error,
  onBackToDiscover,
}) {
  const { t } = useTranslation()

  return (
    <section
      aria-busy={isLoading}
      className={`dp-section-enter mt-6 ${discoverLarge.sectionGap}`}
    >
      <BackButton
        onClick={onBackToDiscover}
        className={discoverLarge.searchResultsBackButton}
      >
        {t('discoverPage.search.back')}
      </BackButton>

      {isLoading && (
        <div
          className={`
            mt-5 w-full rounded-3xl
            border border-darkwood/10
            bg-cream/80
            p-5 shadow-sm
            sm:p-7
            lg:p-8
            ${discoverLarge.searchResultsPanel}
            ${discoverLarge.searchResultsWidth}
          `}
        >
          <p
            role="status"
            aria-live="polite"
            className={`
              font-ui text-sm text-darkwood/60
              ${discoverLarge.description}
            `}
          >
            {t('discoverPage.search.resultsLoading')}
          </p>
        </div>
      )}

      {error && (
        <div
          className={`
            mt-5 w-full rounded-3xl
            border border-dustyrose/30
            bg-dustyrose/20
            p-5 shadow-sm
            sm:p-7
            lg:p-8
            ${discoverLarge.searchResultsPanel}
            ${discoverLarge.searchResultsWidth}
          `}
        >
          <p
            role="alert"
            className={`
              font-ui text-sm text-darkwood
              ${discoverLarge.description}
            `}
          >
            {error}
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <div
          className={`
            mt-5 w-full rounded-3xl
            border border-darkwood/10
            bg-cream/80
            p-5 shadow-sm
            sm:p-7
            lg:p-8
            ${discoverLarge.searchResultsPanel}
            ${discoverLarge.searchResultsWidth}
          `}
        >
          {/* Header des résultats */}
          <div
            className={`
              flex flex-col gap-1
              ${discoverLarge.searchResultsHeader}
            `}
          >
            <h2
              className={`
                font-heading text-2xl font-bold leading-tight text-darkwood
                md:text-3xl
                ${discoverLarge.searchResultsTitle}
              `}
            >
              {t('discoverPage.search.resultsTitle', { query })}
            </h2>

            <p
              className={`
                font-ui text-sm text-darkwood/60
                ${discoverLarge.searchResultsMeta}
              `}
            >
              {t('discoverPage.search.resultsCount', {
                count: books.length,
              })}
            </p>
          </div>

          {/* Livres trouvés */}
          {books.length > 0 && (
            <div
              className={`
                dp-card-list-enter
                mt-7 grid
                grid-cols-2
                justify-items-center
                gap-x-5 gap-y-12
                sm:gap-x-6
                lg:gap-x-7
                ${discoverLarge.searchResultsGrid}
                ${discoverLarge.searchResultsGridGap}
              `}
            >
              {books.map((book) => (
                <div
                  key={book.id}
                  className={`
                    mx-auto w-full max-w-40
                    ${discoverLarge.searchResultsCardWrap}
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
                    titleClassName={
                      discoverLarge.searchResultsBookTitle
                    }
                    authorClassName={
                      discoverLarge.searchResultsBookAuthor
                    }
                    contentClassName="
                      [@media_(min-width:1800px)_and_(min-height:1050px)]:mt-3.5
                    "
                  />
                </div>
              ))}
            </div>
          )}

          {/* Aucun résultat */}
          {books.length === 0 && (
            <div
              className={`
                mt-7
                px-4 py-10
                text-center
                ${discoverLarge.searchResultsEmptyPanel}
              `}
            >
              <p
                className={`
                  font-heading text-xl font-bold text-darkwood
                  ${discoverLarge.searchResultsTitle}
                `}
              >
                {t('discoverPage.search.emptyTitle')}
              </p>

              <p
                className={`
                  mt-2 font-ui text-sm text-darkwood/60
                  ${discoverLarge.searchResultsMeta}
                `}
              >
                {t('discoverPage.search.emptySubtitle')}
              </p>
            </div>
          )}

          {/* Conseil de recherche */}
          <DiscoverSearchTip className="mt-9" />
        </div>
      )}
    </section>
  )
}

export default SearchResults
