import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../context/AuthContext.jsx'
import {
  createCollection,
  deleteCollection,
  getUserCollections,
  updateCollection,
  updateCollectionPinned,
} from '../services/collectionsService.js'
import { getUserLibrary } from '../services/libraryService.js'

function compareCollections(
  firstCollection,
  secondCollection,
) {
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
}

function sortCollections(collections) {
  return [...collections].sort(compareCollections)
}

function getBookId(book) {
  return book.googleBooksId || book.id
}

function useCollections() {
  const { user } = useAuth()
  const userId = user?.uid

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

  const loadCollections = useCallback(async () => {
    if (!userId) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const [userCollections, userLibrary] =
        await Promise.all([
          getUserCollections(userId),
          getUserLibrary(userId),
        ])

      setCollections(sortCollections(userCollections))
      setLibraryBooks(userLibrary)
    } catch (loadError) {
      console.error(
        'Unable to load collections:',
        loadError,
      )

      setError(
        'Impossible de charger tes collections pour le moment.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    let isActive = true

    async function loadActiveCollections() {
      if (!userId) {
        return
      }

      try {
        setIsLoading(true)
        setError('')

        const [userCollections, userLibrary] =
          await Promise.all([
            getUserCollections(userId),
            getUserLibrary(userId),
          ])

        if (isActive) {
          setCollections(
            sortCollections(userCollections),
          )
          setLibraryBooks(userLibrary)
        }
      } catch (loadError) {
        console.error(
          'Unable to load collections:',
          loadError,
        )

        if (isActive) {
          setError(
            'Impossible de charger tes collections pour le moment.',
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
  }, [userId])

  async function handleCreateCollection(collection) {
    if (!userId) {
      return false
    }

    try {
      setIsSubmitting(true)
      setError('')

      await createCollection(userId, collection)

      const userCollections = await getUserCollections(
        userId,
      )

      setCollections(sortCollections(userCollections))
      setIsCreateModalOpen(false)

      return true
    } catch (createError) {
      console.error(
        'Unable to create collection:',
        createError,
      )

      setError(
        'Impossible de créer cette collection pour le moment.',
      )

      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteCollection() {
    if (!userId || !collectionToDelete?.id) {
      return
    }

    try {
      setIsDeleting(true)
      setError('')

      await deleteCollection(
        userId,
        collectionToDelete.id,
      )

      setCollections((currentCollections) =>
        currentCollections.filter(
          (collection) =>
            collection.id !== collectionToDelete.id,
        ),
      )

      setCollectionToDelete(null)
    } catch (deleteError) {
      console.error(
        'Unable to delete collection:',
        deleteError,
      )

      setError(
        'Impossible de supprimer cette collection pour le moment.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleUpdateCollection(collectionData) {
    if (!userId || !collectionToEdit?.id) {
      return false
    }

    try {
      setIsSavingEdit(true)
      setError('')

      await updateCollection(
        userId,
        collectionToEdit.id,
        collectionData,
      )

      const updatedAt = Date.now()

      setCollections((currentCollections) =>
        currentCollections.map((collection) =>
          collection.id === collectionToEdit.id
            ? {
                ...collection,
                name: collectionData.name,
                description:
                  collectionData.description || '',
                icon: collectionData.icon,
                updatedAt,
              }
            : collection,
        ),
      )

      setCollectionToEdit(null)

      return true
    } catch (updateError) {
      console.error(
        'Unable to update collection:',
        updateError,
      )

      setError(
        'Impossible de modifier cette collection pour le moment.',
      )

      return false
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleTogglePinned(collectionToPin) {
    if (!userId || !collectionToPin?.id) {
      return
    }

    const nextPinned = !collectionToPin.pinned

    try {
      setError('')

      await updateCollectionPinned(
        userId,
        collectionToPin.id,
        nextPinned,
      )

      const updatedAt = Date.now()

      setCollections((currentCollections) =>
        sortCollections(
          currentCollections.map((collection) => {
            if (collection.id !== collectionToPin.id) {
              return collection
            }

            return {
              ...collection,
              pinned: nextPinned,
              updatedAt,
            }
          }),
        ),
      )
    } catch (pinError) {
      console.error(
        'Unable to update collection pin:',
        pinError,
      )

      setError(
        'Impossible de mettre à jour cette collection pour le moment.',
      )
    }
  }

  const libraryBooksById = useMemo(() => {
    return new Map(
      libraryBooks.map((book) => [
        getBookId(book),
        book,
      ]),
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

  function openCreateModal() {
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
  }

  function openDeleteModal(collection) {
    setCollectionToDelete(collection)
  }

  function closeDeleteModal() {
    setCollectionToDelete(null)
  }

  function openEditModal(collection) {
    setCollectionToEdit(collection)
  }

  function closeEditModal() {
    setCollectionToEdit(null)
  }

  return {
    user,

    collections,
    isLoading,
    error,

    isCreateModalOpen,
    isSubmitting,

    collectionToDelete,
    isDeleting,

    collectionToEdit,
    isSavingEdit,

    loadCollections,
    handleCreateCollection,
    handleDeleteCollection,
    handleUpdateCollection,
    handleTogglePinned,
    getCollectionPreviewBooks,

    openCreateModal,
    closeCreateModal,
    openDeleteModal,
    closeDeleteModal,
    openEditModal,
    closeEditModal,
  }
}

export default useCollections
