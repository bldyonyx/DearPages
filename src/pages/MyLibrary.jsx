import { Search, X } from 'lucide-react'
import { useState } from 'react'

import HeaderActions from '../components/layout/HeaderActions.jsx'
import LibraryBooksPanel from '../components/library/LibraryBooksPanel.jsx'
import LibraryEmptyState from '../components/library/LibraryEmptyState.jsx'
import LibrarySearchField from '../components/library/LibrarySearchField.jsx'
import { libraryLarge } from '../components/library/libraryResponsive.js'
import { useAuth } from '../context/AuthContext.jsx'
import useLibraryBooks from '../hooks/useLibraryBooks.js'

function MyLibrary() {
  const { user } = useAuth()

  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { books, isLoading, error } = useLibraryBooks(
    user?.uid
  )

  const counts = {
    all: books.length,
    'to-read': books.filter(
      (book) => book.status === 'to-read'
    ).length,
    reading: books.filter(
      (book) => book.status === 'reading'
    ).length,
    finished: books.filter(
      (book) => book.status === 'finished'
    ).length,
    abandoned: books.filter(
      (book) => book.status === 'abandoned'
    ).length,
  }

  const normalizedSearch = search.trim().toLowerCase()

  const visibleBooks = books.filter((book) => {
    const matchesFilter =
      activeFilter === 'all' ||
      book.status === activeFilter

    if (!matchesFilter) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    const title = book.title?.toLowerCase() || ''

    const authors =
      book.authors
        ?.join(' ')
        .toLowerCase() || ''

    return (
      title.includes(normalizedSearch) ||
      authors.includes(normalizedSearch)
    )
  })

  function handleClearSearch() {
    setSearch('')
  }

  return (
    <div className={`p-6 ${libraryLarge.shell}`}>
      <header className={`py-4 ${libraryLarge.headerTop}`}>
        <div
          className="
            flex flex-col gap-4
            md:flex-row md:items-center md:justify-between
          "
        >
          <div className="min-w-0">
            <h1
              className={`
                font-heading text-3xl font-bold text-darkwood md:text-4xl
                ${libraryLarge.pageTitle}
              `}
            >
              Ma bibliothèque
            </h1>

            <p
              className={`
                mt-2 font-ui text-sm font-semibold text-darkwood/60
                md:text-base
                ${libraryLarge.pageDescription}
              `}
            >
              tous tes livres, au même endroit ♡
            </p>
          </div>

          <div
            className="
              flex min-w-0
              items-center gap-3
              md:flex-1
              md:justify-end
            "
          >
            <div
              className={`
                hidden min-w-0
                md:block md:w-56
                lg:w-64
                xl:w-80
                2xl:w-96
                ${libraryLarge.searchWrap}
              `}
            >
              <LibrarySearchField
                id="library-search"
                search={search}
                onSearchChange={setSearch}
                onClearSearch={handleClearSearch}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setIsSearchOpen(
                  (current) => !current
                )
              }
              aria-label={
                isSearchOpen
                  ? 'Fermer la recherche'
                  : 'Rechercher dans ma bibliothèque'
              }
              aria-expanded={isSearchOpen}
              className={`
                flex h-11 w-11
                shrink-0 cursor-pointer
                items-center justify-center
                rounded-full
                border border-walnut/30
                bg-cream text-darkwood
                md:hidden
                ${libraryLarge.iconButton}
              `}
            >
              {isSearchOpen ? (
                <X
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="h-5 w-5"
                />
              ) : (
                <Search
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="h-5 w-5"
                />
              )}
            </button>

            <HeaderActions user={user} className="md:flex-none" />
          </div>
        </div>

        {isSearchOpen && (
          <div className="mt-4 w-full md:hidden">
            <LibrarySearchField
              id="library-search-mobile"
              search={search}
              onSearchChange={setSearch}
              onClearSearch={handleClearSearch}
              autoFocus
            />
          </div>
        )}
      </header>

      {isLoading ? (
        <p
          className={`
            mt-8 font-ui text-sm text-walnut/65
            ${libraryLarge.description}
            ${libraryLarge.sectionGap}
          `}
        >
          Chargement de ta bibliothèque...
        </p>
      ) : error ? (
        <div
          className={`
            mt-8 rounded-3xl
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
            font-ui text-sm
            text-darkwood
            ${libraryLarge.description}
            ${libraryLarge.sectionGap}
          `}
        >
          {error}
        </div>
      ) : books.length === 0 ? (
        <div className={`mt-8 ${libraryLarge.sectionGap}`}>
          <LibraryEmptyState />
        </div>
      ) : (
        <LibraryBooksPanel
          books={books}
          visibleBooks={visibleBooks}
          counts={counts}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          search={search}
        />
      )}
    </div>
  )
}

export default MyLibrary
