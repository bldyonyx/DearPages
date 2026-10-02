import DiscoverShelf from './DiscoverShelf'
import ForYouSection from './ForYouSection'
import { discoverLarge } from './discoverResponsive'

function DiscoverHome({
  forYouBooks,
  trendingBooks,
  mustReadBooks,
  preferences,
  isLoading,
  error,
  isTrendingRefreshing,
  trendingRefreshError,
  onRefreshTrending,
  isMustReadRefreshing,
  mustReadRefreshError,
  onRefreshMustReads,
}) {
  return (
    <div
      aria-busy={isLoading}
      className={`dp-section-enter mt-10 space-y-12 ${discoverLarge.sectionStack}`}
    >
      {isLoading && (
        <p
          role="status"
          aria-live="polite"
          className={`
            max-w-[calc(100vw-3rem)] wrap-break-word font-ui text-sm
            text-darkwood/60 md:max-w-full
            ${discoverLarge.description}
          `}
        >
          Préparation de tes découvertes...
        </p>
      )}

      {!isLoading && error && (
        <p
          role="alert"
          className={`
            max-w-[calc(100vw-3rem)] wrap-break-word font-ui text-sm
            text-darkwood/60 md:max-w-full
            ${discoverLarge.description}
          `}
        >
          {error}
        </p>
      )}

      {!isLoading && (
        <>
          <ForYouSection
            books={forYouBooks}
            preferences={preferences}
          />

          <DiscoverShelf
            title="Tendances du moment"
            description="Les livres qui attirent l'attention en ce moment."
            info="Selon l’activité récente de la communauté Open Library."
            books={trendingBooks}
            error={trendingRefreshError}
            isRefreshing={isTrendingRefreshing}
            onRefresh={onRefreshTrending}
          />

          <DiscoverShelf
            title="Les incontournables"
            description="Des histoires intemporelles à découvrir."
            books={mustReadBooks}
            error={mustReadRefreshError}
            isRefreshing={isMustReadRefreshing}
            onRefresh={onRefreshMustReads}
          />
        </>
      )}
    </div>
  )
}

export default DiscoverHome
