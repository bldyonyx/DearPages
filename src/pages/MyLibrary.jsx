import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import HeaderActions from '../components/layout/HeaderActions.jsx'
import LibraryBookCard from '../components/library/LibraryBookCard.jsx'
import LibraryEmptyState from '../components/library/LibraryEmptyState.jsx'
import LibraryFilters from '../components/library/LibraryFilters.jsx'
import { libraryLarge } from '../components/library/libraryResponsive.js'
import Input from '../components/ui/Input.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getUserLibrary } from '../services/libraryService.js'

function LibrarySearchField({
  id,
  search,
  onSearchChange,
  onClearSearch,
  autoFocus = false,
}) {
  return (
    <div className="relative">
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
        id={id}
        type="search"
        value={search}
        onChange={(event) =>
          onSearchChange(event.target.value)
        }
        placeholder="Rechercher dans ma bibliothèque..."
        aria-label="Rechercher dans ma bibliothèque"
        autoFocus={autoFocus}
        className={`
          w-full rounded-full!
          py-3 pl-13 pr-12
          ${libraryLarge.searchInput}
        `}
      />

      {search && (
        <button
          type="button"
          onClick={onClearSearch}
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
  )
}

function MyLibrary() {
  const { user } = useAuth()

  const [books, setBooks] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid) {
      return
    }

    let isActive = true

    async function loadLibrary() {
      try {
        setIsLoading(true)
        setError('')

        const libraryBooks = await getUserLibrary(user.uid)

        if (isActive) {
          setBooks(libraryBooks)
        }
      } catch (loadError) {
        console.error(
          'Unable to load library:',
          loadError
        )

        if (isActive) {
          setError(
            'Impossible de charger ta bibliothèque pour le moment.'
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadLibrary()

    return () => {
      isActive = false
    }
  }, [user?.uid])

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
        <section
          className={`
            mt-8
            rounded-[28px]
            border border-walnut/10
            bg-cream/65
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
            onFilterChange={setActiveFilter}
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
      )}
    </div>
  )
}

export default MyLibrary
