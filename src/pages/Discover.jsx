import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import DiscoverHome from '../components/discover/DiscoverHome'
import DiscoverSearch from '../components/discover/DiscoverSearch'
import ForYouRecommendations from '../components/discover/ForYouRecommendations'
import SearchResults from '../components/discover/SearchResults'
import HeaderActions from '../components/layout/HeaderActions'
import { useAuth } from '../context/AuthContext'
import useDiscoverHomeBooks from '../hooks/useDiscoverHomeBooks'
import useDiscoverSearch from '../hooks/useDiscoverSearch'
import {
  createDiscoverPreferencesSignature,
  normalizeDiscoverPreferences,
} from '../utils/discoverPreferences'

function Discover() {
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
        (preference) => preference.label
      ),
    [discoverPreferences]
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
      !isSearchMode && !isForYouMode && !isPreferencesLoading,
    personalizedSubject,
    forYouCacheSignature: discoverPreferencesSignature,
  })

  return (
    <div className="p-6">
      {/* Header */}
      <header className="py-4">
        <div
          className="
            flex flex-col gap-4
            md:flex-row md:items-center md:justify-between
          "
        >
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
              Découvrir
            </h1>

            <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
              Trouve ta prochaine lecture.
            </p>
          </div>

          <HeaderActions user={user} />
        </div>
      </header>

      {/* Recherche */}
      <section className={isSearchMode ? 'mt-6' : 'mt-8'}>
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

      {/* Mode recommandations personnalisees */}
      {isForYouMode && (
        <ForYouRecommendations
          preferences={discoverPreferences}
          cacheSignature={discoverPreferencesSignature}
          isEnabled={!isPreferencesLoading}
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
