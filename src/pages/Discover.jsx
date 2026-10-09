
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import DiscoverHome from '../components/discover/DiscoverHome'
import DiscoverSearch from '../components/discover/DiscoverSearch'
import ForYouRecommendations from '../components/discover/ForYouRecommendations'
import SearchResults from '../components/discover/SearchResults'
import { discoverLarge } from '../components/discover/discoverResponsive'
import HeaderActions from '../components/layout/HeaderActions'
import { useAuth } from '../context/AuthContext'
import useDiscoverHomeBooks from '../hooks/useDiscoverHomeBooks'
import useDiscoverSearch from '../hooks/useDiscoverSearch'
import {
  createDiscoverPreferencesSignature,
  normalizeDiscoverPreferences,
} from '../utils/discoverPreferences'

function Discover() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, preferences, isPreferencesLoading } = useAuth()

  const queryFromUrl = searchParams.get('q') || ''
  const isSearchMode = Boolean(queryFromUrl)
  const isForYouMode =
    searchParams.get('view') === 'for-you' && !isSearchMode

  const discoverPreferences = useMemo(
    () =>
      normalizeDiscoverPreferences(preferences?.favoriteGenres),
    [preferences]
  )

  const discoverPreferenceLabels = useMemo(
    () =>
      discoverPreferences.map(
        (preference) => t(`genres.${preference.subject}`)
      ),
    [discoverPreferences, t]
  )

  const translatedDiscoverPreferences = useMemo(
    () =>
      discoverPreferences.map((preference) => ({
        ...preference,
        label: t(`genres.${preference.subject}`),
      })),
    [discoverPreferences, t]
  )

  const discoverPreferencesSignature = useMemo(
    () =>
      createDiscoverPreferencesSignature(discoverPreferences),
    [discoverPreferences]
  )

  const personalizedSubject = discoverPreferences[0].subject

  const {
    search,
    setSearch,
    books,
    suggestions,
    isLoading,
    areSuggestionsLoading,
    error,
    handleSubmit,
    handleClearSearch,
    handleBackToDiscover,
  } = useDiscoverSearch(queryFromUrl, setSearchParams)

  const {
    forYouBooks,
    trendingBooks,
    mustReadBooks,
    isDiscoverLoading,
    discoverError,
    isTrendingRefreshing,
    trendingRefreshError,
    refreshTrendingBooks,
    isMustReadRefreshing,
    mustReadRefreshError,
    refreshMustReadBooks,
  } = useDiscoverHomeBooks({
    isEnabled:
      Boolean(user?.uid) &&
      !isSearchMode &&
      !isForYouMode &&
      !isPreferencesLoading,
    userId: user?.uid,
    personalizedSubject,
    forYouCacheSignature: discoverPreferencesSignature,
  })

  return (
    <div className={`p-6 ${discoverLarge.shell}`}>
      {/* Header */}
      <header className={`dp-page-enter py-4 ${discoverLarge.headerTop}`}>
        <div
          className="
            flex items-start justify-between gap-4
            md:items-center
          "
        >
          <div className="min-w-0">
            <h1
              className={`
                font-heading text-3xl font-bold text-darkwood md:text-4xl
                ${discoverLarge.pageTitle}
              `}
            >
              {t('discoverPage.title')}
            </h1>

            <p
              className={`
                mt-2 font-ui text-sm font-semibold text-darkwood/60
                md:text-base
                ${discoverLarge.pageDescription}
              `}
            >
              {t('discoverPage.subtitle')}
            </p>
          </div>

          <HeaderActions
            user={user}
            className="shrink-0"
          />
        </div>
      </header>

      {/* Recherche : même position dans les deux modes */}
      <section
        className={`
          dp-section-enter relative z-10 mt-8 lg:z-20
          ${discoverLarge.firstSectionGap}
        `}
      >
        <DiscoverSearch
          search={search}
          onSearchChange={setSearch}
          onSubmit={handleSubmit}
          onClear={handleClearSearch}
          submittedQuery={queryFromUrl}
          suggestions={suggestions}
          isSuggestionsLoading={areSuggestionsLoading}
        />
      </section>

      {/* Mode découverte */}
      {!isSearchMode && !isForYouMode && (
        <DiscoverHome
          forYouBooks={forYouBooks}
          trendingBooks={trendingBooks}
          mustReadBooks={mustReadBooks}
          preferences={discoverPreferenceLabels}
          isLoading={isDiscoverLoading}
          error={discoverError}
          isTrendingRefreshing={isTrendingRefreshing}
          trendingRefreshError={trendingRefreshError}
          onRefreshTrending={refreshTrendingBooks}
          isMustReadRefreshing={isMustReadRefreshing}
          mustReadRefreshError={mustReadRefreshError}
          onRefreshMustReads={refreshMustReadBooks}
        />
      )}

      {/* Mode recommandations personnalisées */}
      {isForYouMode && (
        <ForYouRecommendations
          userId={user?.uid}
          preferences={translatedDiscoverPreferences}
          cacheSignature={discoverPreferencesSignature}
          isEnabled={Boolean(user?.uid) && !isPreferencesLoading}
        />
      )}

      {/* Mode recherche */}
      {isSearchMode && (
        <SearchResults
          query={queryFromUrl}
          books={books}
          isLoading={isLoading}
          error={error}
          onBackToDiscover={handleBackToDiscover}
        />
      )}
    </div>
  )
}

export default Discover
