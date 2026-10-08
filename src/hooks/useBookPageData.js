import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getBookById } from '../services/booksApi.js'
import { getOpenLibraryBookById } from '../services/trendingBooksApi.js'
import {
  BOOK_API_SOURCES,
  getBookApiSource,
  getRouteStateBook,
  mergeBookDetails,
  normalizeBookForPage,
} from '../utils/bookPageUtils.js'

async function getBookDetails(bookId) {
  if (getBookApiSource(bookId) === BOOK_API_SOURCES.OPEN_LIBRARY) {
    return getOpenLibraryBookById(bookId)
  }

  return getBookById(bookId)
}

export function useBookPageData({
  bookId,
  routeKey,
  routeState,
}) {
  const { t } = useTranslation()
  const routeBook = getRouteStateBook(routeState, bookId)

  const [bookState, setBookState] = useState(() => ({
    bookId,
    book: normalizeBookForPage(routeBook),
  }))

  const [isBookLoading, setIsBookLoading] = useState(true)
  const [error, setError] = useState('')

  const isCurrentBook = bookState.bookId === bookId
  const book = isCurrentBook
    ? bookState.book
    : normalizeBookForPage(routeBook)

  useEffect(() => {
    let isCancelled = false

    async function loadBookDetails() {
      const optimisticBook = getRouteStateBook(
        routeState,
        bookId
      )

      setBookState({
        bookId,
        book: normalizeBookForPage(optimisticBook),
      })

      setIsBookLoading(true)
      setError('')

      try {
        const bookData = await getBookDetails(bookId)

        if (isCancelled) {
          return
        }

        setBookState((currentState) => ({
          bookId,
          book: mergeBookDetails(
            currentState.bookId === bookId
              ? currentState.book
              : normalizeBookForPage(optimisticBook),
            bookData
          ),
        }))
      } catch (fetchError) {
        console.error(fetchError)

        if (!isCancelled) {
          setError(t('bookPage.loadError'))
        }
      } finally {
        if (!isCancelled) {
          setIsBookLoading(false)
        }
      }
    }

    loadBookDetails()

    return () => {
      isCancelled = true
    }
  }, [bookId, routeKey, routeState, t])

  return {
    book,
    isBookLoading:
      !isCurrentBook ? true : isBookLoading,
    error: isCurrentBook ? error : '',
  }
}
