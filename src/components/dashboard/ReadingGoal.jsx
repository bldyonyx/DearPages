import { Link } from 'react-router-dom'

import { dashboardLarge } from './dashboardResponsive.js'

function ReadingGoal({
  completedBooks,
  goal,
}) {
  const percentage = Math.min(
    Math.round((completedBooks / goal) * 100),
    100
  )

  return (
    <Link
      to="/library?status=finished"
      aria-label="Voir les livres terminés"
      className={`
        block h-full
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        p-5
        transition-all duration-200
        hover:-translate-y-0.5
        hover:shadow-[0_8px_24px_rgba(83,55,76,0.08)]
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-olive/30
        md:p-6
        ${dashboardLarge.card}
      `}
    >
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

      <div
        className={`
          mt-4 flex flex-col items-center justify-center
          sm:mt-6
          ${dashboardLarge.stackGap}
          [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
          [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
        `}
      >
        {/* Cercle de progression */}
        <div
          className="
            relative h-36 w-36
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
              r="44"
              fill="none"
              stroke="rgba(69, 50, 40, 0.1)"
              strokeWidth="7"
            />

            {/* Progression */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--color-sage)"
              strokeWidth="7"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${percentage} 100`}
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

        <p className="mt-4 text-center font-ui text-xs text-darkwood/60 sm:mt-5 sm:text-sm [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6 [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-8 [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg">
          {completedBooks} livre{completedBooks > 1 ? 's' : ''}{' '}
          terminé{completedBooks > 1 ? 's' : ''} cette année
        </p>
      </div>
    </Link>
  )
}

export default ReadingGoal