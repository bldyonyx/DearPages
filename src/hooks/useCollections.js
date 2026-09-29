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

function useCollections() {
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

  const loadCollections = useCallback(async () => {
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
        loadError,
      )

      setError(
        'Impossible de charger tes collections pour le moment.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid])

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
        user.uid,
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
    if (!user?.uid || !collectionToDelete?.id) {
      return
    }

    try {
      setIsDeleting(true)
      setError('')

      await deleteCollection(
        user.uid,
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
    if (!user?.uid || !collectionToEdit?.id) {
      return false
    }

    try {
      setIsSavingEdit(true)
      setError('')

      await updateCollection(
        user.uid,
        collectionToEdit.id,
        collectionData,
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
              : collection,
          ),
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
    if (!user?.uid || !collectionToPin?.id) {
      return
    }

    const nextPinned = !collectionToPin.pinned

    try {
      setError('')

      await updateCollectionPinned(
        user.uid,
        collectionToPin.id,
        nextPinned,
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
              : collection,
          ),
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