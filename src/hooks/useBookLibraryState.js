import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  addBookToLibrary,
  BOOK_STATUSES,
  getLibraryBook,
  removeBookFromLibrary,
  updateBookStatus,
  updateBookFinishedAt,
  updateBookAbandonedAt,
} from '../services/libraryService.js'
import {
  getBookRouteId,
  getRouteStateLibraryBook,
} from '../utils/bookPageUtils.js'

export function useBookLibraryState({
  book,
  bookId,
  routeKey,
  routeState,
  userId,
}) {
  const { t } = useTranslation()
  const dateScope = useMemo(() => ({ bookId, routeKey, userId }), [bookId, routeKey, userId])
  const dateControl = useRef(null)
  const [dateState, setDateState] = useState(() => ({ scope: dateScope, saving: false, message: '' }))
  const isReadingDateSaving = dateState.scope === dateScope && dateState.saving
  useEffect(() => {
    const control = { scope: dateScope, active: true, locked: false }
    dateControl.current = control
    return () => { control.active = false }
  }, [dateScope])
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
  const currentBookId = getBookRouteId(book) || bookId
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
            message: t('bookPage.library.loadError'),
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
  }, [bookId, routeKey, routeState, t, userId])

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

  async function handleReadingDateChange(value) {
    const control = dateControl.current
    const status = libraryBook?.status
    if (!userId || !book || !libraryBook || isLibraryLoading || isSaving || !control?.active ||
        control.scope !== dateScope || control.locked || ![BOOK_STATUSES.FINISHED, BOOK_STATUSES.ABANDONED].includes(status)) return false
    control.locked = true
    setDateState({ scope: dateScope, status, saving: true, message: '' })
    setLibraryError('')
    const finished = status === BOOK_STATUSES.FINISHED
    const field = finished ? 'finishedAt' : 'abandonedAt'
    try {
      await (finished ? updateBookFinishedAt : updateBookAbandonedAt)(userId, currentBookId, value)
      if (!control.active) return false
      setLibraryBook(current => current && current.status === status ? { ...current, [field]: value, updatedAt: Date.now() } : current)
      setDateState({ scope: dateScope, status, saving: true, message: t(value
        ? (finished ? 'bookPage.personal.readingDateSaved' : 'bookPage.personal.abandonedDateSaved')
        : (finished ? 'bookPage.personal.readingDateRemoved' : 'bookPage.personal.abandonedDateRemoved')) })
      return true
    } catch {
      if (control.active) setLibraryError(t(finished ? 'bookPage.personal.readingDateError' : 'bookPage.personal.abandonedDateError'))
      return false
    } finally {
      control.locked = false
      if (control.active) setDateState(current => current.scope === dateScope ? { ...current, saving: false } : current)
    }
  }

  async function handleAddToLibrary() {
    if (!userId || !book || dateControl.current?.locked) {
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
        currentBookId
      )

      setLibraryBook(storedBook)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        t('bookPage.library.addError')
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!userId || !book || !newStatus || dateControl.current?.locked) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      if (libraryBook) {
        const updatedBook = await updateBookStatus(
          userId,
          currentBookId,
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
          currentBookId
        )

        setLibraryBook(storedBook)
      }
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        t('bookPage.library.statusError')
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenRemoveModal() {
    if (isSaving || dateControl.current?.locked) return
    setLibraryError('')
    setRemoveModalBookId(bookId)
  }

  function handleCloseRemoveModal() {
    if (isSaving || dateControl.current?.locked) {
      return
    }

    setRemoveModalBookId(null)
  }

  async function handleConfirmRemove() {
    if (!userId || !book || !libraryBook || dateControl.current?.locked) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await removeBookFromLibrary(userId, currentBookId)

      setLibraryBook(null)
      setRemoveModalBookId(null)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        t('bookPage.library.removeError')
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
    isSaving: isSaving || isReadingDateSaving,
    isReadingDateSaving,
    readingDateMessage: dateState.scope === dateScope && dateState.status === libraryBook?.status ? dateState.message : '',
    handleReadingDateChange,
    isRemoveModalOpen,
    libraryError,
    handleAddToLibrary,
    handleStatusChange,
    handleOpenRemoveModal,
    handleCloseRemoveModal,
    handleConfirmRemove,
  }
}
