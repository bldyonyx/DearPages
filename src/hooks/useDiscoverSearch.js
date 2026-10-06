import { useEffect, useState } from 'react'
import {
  getBookSuggestions,
  searchBooks,
} from '../services/booksApi'

/**
 * Centralise la recherche de la page Decouvrir.
 *
 * Le hook garde l'input synchronise avec le parametre d'URL `?q=`,
 * charge les resultats Google Books lorsque ce parametre existe,
 * et recupere les suggestions avec un debounce de 300 ms.
 *
 * @param {string} queryFromUrl - Recherche actuellement presente dans l'URL.
 * @param {Function} setSearchParams - Setter fourni par `useSearchParams`.
 * @returns {Object} Etat et handlers necessaires a l'experience de recherche.
 */
function useDiscoverSearch(queryFromUrl, setSearchParams) {
  const [search, setSearch] = useState(queryFromUrl)
  const [books, setBooks] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [areSuggestionsLoading, setAreSuggestionsLoading] =
    useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSearch(queryFromUrl)
  }, [queryFromUrl])

  useEffect(() => {
    if (!queryFromUrl) {
      setBooks([])
      setError('')
      return
    }

    let isActive = true

    async function loadBooks() {
      try {
        setIsLoading(true)
        setError('')

        const results = await searchBooks(queryFromUrl)

        if (isActive) {
          setBooks(results)
        }
      } catch (err) {
        if (isActive) {
          setError(err.message)
          setBooks([])
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadBooks()

    return () => {
      isActive = false
    }
  }, [queryFromUrl])

  useEffect(() => {
    let isActive = true
    const trimmedSearch = search.trim()

    if (
      trimmedSearch.length < 2 ||
      trimmedSearch === queryFromUrl
    ) {
      setSuggestions([])
      setAreSuggestionsLoading(false)
      return
    }

    setAreSuggestionsLoading(true)

    const timeout = setTimeout(async () => {
      try {
        const results = await getBookSuggestions(trimmedSearch)

        if (isActive) {
          setSuggestions(results)
        }
      } catch {
        if (isActive) {
          setSuggestions([])
        }
      } finally {
        if (isActive) {
          setAreSuggestionsLoading(false)
        }
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(timeout)
    }
  }, [search, queryFromUrl])

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedSearch = search.trim()

    if (!trimmedSearch) return

    setSuggestions([])
    setAreSuggestionsLoading(false)
    setSearchParams({ q: trimmedSearch })
  }

  function clearSearch() {
    setSearch('')
    setSuggestions([])
    setAreSuggestionsLoading(false)
    setSearchParams({})
  }

  return {
    search,
    setSearch,
    books,
    suggestions,
    isLoading,
    areSuggestionsLoading,
    error,
    handleSubmit,
    handleClearSearch: clearSearch,
    handleBackToDiscover: clearSearch,
  }
}

export default useDiscoverSearch
