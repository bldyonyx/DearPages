import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import {
  clearCollectionBooks,
  getUserCollection,
  removeBookFromCollection,
  updateCollection,
} from '../services/collectionsService.js'
import { getUserLibrary } from '../services/libraryService.js'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function useCollectionPage() {
  const { t } = useTranslation()
  const { id: collectionId } = useParams()
  const { user } = useAuth()
  const userId = user?.uid

  const [collection, setCollection] = useState(null)
  const [libraryBooks, setLibraryBooks] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [isBooksModalOpen, setIsBooksModalOpen] =
    useState(false)

  const [collectionToEdit, setCollectionToEdit] =
    useState(null)
  const [isSavingCollection, setIsSavingCollection] =
    useState(false)

  const [isClearModalOpen, setIsClearModalOpen] =
    useState(false)
  const [isClearingCollection, setIsClearingCollection] =
    useState(false)
  const [clearCollectionError, setClearCollectionError] =
    useState('')

  const [bookToRemove, setBookToRemove] = useState(null)
  const [removingBookId, setRemovingBookId] = useState('')

  const [
    isHeaderActionsMenuOpen,
    setIsHeaderActionsMenuOpen,
  ] = useState(false)

  const headerActionsMenuRef = useRef(null)

  const loadCollectionPage = useCallback(async () => {
    if (!userId || !collectionId) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const [collectionData, userLibrary] =
        await Promise.all([
          getUserCollection(userId, collectionId),
          getUserLibrary(userId),
        ])

      setCollection(collectionData)
      setLibraryBooks(userLibrary)
    } catch (loadError) {
      console.error(
        'Unable to load collection page:',
        loadError,
      )

      setError(
        t('collectionPage.loadError'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [collectionId, userId, t])

  useEffect(() => {
    let isActive = true

    async function loadActiveCollectionPage() {
      if (!userId || !collectionId) {
        return
      }

      try {
        setIsLoading(true)
        setError('')

        const [collectionData, userLibrary] =
          await Promise.all([
            getUserCollection(userId, collectionId),
            getUserLibrary(userId),
          ])

        if (isActive) {
          setCollection(collectionData)
          setLibraryBooks(userLibrary)
        }
      } catch (loadError) {
        console.error(
          'Unable to load collection page:',
          loadError,
        )

        if (isActive) {
          setError(
            t('collectionPage.loadError'),
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
  }, [collectionId, userId, t])

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
        handleClickOutside,
      )
    }
  }, [])

  const collectionBookIds = useMemo(
    () => Object.keys(collection?.books || {}),
    [collection],
  )

  const collectionBooks = useMemo(() => {
    if (collectionBookIds.length === 0) {
      return []
    }

    const collectionBookIdsSet = new Set(collectionBookIds)

    return libraryBooks.filter((book) =>
      collectionBookIdsSet.has(getBookId(book)),
    )
  }, [collectionBookIds, libraryBooks])

  function openBooksModal() {
    setIsBooksModalOpen(true)
  }

  function closeBooksModal() {
    setIsBooksModalOpen(false)
  }

  function handleBooksSaved(nextBooks) {
    setCollection((currentCollection) => {
      if (!currentCollection) {
        return currentCollection
      }

      return {
        ...currentCollection,
        books: nextBooks,
        updatedAt: Date.now(),
      }
    })
  }

  function openEditCollectionModal() {
    setIsHeaderActionsMenuOpen(false)
    setCollectionToEdit(collection)
  }

  function closeEditCollectionModal() {
    if (isSavingCollection) {
      return
    }

    setCollectionToEdit(null)
  }

  async function handleUpdateCollection(collectionData) {
    if (
      !userId ||
      !collectionToEdit?.id ||
      isSavingCollection
    ) {
      return
    }

    try {
      setIsSavingCollection(true)
      setError('')

      await updateCollection(
        userId,
        collectionToEdit.id,
        collectionData,
      )

      setCollection((currentCollection) => {
        if (!currentCollection) {
          return currentCollection
        }

        return {
          ...currentCollection,
          ...collectionData,
          updatedAt: Date.now(),
        }
      })

      setCollectionToEdit(null)
    } catch (updateError) {
      console.error(
        'Unable to update collection:',
        updateError,
      )

      setError(
        t('collectionPage.updateError'),
      )
    } finally {
      setIsSavingCollection(false)
    }
  }

  async function handleRemoveBookFromCollection(bookId) {
    if (!userId || !collection?.id || !bookId) {
      return false
    }

    try {
      setRemovingBookId(bookId)
      setError('')

      await removeBookFromCollection(
        userId,
        collection.id,
        bookId,
      )

      setCollection((currentCollection) => {
        if (!currentCollection) {
          return currentCollection
        }

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
        removeError,
      )

      setError(
        t('collectionPage.removeError'),
      )

      return false
    } finally {
      setRemovingBookId('')
    }
  }

  function openRemoveBookModal(book) {
    setBookToRemove(book)
  }

  function closeRemoveBookModal() {
    if (removingBookId) {
      return
    }

    setBookToRemove(null)
  }

  async function handleConfirmRemoveBook() {
    if (removingBookId) {
      return
    }

    const bookId = bookToRemove
      ? getBookId(bookToRemove)
      : ''

    const wasRemoved =
      await handleRemoveBookFromCollection(bookId)

    if (wasRemoved) {
      setBookToRemove(null)
    }
  }

  function openClearModal() {
    setClearCollectionError('')
    setIsClearModalOpen(true)
  }

  function openClearModalFromMenu() {
    setIsHeaderActionsMenuOpen(false)
    openClearModal()
  }

  function closeClearModal() {
    if (isClearingCollection) {
      return
    }

    setIsClearModalOpen(false)
    setClearCollectionError('')
  }

  async function handleClearCollection() {
    if (
      !userId ||
      !collection?.id ||
      isClearingCollection
    ) {
      return
    }

    try {
      setIsClearingCollection(true)
      setClearCollectionError('')

      await clearCollectionBooks(
        userId,
        collection.id,
      )

      setCollection((currentCollection) => {
        if (!currentCollection) {
          return currentCollection
        }

        return {
          ...currentCollection,
          books: {},
        }
      })

      setIsClearModalOpen(false)
    } catch (clearError) {
      console.error(
        'Unable to clear collection:',
        clearError,
      )

      setClearCollectionError(
        t('collectionPage.clearError'),
      )
    } finally {
      setIsClearingCollection(false)
    }
  }

  function toggleHeaderActionsMenu() {
    setIsHeaderActionsMenuOpen((current) => !current)
  }

  function closeHeaderActionsMenu() {
    setIsHeaderActionsMenuOpen(false)
  }

  return {
    user,

    collection,
    libraryBooks,
    collectionBooks,

    isLoading,
    error,

    isBooksModalOpen,

    collectionToEdit,
    isSavingCollection,

    bookToRemove,
    removingBookId,

    isClearModalOpen,
    isClearingCollection,
    clearCollectionError,

    isHeaderActionsMenuOpen,
    headerActionsMenuRef,

    loadCollectionPage,

    openBooksModal,
    closeBooksModal,
    handleBooksSaved,

    openEditCollectionModal,
    closeEditCollectionModal,
    handleUpdateCollection,

    openRemoveBookModal,
    closeRemoveBookModal,
    handleConfirmRemoveBook,

    openClearModal,
    openClearModalFromMenu,
    closeClearModal,
    handleClearCollection,

    toggleHeaderActionsMenu,
    closeHeaderActionsMenu,
  }
}

export default useCollectionPage
