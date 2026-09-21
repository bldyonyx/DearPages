import { useEffect, useState } from 'react'

import HeaderActions from '../components/layout/HeaderActions.jsx'
import LibraryBookCard from '../components/library/LibraryBookCard.jsx'
import LibraryEmptyState from '../components/library/LibraryEmptyState.jsx'
import LibraryFilters from '../components/library/LibraryFilters.jsx'
import Input from '../components/ui/Input.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getUserLibrary } from '../services/libraryService.js'

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

  return (
    <div className="p-6">
      <header className="py-4">
        <div
          className="
            flex flex-col gap-4
            md:flex-row md:items-center md:justify-between
          "
        >
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
              Ma bibliothèque
            </h1>

            <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
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
              className="
                hidden min-w-0
                md:block md:w-56
                lg:w-64
                xl:w-80
                2xl:w-96
              "
            >
              <Input
                id="library-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Rechercher dans ma bibliothèque..."
                aria-label="Rechercher dans ma bibliothèque"
                className="
                  w-full rounded-full!
                  px-6 py-3
                "
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
              className="
                flex h-11 w-11
                shrink-0 cursor-pointer
                items-center justify-center
                rounded-full
                border border-walnut/30
                bg-cream text-darkwood
                md:hidden
              "
            >
              {isSearchOpen ? (
                <span className="text-xl leading-none">
                  ×
                </span>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </svg>
              )}
            </button>

            <HeaderActions className="md:flex-none" />
          </div>
        </div>

        {isSearchOpen && (
          <div className="mt-4 w-full md:hidden">
            <Input
              id="library-search-mobile"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher dans ma bibliothèque..."
              aria-label="Rechercher dans ma bibliothèque"
              autoFocus
              className="
                w-full rounded-full!
                px-6 py-3
              "
            />
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="mt-8 font-ui text-sm text-walnut/65">
          Chargement de ta bibliothèque...
        </p>
      ) : error ? (
        <div
          className="
            mt-8 rounded-3xl
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
            font-ui text-sm
            text-darkwood
          "
        >
          {error}
        </div>
      ) : books.length === 0 ? (
        <div className="mt-8">
          <LibraryEmptyState />
        </div>
      ) : (
        <section
          className="
            mt-8
            rounded-[28px]
            border border-walnut/10
            bg-cream/65
            p-5
            shadow-sm
            backdrop-blur-[2px]
            sm:p-7
            lg:p-8
          "
        >
          <LibraryFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
            totalBooks={books.length}
          />

          {visibleBooks.length > 0 ? (
            <div
              className="
                mt-7 grid
                grid-cols-2
                gap-x-5 gap-y-14
                sm:grid-cols-3
                md:grid-cols-4
                xl:grid-cols-5
              "
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
              className="
                flex min-h-52
                items-center justify-center
                px-5 py-12
                text-center
              "
            >
              <div>
                <p
                  className="
                    font-heading text-xl
                    font-bold text-darkwood
                  "
                >
                  Aucun livre trouvé
                </p>

                <p
                  className="
                    mt-1
                    font-ui text-sm
                    text-walnut/60
                  "
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