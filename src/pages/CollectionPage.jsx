import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import CollectionBookCard from '../components/collections/CollectionBookCard.jsx'
import CollectionBookRemoveModal from '../components/collections/CollectionBookRemoveModal.jsx'
import CollectionBooksModal from '../components/collections/CollectionBooksModal.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
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
  const [bookToRemove, setBookToRemove] = useState(null)
  const [removingBookId, setRemovingBookId] = useState('')

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
        <div
          className="
            flex flex-col gap-4
            sm:flex-row sm:items-start sm:justify-between
          "
        >
          <div className="min-w-0">
            <Link
              to="/collections"
              className="
                inline-flex items-center gap-2
                rounded-full bg-cream/75
                px-4 py-2
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

            <h1 className="mt-5 font-heading text-3xl font-bold leading-tight text-darkwood md:text-4xl">
              {collection.name}
            </h1>

            {collection.description && (
              <p className="mt-2 max-w-3xl font-ui text-sm leading-7 text-walnut/75 md:text-base">
                {collection.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
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
          </div>
        </div>

        <div className="mt-6 h-px w-full bg-walnut/15" />
      </header>

      {collectionBooks.length === 0 ? (
        <section
          className="
            mt-12 flex min-h-72
            flex-col items-center justify-center
            px-6 py-10
            text-center
          "
        >
          <p className="font-heading text-2xl font-bold text-darkwood">
            Aucun livre pour le moment ♡
          </p>

          <p className="mx-auto mt-2 max-w-md font-ui text-sm leading-6 text-walnut/70">
            Ajoute quelques livres pour commencer cette collection.
          </p>

          <button
            type="button"
            onClick={() => setIsBooksModalOpen(true)}
            className="
              mt-6 inline-flex
              cursor-pointer items-center
              justify-center rounded-full
              border border-lime/70
              bg-lime/70 px-5 py-2.5
              font-ui text-sm
              font-bold text-darkwood
              shadow-sm
              transition-colors
              hover:bg-lime
            "
          >
            + Ajouter des livres
          </button>
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
    </div>
  )
}

export default CollectionPage
