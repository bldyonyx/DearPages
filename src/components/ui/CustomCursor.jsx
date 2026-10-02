import { useEffect, useRef, useState } from 'react'

import bearLink from '../../assets/cursors/bear/bear-link.png'
import bearNormal from '../../assets/cursors/bear/bear-normal.png'
import bearText from '../../assets/cursors/bear/bear-text.png'
import bearUnavailable from '../../assets/cursors/bear/bear-unavailable.png'

const HOTSPOT_X = 2
const HOTSPOT_Y = 7

const FINE_POINTER_QUERY = '(pointer: fine) and (hover: hover)'

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  '[role="button"]',
  '[role="link"]',
  'select',
  'summary',
  'label[for]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const TEXT_SELECTOR = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])',
  'textarea',
  '[contenteditable="true"]',
].join(', ')

const UNAVAILABLE_SELECTOR = [
  ':disabled',
  '[aria-disabled="true"]',
  '[data-cursor="unavailable"]',
].join(', ')

const CURSOR_IMAGES = {
  normal: bearNormal,
  link: bearLink,
  text: bearText,
  unavailable: bearUnavailable,
}

function mediaQueryMatches(query) {
  return window.matchMedia(query).matches
}

function getCursorType(target) {
  if (!(target instanceof Element)) {
    return 'normal'
  }

  if (target.closest(UNAVAILABLE_SELECTOR)) {
    return 'unavailable'
  }

  if (target.closest(TEXT_SELECTOR)) {
    return 'text'
  }

  if (target.closest(INTERACTIVE_SELECTOR)) {
    return 'link'
  }

  return 'normal'
}

function CustomCursor() {
  const cursorRef = useRef(null)
  const visibleRef = useRef(false)
  const cursorTypeRef = useRef('normal')

  const [canUseCustomCursor, setCanUseCustomCursor] = useState(() =>
    mediaQueryMatches(FINE_POINTER_QUERY),
  )

  useEffect(() => {
    const finePointerMedia = window.matchMedia(FINE_POINTER_QUERY)

    const syncMediaState = () => {
      setCanUseCustomCursor(finePointerMedia.matches)
    }

    finePointerMedia.addEventListener('change', syncMediaState)

    return () => {
      finePointerMedia.removeEventListener('change', syncMediaState)
    }
  }, [])

  useEffect(() => {
    if (!canUseCustomCursor) {
      return undefined
    }

    const sources = Object.values(CURSOR_IMAGES)

    const preloadedImages = sources.map((src) => {
      const image = new Image()
      image.src = src
      return image
    })

    return () => {
      preloadedImages.forEach((image) => {
        image.onload = null
        image.onerror = null
      })
    }
  }, [canUseCustomCursor])

  useEffect(() => {
    const cursorElement = cursorRef.current

    if (!canUseCustomCursor || !cursorElement) {
      document.documentElement.classList.remove(
        'dp-custom-cursor-active',
      )

      return undefined
    }

    const hideCursor = () => {
      visibleRef.current = false
      cursorElement.style.opacity = '0'

      document.documentElement.classList.remove(
        'dp-custom-cursor-active',
      )
    }

    const showCursor = () => {
      visibleRef.current = true
      cursorElement.style.opacity = '1'

      document.documentElement.classList.add(
        'dp-custom-cursor-active',
      )
    }

    const updateCursorType = (target) => {
      const nextCursorType = getCursorType(target)

      if (cursorTypeRef.current === nextCursorType) {
        return
      }

      cursorTypeRef.current = nextCursorType
      cursorElement.src = CURSOR_IMAGES[nextCursorType]
    }

    const handleMouseMove = (event) => {
      cursorElement.style.transform = `translate3d(${
        event.clientX - HOTSPOT_X
      }px, ${event.clientY - HOTSPOT_Y}px, 0)`

      updateCursorType(event.target)

      if (!visibleRef.current) {
        showCursor()
      }
    }

    const handleMouseLeave = (event) => {
      if (!event.relatedTarget) {
        hideCursor()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hideCursor()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)

    document.documentElement.addEventListener(
      'mouseleave',
      handleMouseLeave,
    )

    window.addEventListener('blur', hideCursor)

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)

      document.documentElement.removeEventListener(
        'mouseleave',
        handleMouseLeave,
      )

      window.removeEventListener('blur', hideCursor)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      document.documentElement.classList.remove(
        'dp-custom-cursor-active',
      )
    }
  }, [canUseCustomCursor])

  if (!canUseCustomCursor) {
    return null
  }

  return (
    <img
      ref={cursorRef}
      src={bearNormal}
      alt=""
      aria-hidden="true"
      draggable="false"
      className="
        fixed
        left-0
        top-0
        z-[2147483647]
        size-8
        pointer-events-none
        select-none
        opacity-0
      "
    />
  )
}

export default CustomCursor