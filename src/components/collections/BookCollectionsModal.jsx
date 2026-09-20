import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'

import {
  addBookToCollection,
  getUserCollections,
  removeBookFromCollection,
} from '../../services/collectionsService.js'
import Button from '../ui/Button.jsx'
import LoadingState from '../ui/LoadingState.jsx'
import Modal from '../ui/Modal.jsx'

function getCollectionsContainingBook(collections, bookId) {
  return new Set(
    collections
      .filter((collection) => collection.books?.[bookId])
      .map((collection) => collection.id)
  )
}

function BookCollectionsModal({
  isOpen,
  userId,
  bookId,
  onClose,
  onSaved,
}) {
  const [collections, setCollections] = useState([])
  const [initialSelectedIds, setInitialSelectedIds] =
    useState(new Set())
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !userId || !bookId) {
      return
    }

    let isActive = true

    async function loadCollections() {
      try {
        setIsLoading(true)
        setError('')

        const userCollections = await getUserCollections(userId)
        const selectedCollectionIds =
          getCollectionsContainingBook(
            userCollections,
            bookId
          )

        if (isActive) {
          setCollections(userCollections)
          setInitialSelectedIds(selectedCollectionIds)
          setSelectedIds(new Set(selectedCollectionIds))
        }
      } catch (loadError) {
        console.error(
          'Unable to load book collections:',
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

    loadCollections()

    return () => {
      isActive = false
    }
  }, [bookId, isOpen, userId])

  const selectedCount = selectedIds.size

  const hasChanges = useMemo(() => {
    if (initialSelectedIds.size !== selectedIds.size) {
      return true
    }

    return [...selectedIds].some(
      (collectionId) => !initialSelectedIds.has(collectionId)
    )
  }, [initialSelectedIds, selectedIds])

  function handleClose() {
    if (isSaving) {
      return
    }

    onClose()
  }

  function toggleCollection(collectionId) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(collectionId)) {
        nextIds.delete(collectionId)
      } else {
        nextIds.add(collectionId)
      }

      return nextIds
    })
  }

  async function handleSave(event) {
    event.preventDefault()

    if (!userId || !bookId) {
      return
    }

    const collectionIdsToAdd = [...selectedIds].filter(
      (collectionId) => !initialSelectedIds.has(collectionId)
    )

    const collectionIdsToRemove = [
      ...initialSelectedIds,
    ].filter((collectionId) => !selectedIds.has(collectionId))

    try {
      setIsSaving(true)
      setError('')

      await Promise.all([
        ...collectionIdsToAdd.map((collectionId) =>
          addBookToCollection(userId, collectionId, bookId)
        ),
        ...collectionIdsToRemove.map((collectionId) =>
          removeBookFromCollection(
            userId,
            collectionId,
            bookId
          )
        ),
      ])

      onSaved(selectedCount)
      onClose()
    } catch (saveError) {
      console.error(
        'Unable to save book collections:',
        saveError
      )

      setError(
        'Impossible de modifier les collections pour le moment.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ajouter à une collection ♡"
    >
      {isLoading ? (
        <LoadingState message="Chargement des collections..." />
      ) : collections.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-heading text-xl font-bold text-darkwood">
            Aucune collection pour le moment
          </p>

          <p className="mx-auto mt-2 max-w-xs font-ui text-sm leading-6 text-walnut/70">
            Crée une collection depuis la page Collections pour y
            ranger ce livre.
          </p>

          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="hide-scrollbar max-h-[min(20rem,calc(100vh-14rem))] space-y-2 overflow-y-auto pr-1">
            {collections.map((collection) => {
              const isSelected = selectedIds.has(collection.id)

              return (
                <button
                  key={collection.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() =>
                    toggleCollection(collection.id)
                  }
                  disabled={isSaving}
                  className={`
                    flex w-full cursor-pointer
                    items-start justify-between
                    gap-3 rounded-2xl border
                    px-4 py-3 text-left
                    transition-colors
                    disabled:cursor-not-allowed
                    disabled:opacity-70
                    ${
                      isSelected
                        ? 'border-lime/70 bg-lime/20'
                        : 'border-walnut/10 bg-cream/70 hover:border-walnut/25'
                    }
                  `}
                >
                  <span className="min-w-0">
                    <span className="block font-ui text-sm font-bold text-darkwood">
                      {collection.name}
                    </span>

                    {collection.description && (
                      <span className="mt-1 block truncate font-ui text-xs text-walnut/65">
                        {collection.description}
                      </span>
                    )}
                  </span>

                  <span
                    className={`
                      mt-0.5 flex h-6 w-6
                      shrink-0 items-center
                      justify-center rounded-full
                      border transition-colors
                      ${
                        isSelected
                          ? 'border-lime bg-lime text-darkwood'
                          : 'border-walnut/20 bg-cream/80'
                      }
                    `}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <Check
                        className="h-4 w-4"
                        strokeWidth={2}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <p className="mt-3 font-ui text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              disabled={isSaving || !hasChanges}
              className="
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default BookCollectionsModal
