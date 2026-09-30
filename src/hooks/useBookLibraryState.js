import { useEffect, useMemo, useState } from 'react'

import {
  addBookToLibrary,
  BOOK_STATUSES,
  getLibraryBook,
  removeBookFromLibrary,
  updateBookStatus,
} from '../services/libraryService.js'
import { getRouteStateLibraryBook } from '../utils/bookPageUtils.js'

export function useBookLibraryState({
  book,
  bookId,
  routeKey,
  routeState,
  userId,
}) {
  const optimisticLibraryBook = useMemo(
    () => getRouteStateLibraryBook(routeState, bookId),
    [bookId, routeState]
  )
  const [libraryState, setLibraryState] = useState(() => ({
    bookId,
    routeKey,
    libraryBook: optimisticLibraryBook,
  }))
  const [loadingState, setLoadingState] = useState(() => ({
    bookId,
    routeKey,
    isLoading: Boolean(userId),
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [removeModalBookId, setRemoveModalBookId] =
    useState(null)
  const [libraryErrorState, setLibraryErrorState] =
    useState(() => ({
      bookId,
      routeKey,
      message: '',
    }))

  const isCurrentLibraryState =
    libraryState.bookId === bookId &&
    libraryState.routeKey === routeKey
  const libraryBook =
    isCurrentLibraryState
      ? libraryState.libraryBook
      : optimisticLibraryBook
  const isCurrentLoadingState =
    loadingState.bookId === bookId &&
    loadingState.routeKey === routeKey
  const isLibraryLoading = isCurrentLoadingState
    ? loadingState.isLoading
    : Boolean(userId)
  const isRemoveModalOpen = removeModalBookId === bookId
  const libraryError =
    libraryErrorState.bookId === bookId &&
    libraryErrorState.routeKey === routeKey
      ? libraryErrorState.message
      : ''

  useEffect(() => {
    let isCancelled = false

    if (!userId) {
      return () => {
        isCancelled = true
      }
    }

    async function loadLibraryBook() {
      setLoadingState({
        bookId,
        routeKey,
        isLoading: true,
      })

      try {
        const storedBook = await getLibraryBook(userId, bookId)

        if (!isCancelled) {
          setLibraryState({
            bookId,
            routeKey,
            libraryBook: storedBook,
          })
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (!isCancelled) {
          setLibraryErrorState({
            bookId,
            routeKey,
            message:
              'Impossible de charger ta bibliothèque pour ce livre.',
          })
        }
      } finally {
        if (!isCancelled) {
          setLoadingState({
            bookId,
            routeKey,
            isLoading: false,
          })
        }
      }
    }

    loadLibraryBook()

    return () => {
      isCancelled = true
    }
  }, [bookId, routeKey, routeState, userId])

  function setLibraryError(message) {
    setLibraryErrorState({
      bookId,
      routeKey,
      message,
    })
  }

  function setLibraryBook(nextLibraryBook) {
    setLibraryState((currentState) => {
      const currentLibraryBook =
        currentState.bookId === bookId &&
        currentState.routeKey === routeKey
          ? currentState.libraryBook
          : optimisticLibraryBook

      return {
        bookId,
        routeKey,
        libraryBook:
          typeof nextLibraryBook === 'function'
            ? nextLibraryBook(currentLibraryBook)
            : nextLibraryBook,
      }
    })
  }

  async function handleAddToLibrary() {
    if (!userId || !book) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await addBookToLibrary(
        userId,
        book,
        BOOK_STATUSES.TO_READ
      )

      const storedBook = await getLibraryBook(
        userId,
        book.googleBooksId
      )

      setLibraryBook(storedBook)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible d’ajouter ce livre à ta bibliothèque.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!userId || !book || !newStatus) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      if (libraryBook) {
        const updatedBook = await updateBookStatus(
          userId,
          book.googleBooksId,
          newStatus
        )

        if (updatedBook) {
          setLibraryBook((currentBook) => ({
            ...currentBook,
            ...updatedBook,
          }))
        }
      } else {
        await addBookToLibrary(userId, book, newStatus)

        const storedBook = await getLibraryBook(
          userId,
          book.googleBooksId
        )

        setLibraryBook(storedBook)
      }
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible de modifier le statut de ce livre.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenRemoveModal() {
    setLibraryError('')
    setRemoveModalBookId(bookId)
  }

  function handleCloseRemoveModal() {
    if (isSaving) {
      return
    }

    setRemoveModalBookId(null)
  }

  async function handleConfirmRemove() {
    if (!userId || !book || !libraryBook) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await removeBookFromLibrary(userId, book.googleBooksId)

      setLibraryBook(null)
      setRemoveModalBookId(null)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible de retirer ce livre de ta bibliothèque.'
      )

      setRemoveModalBookId(null)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    libraryBook,
    setLibraryBook,
    isLibraryLoading,
    isSaving,
    isRemoveModalOpen,
    libraryError,
    handleAddToLibrary,
    handleStatusChange,
    handleOpenRemoveModal,
    handleCloseRemoveModal,
    handleConfirmRemove,
  }
}
