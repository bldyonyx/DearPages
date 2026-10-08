
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { dashboardLarge } from './dashboardResponsive.js'

const CIRCLE_RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

function ReadingGoal({
  completedBooks,
  goal,
}) {
  const percentage = goal > 0
    ? Math.min(
        Math.max(
          Math.round((completedBooks / goal) * 100),
          0
        ),
        100
      )
    : 0

  const [animatedPercentage, setAnimatedPercentage] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    const prefersReducedMotion = mediaQuery.matches
    setReducedMotion(prefersReducedMotion)

    if (prefersReducedMotion) {
      setAnimatedPercentage(percentage)
      return
    }

    setAnimatedPercentage(0)

    const timeout = window.setTimeout(() => {
      setAnimatedPercentage(percentage)
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [percentage])

  const strokeDashoffset =
    CIRCUMFERENCE * (1 - animatedPercentage / 100)

  return (
    <Link
      to="/library?status=finished"
      aria-label="Voir les livres terminés"
      className={`
        flex h-full flex-col
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        p-5
        transition-[transform,box-shadow] duration-200 ease-out
        hover:-translate-y-0.5
        hover:shadow-[0_8px_24px_rgba(83,55,76,0.08)]
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-olive/30
        md:p-6
        ${dashboardLarge.card}
      `}
    >
      {/* En-tête */}
      <div className="shrink-0">
        <h2
          className={`
            font-heading text-2xl font-bold text-darkwood
            ${dashboardLarge.title}
          `}
        >
          Objectif de lecture
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          Ta progression cette année.
        </p>
      </div>

      {/* Progression centrée dans l'espace restant */}
      <div
        className={`
          flex flex-1 flex-col items-center justify-center
          gap-4 py-6
          sm:gap-5
          [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-6
          [@media_(min-width:2200px)_and_(min-height:1100px)]:py-8
          [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-8
          ${dashboardLarge.stackGap}
        `}
      >
        {/* Cercle de progression */}
        <div
          className="
            relative h-36 w-36 shrink-0
            sm:h-48 sm:w-48
            [@media_(min-width:2200px)_and_(min-height:1100px)]:h-56
            [@media_(min-width:2200px)_and_(min-height:1100px)]:w-56
            [@media_(min-width:2400px)_and_(min-height:1300px)]:h-64
            [@media_(min-width:2400px)_and_(min-height:1300px)]:w-64
          "
        >
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            {/* Cercle de fond */}
            <circle
              cx="50"
              cy="50"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke="rgba(69, 50, 40, 0.1)"
              strokeWidth="7"
            />

            {/* Progression animée */}
            <circle
              cx="50"
              cy="50"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke="var(--color-sage)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: reducedMotion
                  ? 'none'
                  : 'stroke-dashoffset 1400ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>

          {/* Contenu au centre */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-heading text-darkwood">
              <span className="text-4xl font-bold [@media_(min-width:2200px)_and_(min-height:1100px)]:text-5xl [@media_(min-width:2400px)_and_(min-height:1300px)]:text-6xl">
                {completedBooks}
              </span>

              <span className="mx-2 text-lg text-darkwood/40 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-2xl [@media_(min-width:2400px)_and_(min-height:1300px)]:mx-3">
                /
              </span>

              <span className="text-xl [@media_(min-width:2200px)_and_(min-height:1100px)]:text-2xl [@media_(min-width:2400px)_and_(min-height:1300px)]:text-3xl">
                {goal}
              </span>
            </div>

            <p className="mt-1 font-ui text-sm text-darkwood/50 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-2 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg">
              {percentage} %
            </p>
          </div>
        </div>

        {/* Livres terminés */}
        <p className="text-center font-ui text-xs text-darkwood/60 sm:text-sm [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg">
          {completedBooks} livre{completedBooks > 1 ? 's' : ''}{' '}
          terminé{completedBooks > 1 ? 's' : ''} cette année
        </p>
      </div>
    </Link>
  )
}

export default ReadingGoal
