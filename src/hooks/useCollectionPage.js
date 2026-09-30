import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import {
  clearCollectionBooks,
  getUserCollection,
  removeBookFromCollection,
} from '../services/collectionsService.js'
import { getUserLibrary } from '../services/libraryService.js'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function useCollectionPage() {
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

  const [
    isHeaderActionsMenuOpen,
    setIsHeaderActionsMenuOpen,
  ] = useState(false)

  const headerActionsMenuRef = useRef(null)

  const loadCollectionPage = useCallback(async () => {
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
        loadError,
      )

      setError(
        'Impossible de charger cette collection pour le moment.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [collectionId, user?.uid])

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
          loadError,
        )

        if (isActive) {
          setError(
            'Impossible de charger cette collection pour le moment.',
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
        'Impossible de retirer ce livre de la collection pour le moment.',
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
      !user?.uid ||
      !collection?.id ||
      isClearingCollection
    ) {
      return
    }

    try {
      setIsClearingCollection(true)
      setClearCollectionError('')

      await clearCollectionBooks(
        user.uid,
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
        'Impossible de vider cette collection pour le moment.',
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