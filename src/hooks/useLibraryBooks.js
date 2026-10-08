import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getUserLibrary } from '../services/libraryService.js'

/**
 * Loads the authenticated user's Firebase library books.
 *
 * The hook owns only the asynchronous data-loading state for MyLibrary:
 * stored books, loading status, and the user-facing load error. It preserves
 * an `isActive` guard so late Firebase responses cannot update state after the
 * page unmounts or the authenticated user changes.
 *
 * @param {string|undefined} userId - Firebase Authentication user ID.
 * @returns {{
 *   books: Object[],
 *   isLoading: boolean,
 *   error: string,
 * }} Library books and loading state for the current user.
 */
function useLibraryBooks(userId) {
  const { t } = useTranslation()
  const [books, setBooks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) {
      return
    }

    let isActive = true

    async function loadLibrary() {
      try {
        setIsLoading(true)
        setError('')

        const libraryBooks = await getUserLibrary(userId)

        if (isActive) {
          setBooks(libraryBooks)
        }
      } catch (loadError) {
        console.error(
          'Unable to load library:',
          loadError
        )

        if (isActive) {
          setError(
            t('libraryPage.loadError')
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadLibrary()

    return () => {
      isActive = false
    }
  }, [userId, t])

  return {
    books,
    isLoading,
    error,
  }
}

export default useLibraryBooks
