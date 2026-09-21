import { useEffect, useMemo, useState } from 'react'

import CollectionCard from '../components/collections/CollectionCard.jsx'
import CollectionCreateModal from '../components/collections/CollectionCreateModal.jsx'
import CollectionDeleteModal from '../components/collections/CollectionDeleteModal.jsx'
import CollectionEditModal from '../components/collections/CollectionEditModal.jsx'
import HeaderActions from '../components/layout/HeaderActions.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createCollection,
  deleteCollection,
  getUserCollections,
  updateCollection,
  updateCollectionPinned,
} from '../services/collectionsService.js'
import { getUserLibrary } from '../services/libraryService.js'

function sortCollections(collections) {
  return [...collections].sort((firstCollection, secondCollection) => {
    if (firstCollection.pinned !== secondCollection.pinned) {
      return firstCollection.pinned ? -1 : 1
    }

    return (
      (secondCollection.updatedAt ||
        secondCollection.createdAt ||
        0) -
      (firstCollection.updatedAt ||
        firstCollection.createdAt ||
        0)
    )
  })
}

function getBookId(book) {
  return book.googleBooksId || book.id
}

function Collections() {
  const { user } = useAuth()

  const [collections, setCollections] = useState([])
  const [libraryBooks, setLibraryBooks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collectionToDelete, setCollectionToDelete] =
    useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [collectionToEdit, setCollectionToEdit] =
    useState(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  async function loadCollections() {
    if (!user?.uid) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const [userCollections, userLibrary] =
        await Promise.all([
          getUserCollections(user.uid),
          getUserLibrary(user.uid),
        ])

      setCollections(sortCollections(userCollections))
      setLibraryBooks(userLibrary)
    } catch (loadError) {
      console.error(
        'Unable to load collections:',
        loadError
      )

      setError(
        'Impossible de charger tes collections pour le moment.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    async function loadActiveCollections() {
      if (!user?.uid) {
        return
      }

      try {
        setIsLoading(true)
        setError('')

        const [userCollections, userLibrary] =
          await Promise.all([
            getUserCollections(user.uid),
            getUserLibrary(user.uid),
          ])

        if (isActive) {
          setCollections(sortCollections(userCollections))
          setLibraryBooks(userLibrary)
        }
      } catch (loadError) {
        console.error(
          'Unable to load collections:',
          loadError
        )

        if (isActive) {
          setError(
            'Impossible de charger tes collections pour le moment.'
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadActiveCollections()

    return () => {
      isActive = false
    }
  }, [user?.uid])

  async function handleCreateCollection(collection) {
    if (!user?.uid) {
      return false
    }

    try {
      setIsSubmitting(true)
      setError('')

      await createCollection(user.uid, collection)

      const userCollections = await getUserCollections(
        user.uid
      )

      setCollections(sortCollections(userCollections))
      setIsCreateModalOpen(false)

      return true
    } catch (createError) {
      console.error(
        'Unable to create collection:',
        createError
      )

      setError(
        'Impossible de créer cette collection pour le moment.'
      )

      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteCollection() {
    if (!user?.uid || !collectionToDelete?.id) {
      return
    }

    try {
      setIsDeleting(true)
      setError('')

      await deleteCollection(
        user.uid,
        collectionToDelete.id
      )

      setCollections((currentCollections) =>
        currentCollections.filter(
          (collection) =>
            collection.id !== collectionToDelete.id
        )
      )
      setCollectionToDelete(null)
    } catch (deleteError) {
      console.error(
        'Unable to delete collection:',
        deleteError
      )

      setError(
        'Impossible de supprimer cette collection pour le moment.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleUpdateCollection(collectionData) {
    if (!user?.uid || !collectionToEdit?.id) {
      return false
    }

    try {
      setIsSavingEdit(true)
      setError('')

      await updateCollection(
        user.uid,
        collectionToEdit.id,
        collectionData
      )

      const updatedAt = Date.now()

      setCollections((currentCollections) =>
        sortCollections(
          currentCollections.map((collection) =>
            collection.id === collectionToEdit.id
              ? {
                  ...collection,
                  name: collectionData.name,
                  description:
                    collectionData.description || '',
                  updatedAt,
                }
              : collection
          )
        )
      )
      setCollectionToEdit(null)

      return true
    } catch (updateError) {
      console.error(
        'Unable to update collection:',
        updateError
      )

      setError(
        'Impossible de modifier cette collection pour le moment.'
      )

      return false
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleTogglePinned(collectionToPin) {
    if (!user?.uid || !collectionToPin?.id) {
      return
    }

    const nextPinned = !collectionToPin.pinned

    try {
      setError('')

      await updateCollectionPinned(
        user.uid,
        collectionToPin.id,
        nextPinned
      )

      const updatedAt = Date.now()

      setCollections((currentCollections) =>
        sortCollections(
          currentCollections.map((collection) =>
            collection.id === collectionToPin.id
              ? {
                  ...collection,
                  pinned: nextPinned,
                  updatedAt,
                }
              : collection
          )
        )
      )
    } catch (pinError) {
      console.error(
        'Unable to update collection pin:',
        pinError
      )

      setError(
        'Impossible de mettre à jour cette collection pour le moment.'
      )
    }
  }

  const libraryBooksById = useMemo(() => {
    return new Map(
      libraryBooks.map((book) => [getBookId(book), book])
    )
  }, [libraryBooks])

  function getCollectionPreviewBooks(collection) {
    return Object.keys(collection.books || {})
      .slice(0, 4)
      .map((bookId) => ({
        id: bookId,
        book: libraryBooksById.get(bookId) || null,
      }))
  }

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
              Mes collections
            </h1>

            <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
              Des piles de livres rangées à ta façon.
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
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="
                inline-flex h-10
                cursor-pointer
                shrink-0 items-center
                justify-center
                rounded-full border
                border-lime/70
                bg-lime/70 px-4
                font-bold text-darkwood
                shadow-sm
                hover:bg-lime
                md:h-11 md:px-5
              "
            >
              + Nouvelle collection
            </button>

            <HeaderActions className="md:flex-none" />
          </div>
        </div>
      </header>

      {isLoading ? (
        <section
          className="
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/65 p-5
            shadow-sm
            sm:p-7
          "
        >
          <LoadingState message="Chargement de tes collections..." />
        </section>
      ) : error ? (
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
            onRetry={loadCollections}
          />
        </section>
      ) : collections.length === 0 ? (
        <section
          className="
            mt-8 max-w-2xl rounded-[24px]
            border border-walnut/10
            bg-cream/75
            px-6 py-10
            shadow-sm
          "
        >
          <p
            className="
              font-heading text-2xl
              font-bold text-darkwood
            "
          >
            Aucune collection pour le moment
          </p>

          <p
            className="
              mt-2 max-w-md
              font-ui text-sm
              leading-6 text-walnut/70
            "
          >
            Crée une première collection pour regrouper tes
            envies, tes coups de coeur ou tes lectures à venir.
          </p>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="
              mt-6 cursor-pointer
              font-ui text-sm
              font-bold text-darkwood
              underline decoration-walnut/30
              underline-offset-4
              transition-opacity
              hover:opacity-70
            "
          >
            Créer ma première collection →
          </button>
        </section>
      ) : (
        <section
          className="
            mt-8
          "
        >
          <div
            className="
              grid gap-5
              sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]
              xl:grid-cols-3
            "
          >
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                previewBooks={getCollectionPreviewBooks(
                  collection
                )}
                onDeleteRequest={setCollectionToDelete}
                onEditRequest={setCollectionToEdit}
                onPinRequest={handleTogglePinned}
              />
            ))}
          </div>
        </section>
      )}

      <CollectionCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateCollection}
        isSubmitting={isSubmitting}
      />

      <CollectionDeleteModal
        collection={collectionToDelete}
        isDeleting={isDeleting}
        onClose={() => setCollectionToDelete(null)}
        onDelete={handleDeleteCollection}
      />

      <CollectionEditModal
        collection={collectionToEdit}
        isSaving={isSavingEdit}
        onClose={() => setCollectionToEdit(null)}
        onSave={handleUpdateCollection}
      />
    </div>
  )
}

export default Collections
