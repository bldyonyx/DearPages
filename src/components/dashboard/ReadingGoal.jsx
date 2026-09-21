function ReadingGoal({
  completedBooks,
  goal,
}) {
  const percentage = Math.min(
    Math.round((completedBooks / goal) * 100),
    100
  )

  return (
    <section className="h-full rounded-3xl border border-darkwood/10 bg-cream/80 p-5 md:p-6">
      <h2 className="font-heading text-2xl font-bold text-darkwood">
        Objectif de lecture
      </h2>

      <p className="mt-1 font-ui text-sm text-darkwood/60">
        Ta progression cette année.
      </p>

      <div className="mt-4 flex flex-col items-center justify-center sm:mt-6">
        {/* Cercle de progression */}
        <div className="relative h-36 w-36 sm:h-48 sm:w-48">
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
              <span className="text-4xl font-bold">
                {completedBooks}
              </span>

              <span className="mx-2 text-lg text-darkwood/40">
                /
              </span>

              <span className="text-xl">
                {goal}
              </span>
            </div>

            <p className="mt-1 font-ui text-sm text-darkwood/50">
              {percentage} %
            </p>
          </div>
        </div>

        <p className="mt-4 text-center font-ui text-xs text-darkwood/60 sm:mt-5 sm:text-sm">
          {completedBooks} livre{completedBooks > 1 ? 's' : ''}{' '}
          terminé{completedBooks > 1 ? 's' : ''} cette année
        </p>
      </div>
    </section>
  )
}

export default ReadingGoal
