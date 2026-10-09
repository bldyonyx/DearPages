
import { useTranslation } from 'react-i18next'

import DiscoverSearchTip from './DiscoverSearchTip'
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
  const { t } = useTranslation()

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
          {t('discoverPage.loading')}
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
            title={t('discoverPage.shelves.trendingTitle')}
            description={t('discoverPage.shelves.trendingDescription')}
            info={t('discoverPage.shelves.trendingInfo')}
            books={trendingBooks}
            error={trendingRefreshError}
            isRefreshing={isTrendingRefreshing}
            onRefresh={onRefreshTrending}
          />

          <DiscoverShelf
            title={t('discoverPage.shelves.mustReadTitle')}
            description={t('discoverPage.shelves.mustReadDescription')}
            books={mustReadBooks}
            error={mustReadRefreshError}
            isRefreshing={isMustReadRefreshing}
            onRefresh={onRefreshMustReads}
          />

          <DiscoverSearchTip />
        </>
      )}
    </div>
  )
}

export default DiscoverHome
