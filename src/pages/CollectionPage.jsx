import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookMinus,
  Heart,
  MoreHorizontal,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import CollectionBookCard from '../components/collections/CollectionBookCard.jsx'
import CollectionBookRemoveModal from '../components/collections/CollectionBookRemoveModal.jsx'
import CollectionBooksModal from '../components/collections/CollectionBooksModal.jsx'
import CollectionClearModal from '../components/collections/CollectionClearModal.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  clearCollectionBooks,
  getUserCollection,
  removeBookFromCollection,
} from '../services/collectionsService.js'
import { getUserLibrary } from '../services/libraryService.js'

function getBookLabel(bookCount) {
  return `${bookCount} ${bookCount > 1 ? 'livres' : 'livre'}`
}

function getBookId(book) {
  return book.googleBooksId || book.id
}

function CollectionPage() {
  const { id: collectionId } = useParams()
  const { user } = useAuth()

  const [collection, setCollection] = useState(null)
  const [libraryBooks, setLibraryBooks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isBooksModalOpen, setIsBooksModalOpen] =
    useState(false)
  const [isClearModalOpen, setIsClearModalOpen] =
    useState(false)
  const [isClearingCollection, setIsClearingCollection] =
    useState(false)
  const [clearCollectionError, setClearCollectionError] =
    useState('')
  const [bookToRemove, setBookToRemove] = useState(null)
  const [removingBookId, setRemovingBookId] = useState('')
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] =
    useState(false)
  const headerActionsMenuRef = useRef(null)

  async function loadCollectionPage() {
    if (!user?.uid || !collectionId) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const [collectionData, userLibrary] =
        await Promise.all([
          getUserCollection(user.uid, collectionId),
          getUserLibrary(user.uid),
        ])

      setCollection(collectionData)
      setLibraryBooks(userLibrary)
    } catch (loadError) {
      console.error(
        'Unable to load collection page:',
        loadError
      )

      setError(
        'Impossible de charger cette collection pour le moment.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    async function loadActiveCollectionPage() {
      if (!user?.uid || !collectionId) {
        return
      }

      try {
        setIsLoading(true)
        setError('')

        const [collectionData, userLibrary] =
          await Promise.all([
            getUserCollection(user.uid, collectionId),
            getUserLibrary(user.uid),
          ])

        if (isActive) {
          setCollection(collectionData)
          setLibraryBooks(userLibrary)
        }
      } catch (loadError) {
        console.error(
          'Unable to load collection page:',
          loadError
        )

        if (isActive) {
          setError(
            'Impossible de charger cette collection pour le moment.'
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadActiveCollectionPage()

    return () => {
      isActive = false
    }
  }, [collectionId, user?.uid])

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        headerActionsMenuRef.current &&
        !headerActionsMenuRef.current.contains(event.target)
      ) {
        setIsHeaderActionsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [])

  const collectionBookIds = useMemo(
    () => Object.keys(collection?.books || {}),
    [collection]
  )

  const collectionBooks = useMemo(() => {
    if (collectionBookIds.length === 0) {
      return []
    }

    const collectionBookIdsSet = new Set(collectionBookIds)

    return libraryBooks.filter((book) =>
      collectionBookIdsSet.has(getBookId(book))
    )
  }, [collectionBookIds, libraryBooks])

  function handleBooksSaved(nextBooks) {
    setCollection((currentCollection) => ({
      ...currentCollection,
      books: nextBooks,
      updatedAt: Date.now(),
    }))
  }

  async function handleRemoveBookFromCollection(bookId) {
    if (!user?.uid || !collection?.id || !bookId) {
      return false
    }

    try {
      setRemovingBookId(bookId)
      setError('')

      await removeBookFromCollection(
        user.uid,
        collection.id,
        bookId
      )

      setCollection((currentCollection) => {
        const nextBooks = {
          ...(currentCollection.books || {}),
        }

        delete nextBooks[bookId]

        return {
          ...currentCollection,
          books: nextBooks,
          updatedAt: Date.now(),
        }
      })

      return true
    } catch (removeError) {
      console.error(
        'Unable to remove book from collection:',
        removeError
      )

      setError(
        'Impossible de retirer ce livre de la collection pour le moment.'
      )

      return false
    } finally {
      setRemovingBookId('')
    }
  }

  async function handleConfirmRemoveBook() {
    if (removingBookId) {
      return
    }

    const bookId = bookToRemove ? getBookId(bookToRemove) : ''
    const wasRemoved =
      await handleRemoveBookFromCollection(bookId)

    if (wasRemoved) {
      setBookToRemove(null)
    }
  }

  function handleOpenClearModal() {
    setClearCollectionError('')
    setIsClearModalOpen(true)
  }

  function handleOpenClearModalFromMenu() {
    setIsHeaderActionsMenuOpen(false)
    handleOpenClearModal()
  }

  function handleCloseClearModal() {
    if (isClearingCollection) {
      return
    }

    setIsClearModalOpen(false)
    setClearCollectionError('')
  }

  async function handleClearCollection() {
    if (!user?.uid || !collection?.id || isClearingCollection) {
      return
    }

    try {
      setIsClearingCollection(true)
      setClearCollectionError('')

      await clearCollectionBooks(user.uid, collection.id)

      setCollection((currentCollection) => ({
        ...currentCollection,
        books: {},
      }))
      setIsClearModalOpen(false)
    } catch (clearError) {
      console.error(
        'Unable to clear collection:',
        clearError
      )

      setClearCollectionError(
        'Impossible de vider cette collection pour le moment.'
      )
    } finally {
      setIsClearingCollection(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <section
          className="
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/65 p-5
            shadow-sm
            sm:p-7
          "
        >
          <LoadingState message="Chargement de la collection..." />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <section
          className="
            mt-8 rounded-[28px]
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
          "
        >
          <ErrorState
            message={error}
            onRetry={loadCollectionPage}
          />
        </section>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="p-6">
        <section
          className="
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/60
            px-6 py-14
            text-center
            shadow-sm
          "
        >
          <p className="font-heading text-2xl font-bold text-darkwood">
            Collection introuvable
          </p>

          <p className="mx-auto mt-2 max-w-md font-ui text-sm leading-6 text-walnut/70">
            Elle a peut-être été supprimée ou déplacée.
          </p>

          <Link
            to="/collections"
            className="
              mt-6 inline-flex
              items-center gap-2
              rounded-full bg-lime/70
              px-4 py-2
              font-ui text-sm
              font-bold text-darkwood
              transition-colors
              hover:bg-lime
            "
          >
            <ArrowLeft
              className="h-4 w-4"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            Retour aux collections
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="p-6">
      <header className="py-4">
        <Link
          to="/collections"
          className="
            inline-flex items-center gap-2
            rounded-full bg-cream/75
            px-3 py-1.5
            font-ui text-sm
            text-walnut
            shadow-sm
            transition-colors
            hover:bg-cream
            hover:text-darkwood
          "
        >
          <ArrowLeft
            className="h-4 w-4"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          Retour
        </Link>

        <div
          className="
            mt-5 flex flex-col gap-4
            lg:flex-row lg:items-end lg:justify-between
          "
        >
          <div className="min-w-0 lg:max-w-3xl">
            <h1 className="font-heading text-3xl font-bold leading-tight text-darkwood md:text-4xl">
              {collection.name}
            </h1>

            {collection.description && (
              <p className="mt-2 max-w-3xl font-ui text-sm leading-7 text-walnut/75 md:text-base">
                {collection.description}
              </p>
            )}
          </div>

          <div
            className="
              flex min-w-0 flex-wrap
              items-center gap-3
              lg:shrink-0 lg:justify-end
            "
          >
            <span
              className="
                inline-flex w-fit
                rounded-full border border-walnut/15
                bg-cream/75 px-3 py-1.5
                font-ui text-xs font-bold
                text-walnut
              "
            >
              {getBookLabel(collectionBooks.length)}
            </span>

            <button
              type="button"
              onClick={() => setIsBooksModalOpen(true)}
              className="
                inline-flex h-10
                cursor-pointer items-center
                justify-center rounded-full
                border border-lime/70
                bg-lime/70 px-4
                font-ui text-sm
                font-bold text-darkwood
                shadow-sm
                transition-colors
                hover:bg-lime
              "
            >
              + Ajouter des livres
            </button>

            {collectionBooks.length > 0 && (
              <div
                ref={headerActionsMenuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsHeaderActionsMenuOpen(
                      (current) => !current
                    )
                  }
                  aria-label="Actions de collection"
                  aria-haspopup="menu"
                  aria-expanded={isHeaderActionsMenuOpen}
                  className="
                    inline-flex h-10 w-10
                    cursor-pointer items-center
                    justify-center rounded-full
                    border border-walnut/15
                    bg-cream/70 text-walnut
                    shadow-sm
                    transition-colors
                    hover:border-walnut/25
                    hover:bg-cream
                    hover:text-darkwood
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-darkwood/25
                  "
                >
                  <MoreHorizontal
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>

                {isHeaderActionsMenuOpen && (
                  <div
                    role="menu"
                    className="
                      absolute right-0 top-12 z-30
                      min-w-52 rounded-2xl
                      border border-walnut/15
                      bg-cream p-1.5
                      shadow-md
                    "
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleOpenClearModalFromMenu}
                      className="
                        flex w-full cursor-pointer
                        items-center gap-2
                        rounded-xl px-3 py-2
                        text-left font-ui text-sm
                        font-bold text-darkwood
                        transition-colors
                        hover:bg-dustyrose/25
                      "
                    >
                      <BookMinus
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      Vider la collection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 h-px w-full bg-walnut/15" />
      </header>

      {collectionBooks.length === 0 ? (
        <section
          className="
            mt-8 max-w-3xl
            rounded-[24px] border
            border-walnut/10 bg-cream/80
            px-5 py-4 shadow-sm
            sm:px-6 sm:py-5
          "
        >
          <div
            className="
              flex flex-col gap-4
              sm:flex-row sm:items-center
              sm:justify-between
            "
          >
            <div className="flex min-w-0 gap-3">
              <span
                className="
                  mt-0.5 flex h-9 w-9 shrink-0
                  items-center justify-center
                  rounded-full border
                  border-lime/50 bg-lime/25
                  text-darkwood
                "
                aria-hidden="true"
              >
                <Heart
                  className="h-4 w-4"
                  strokeWidth={1.8}
                />
              </span>

              <div className="min-w-0">
                <p className="font-heading text-xl font-bold text-darkwood">
                  Cette collection est encore vide ♡
                </p>

                <p className="mt-1 font-ui text-sm leading-6 text-walnut/70">
                  Ajoute quelques livres pour commencer.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBooksModalOpen(true)}
              className="
                inline-flex h-10 shrink-0
                cursor-pointer items-center
                justify-center rounded-full
                border border-lime/70
                bg-lime/70 px-4
                font-ui text-sm
                font-bold text-darkwood
                shadow-sm
                transition-colors
                hover:bg-lime
              "
            >
              + Ajouter des livres
            </button>
          </div>
        </section>
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
          <div
            className="
              grid grid-cols-2
              gap-x-5 gap-y-14
              sm:grid-cols-3
              md:grid-cols-4
              xl:grid-cols-5
            "
          >
            {collectionBooks.map((book) => (
              <CollectionBookCard
                key={getBookId(book)}
                book={book}
                isRemoving={
                  removingBookId === getBookId(book)
                }
                onRemove={setBookToRemove}
              />
            ))}
          </div>
        </section>
      )}

      <CollectionBooksModal
        isOpen={isBooksModalOpen}
        userId={user.uid}
        collection={collection}
        libraryBooks={libraryBooks}
        onClose={() => setIsBooksModalOpen(false)}
        onSaved={handleBooksSaved}
      />

      <CollectionBookRemoveModal
        book={bookToRemove}
        isRemoving={
          removingBookId ===
          (bookToRemove ? getBookId(bookToRemove) : '')
        }
        onClose={() => setBookToRemove(null)}
        onRemove={handleConfirmRemoveBook}
      />

      <CollectionClearModal
        isOpen={isClearModalOpen}
        bookCount={collectionBooks.length}
        isClearing={isClearingCollection}
        error={clearCollectionError}
        onClose={handleCloseClearModal}
        onClear={handleClearCollection}
      />
    </div>
  )
}

export default CollectionPage
