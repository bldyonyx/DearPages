import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

const AUTO_ROTATION_INTERVAL_MS = 5000
export const MAX_VISIBLE_COVERS = 3

function getVisibleCurrentReads(books, activeIndex) {
  const visibleCount = Math.min(
    MAX_VISIBLE_COVERS,
    books.length
  )

  return Array.from({ length: visibleCount }, (_, stackIndex) => {
    const bookIndex = (activeIndex + stackIndex) % books.length

    return {
      book: books[bookIndex],
      bookIndex,
      stackIndex,
    }
  })
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(() => {
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
      ) {
        return false
      }

      return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    })

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined
    }

    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    function handleChange(event) {
      setPrefersReducedMotion(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)

      return () => {
        mediaQuery.removeEventListener(
          'change',
          handleChange
        )
      }
    }

    mediaQuery.addListener(handleChange)

    return () => {
      mediaQuery.removeListener(handleChange)
    }
  }, [])

  return prefersReducedMotion
}

export function useCurrentlyReadingCarousel(
  books,
  onSelectionChange
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()
  const boundedActiveIndex =
    books.length > 0 ? activeIndex % books.length : 0
  const currentBook = books[boundedActiveIndex] || books[0]

  const visibleBooks = useMemo(
    () => getVisibleCurrentReads(books, boundedActiveIndex),
    [boundedActiveIndex, books]
  )

  const navigateToIndex = useCallback(
    (nextIndex) => {
      if (books.length === 0) return

      setActiveIndex(
        ((nextIndex % books.length) + books.length) %
          books.length
      )
      onSelectionChange()
    },
    [books.length, onSelectionChange]
  )

  const navigateBy = useCallback(
    (step) => {
      navigateToIndex(boundedActiveIndex + step)
    },
    [boundedActiveIndex, navigateToIndex]
  )

  useEffect(() => {
    if (books.length <= 1 || prefersReducedMotion) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setActiveIndex(
        (currentIndex) =>
          (currentIndex + 1) % books.length
      )
      onSelectionChange()
    }, AUTO_ROTATION_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [
    boundedActiveIndex,
    books.length,
    onSelectionChange,
    prefersReducedMotion,
  ])

  return {
    boundedActiveIndex,
    currentBook,
    navigateBy,
    navigateToIndex,
    prefersReducedMotion,
    visibleBooks,
  }
}
