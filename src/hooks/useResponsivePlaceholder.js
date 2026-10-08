import {
  useCallback,
  useLayoutEffect,
  useState,
} from 'react'

function getElementWidth(element) {
  return element?.getBoundingClientRect().width || 0
}

function useResponsivePlaceholder(
  fullPlaceholder,
  {
    shortPlaceholder = fullPlaceholder,
    minWidth = 340,
  } = {}
) {
  const [containerElement, setContainerElement] =
    useState(null)
  const [placeholder, setPlaceholder] =
    useState(fullPlaceholder)
  const containerRef = useCallback((element) => {
    setContainerElement(element)
  }, [])

  useLayoutEffect(() => {
    const element = containerElement

    if (!element) {
      return undefined
    }

    function updatePlaceholder() {
      const nextPlaceholder =
        getElementWidth(element) >= minWidth
          ? fullPlaceholder
          : shortPlaceholder

      setPlaceholder(nextPlaceholder)
    }

    updatePlaceholder()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePlaceholder)

      return () => {
        window.removeEventListener('resize', updatePlaceholder)
      }
    }

    const observer = new ResizeObserver(updatePlaceholder)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [
    containerElement,
    fullPlaceholder,
    minWidth,
    shortPlaceholder,
  ])

  return { containerRef, placeholder }
}

export default useResponsivePlaceholder
