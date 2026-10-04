import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import useResponsivePlaceholder from '../../hooks/useResponsivePlaceholder'
import Input from '../ui/Input'
import SearchSuggestions from './SearchSuggestions'
import { discoverLarge } from './discoverResponsive'

const DISCOVER_SEARCH_PLACEHOLDER =
  'Rechercher un titre, un auteur...'

function DiscoverSearch({
  search,
  onSearchChange,
  onSubmit,
  onClear,
  submittedQuery,
  suggestions,
  isSuggestionsLoading,
}) {
  const searchRef = useRef(null)
  const { containerRef, placeholder } =
    useResponsivePlaceholder(DISCOVER_SEARCH_PLACEHOLDER)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const trimmedSearch = search.trim()
  const trimmedSubmittedQuery = submittedQuery.trim()

  const isTypingNewQuery =
    trimmedSearch.length >= 2 &&
    trimmedSearch !== trimmedSubmittedQuery

  const hasSuggestionsPanel =
    suggestions.length > 0 || isSuggestionsLoading

  const shouldShowSuggestions =
    isSuggestionsOpen &&
    isTypingNewQuery &&
    hasSuggestionsPanel

  /*
   * Ferme les suggestions lorsque l'utilisateur
   * clique en dehors de la zone de recherche.
   */
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setIsSuggestionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function handleFocus() {
    if (isTypingNewQuery) {
      setIsSuggestionsOpen(true)
    }
  }

  function handleChange(event) {
    onSearchChange(event.target.value)
    setIsSuggestionsOpen(true)
  }

  function handleClear() {
    setIsSuggestionsOpen(false)
    onClear()
  }

  function handleSubmit(event) {
    setIsSuggestionsOpen(false)
    onSubmit(event)
  }

  return (
    <form
      ref={searchRef}
      onSubmit={handleSubmit}
      className={`
        relative w-full min-w-0
        max-w-[calc(100vw-3rem)]
        md:max-w-2xl
        ${discoverLarge.searchForm}
      `}
    >
      <div ref={containerRef} className="relative">
        {/* Loupe */}
        <Search
          aria-hidden="true"
          strokeWidth={1.8}
          className="
            pointer-events-none
            absolute left-5 top-1/2 z-10
            h-5 w-5 -translate-y-1/2
            text-darkwood/50
            [@media_(min-width:2200px)_and_(min-height:1100px)]:h-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:w-6
            [@media_(min-width:2400px)_and_(min-height:1300px)]:left-6
          "
        />

        <Input
          id="discover-search"
          type="search"
          value={search}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          aria-label="Rechercher un livre"
          autoComplete="off"
          className={`
            w-full
            rounded-full!
            py-3 pl-13 pr-12
            ${discoverLarge.searchInput}
          `}
        />

        {/* Effacer la recherche */}
        {search && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Effacer la recherche"
            className="
              absolute right-4 top-1/2 z-10
              flex h-7 w-7
              -translate-y-1/2
              cursor-pointer
              items-center justify-center
              rounded-full
              text-darkwood/50
              transition-colors
              hover:text-darkwood
              [@media_(min-width:2200px)_and_(min-height:1100px)]:right-5
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-8
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-8
              [@media_(min-width:2400px)_and_(min-height:1300px)]:right-6
            "
          >
            <X
              aria-hidden="true"
              strokeWidth={1.8}
              className="
                h-4 w-4
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-5
              "
            />
          </button>
        )}
      </div>

      {shouldShowSuggestions && (
        <SearchSuggestions
          suggestions={suggestions}
          isLoading={isSuggestionsLoading}
        />
      )}
    </form>
  )
}

export default DiscoverSearch
