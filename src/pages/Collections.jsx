import { useEffect, useState } from 'react'

import CollectionCard from '../components/collections/CollectionCard.jsx'
import CollectionCreateModal from '../components/collections/CollectionCreateModal.jsx'
import CollectionDeleteModal from '../components/collections/CollectionDeleteModal.jsx'
import HeaderActions from '../components/layout/HeaderActions.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createCollection,
  deleteCollection,
  getUserCollections,
} from '../services/collectionsService.js'

function Collections() {
  const { user } = useAuth()

  const [collections, setCollections] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collectionToDelete, setCollectionToDelete] =
    useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function loadCollections() {
    if (!user?.uid) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const userCollections = await getUserCollections(
        user.uid
      )

      setCollections(userCollections)
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

        const userCollections = await getUserCollections(
          user.uid
        )

        if (isActive) {
          setCollections(userCollections)
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

      setCollections(userCollections)
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
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/60
            px-6 py-16
            text-center
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
              mx-auto mt-2 max-w-md
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
              grid gap-4
              sm:grid-cols-2
              xl:grid-cols-3
            "
          >
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onDeleteRequest={setCollectionToDelete}
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
    </div>
  )
}

export default Collections
