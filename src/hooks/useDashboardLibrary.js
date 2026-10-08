import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getUserLibrary,
  updateBookStatus,
} from '../services/libraryService.js'

/**
 * Loads and manages the dashboard's Firebase-backed library state.
 *
 * This hook owns the dashboard-specific async lifecycle: initial library
 * loading, the user-facing load error, the currently updating book ID, and the
 * local state merge that keeps the dashboard in sync after a status change.
 * It keeps an `isActive` cleanup guard so late Firebase responses cannot write
 * state after the dashboard unmounts or the authenticated user changes.
 *
 * @param {string|undefined} userId - Firebase Authentication user ID.
 * @returns {{
 *   library: Object[],
 *   isLibraryLoading: boolean,
 *   libraryError: string,
 *   updatingBookId: string|null,
 *   handleDashboardStatusChange: Function,
 * }} Dashboard library state and actions.
 */
function useDashboardLibrary(userId) {
  const { t } = useTranslation()
  const [library, setLibrary] = useState([])
  const [isLibraryLoading, setIsLibraryLoading] =
    useState(true)
  const [libraryError, setLibraryError] = useState('')
  const [updatingBookId, setUpdatingBookId] = useState(null)

  useEffect(() => {
    if (!userId) return

    let isActive = true

    async function loadDashboardLibrary() {
      setIsLibraryLoading(true)
      setLibraryError('')

      try {
        const libraryBooks = await getUserLibrary(userId)

        if (isActive) {
          setLibrary(libraryBooks)
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (isActive) {
          setLibraryError(
            t('dashboard.loadError')
          )
        }
      } finally {
        if (isActive) {
          setIsLibraryLoading(false)
        }
      }
    }

    loadDashboardLibrary()

    return () => {
      isActive = false
    }
  }, [userId, t])

  async function handleDashboardStatusChange(bookId, status) {
    if (!userId || !bookId || !status) return

    setUpdatingBookId(bookId)

    try {
      const updatedBook = await updateBookStatus(
        userId,
        bookId,
        status
      )

      if (!updatedBook) return

      setLibrary((currentLibrary) =>
        currentLibrary.map((book) => {
          if (book.googleBooksId !== bookId) {
            return book
          }

          return {
            ...book,
            ...updatedBook,
          }
        })
      )
    } catch (firebaseError) {
      console.error(firebaseError)
      throw firebaseError
    } finally {
      setUpdatingBookId(null)
    }
  }

  return {
    library,
    isLibraryLoading,
    libraryError,
    updatingBookId,
    handleDashboardStatusChange,
  }
}

export default useDashboardLibrary
