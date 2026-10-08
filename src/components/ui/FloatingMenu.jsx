import { useLayoutEffect, useState } from 'react'

import Portal from './Portal.jsx'

const VIEWPORT_GAP = 12

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getMenuPosition({
  anchor,
  align,
  matchAnchorWidth,
  offset,
}) {
  const rect = anchor.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const left =
    align === 'right'
      ? viewportWidth - rect.right
      : clamp(
          rect.left,
          VIEWPORT_GAP,
          viewportWidth - VIEWPORT_GAP
        )

  return {
    position: 'fixed',
    top: rect.bottom + offset,
    ...(align === 'right' ? { right: left } : { left }),
    width: matchAnchorWidth ? rect.width : undefined,
  }
}

function FloatingMenu({
  anchorRef,
  children,
  className,
  align = 'left',
  matchAnchorWidth = false,
  offset = 8,
  menuRef,
  role,
  ariaLabel,
  ...restProps
}) {
  const [style, setStyle] = useState(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current

    if (!anchor) {
      return undefined
    }

    function updatePosition() {
      setStyle(
        getMenuPosition({
          anchor,
          align,
          matchAnchorWidth,
          offset,
        })
      )
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [align, anchorRef, matchAnchorWidth, offset])

  if (!style) {
    return null
  }

  return (
    <Portal>
      <div
        ref={menuRef}
        role={role}
        aria-label={ariaLabel}
        {...restProps}
        className={className}
        style={style}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </Portal>
  )
}

export default FloatingMenu
