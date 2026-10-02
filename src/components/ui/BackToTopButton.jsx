import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const SCROLL_THRESHOLD = 240
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function BackToTopButton() {
  const frameRef = useRef(null)
  const isVisibleRef = useRef(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      const shouldShow = window.scrollY >= SCROLL_THRESHOLD

      frameRef.current = null

      if (isVisibleRef.current === shouldShow) {
        return
      }

      isVisibleRef.current = shouldShow
      setIsVisible(shouldShow)
    }

    const handleScroll = () => {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(updateVisibility)
    }

    updateVisibility()

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  function handleClick() {
    const prefersReducedMotion = window.matchMedia(
      REDUCED_MOTION_QUERY,
    ).matches

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <button
      type="button"
      aria-label="Retour en haut"
      title="Retour en haut"
      onClick={handleClick}
      className={[
        'fixed right-4 z-30',
        'bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]',
        'flex size-11 items-center justify-center',
        'rounded-2xl border border-cream/15',
        'bg-darkwood text-cream',
        'shadow-[0_6px_18px_rgba(69,50,40,0.18)]',
        'transition-[opacity,transform,background-color,border-color,box-shadow]',
        'duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-cream/25',
        'hover:bg-walnut',
        'hover:shadow-[0_8px_22px_rgba(69,50,40,0.24)]',
        'focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-lime',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-mintcream',
        'lg:bottom-8 lg:right-8',
        'motion-reduce:transition-none',
        'motion-reduce:hover:translate-y-0',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0',
      ].join(' ')}
    >
      <ArrowUp
        aria-hidden="true"
        className="size-5"
        strokeWidth={2}
      />
    </button>
  )
}

export default BackToTopButton