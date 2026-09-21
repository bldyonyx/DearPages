const QUICK_GOALS = [12, 24, 36, 50]

function ReadingGoalStep({
  annualGoal,
  validationMessage,
  onBack,
  onGoalChange,
  onNext,
}) {
  return (
    <div>
      <div>
        <p className="font-handwritten text-xl text-walnut sm:text-2xl">
          ton rythme de lecture
        </p>

        <h1
          className="
            mt-2 max-w-2xl font-heading text-3xl
            font-bold leading-tight text-darkwood sm:text-5xl
          "
        >
          Combien de livres aimerais-tu lire cette année ?
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-darkwood/65 sm:text-base">
          Choisis un objectif confortable. Tu pourras l'ajuster plus
          tard depuis les paramètres.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {QUICK_GOALS.map((goal) => {
          const isSelected = Number(annualGoal) === goal

          return (
            <button
              key={goal}
              type="button"
              onClick={() => onGoalChange(goal)}
              aria-pressed={isSelected}
              className={[
                'min-w-14 rounded-2xl border px-4 py-3 sm:min-w-16',
                'text-sm font-bold transition',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-olive/35',
                isSelected
                  ? 'border-olive bg-lime text-darkwood shadow-sm'
                  : 'border-walnut/20 bg-mintcream text-darkwood/70 hover:border-olive/50 hover:text-darkwood',
              ].join(' ')}
            >
              {goal}
            </button>
          )
        })}
      </div>

      <label className="mt-8 block max-w-xs">
        <span className="text-sm font-bold text-darkwood">
          Valeur personnalisée
        </span>

        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="200"
          step="1"
          value={annualGoal || ''}
          onChange={(event) => onGoalChange(event.target.value)}
          className="
            mt-2 w-full rounded-2xl border border-walnut/20
            bg-white/40 px-4 py-3
            text-sm font-bold text-darkwood outline-none
            transition placeholder:text-walnut/45
            focus:border-olive/60
            focus:ring-2 focus:ring-lime/40
          "
        />
      </label>

      <div className="mt-4 min-h-6">
        {validationMessage && (
          <p className="text-sm font-bold text-walnut">
            {validationMessage}
          </p>
        )}
      </div>

      <div
        className="
          mt-8 flex flex-col-reverse gap-3
          sm:flex-row sm:justify-between
        "
      >
        <button
          type="button"
          onClick={onBack}
          className="
            rounded-2xl border border-walnut/20
            bg-cream px-5 py-3
            text-sm font-bold text-darkwood
            transition hover:border-walnut/40
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
          "
        >
          Retour
        </button>

        <button
          type="button"
          onClick={onNext}
          className="
            rounded-2xl bg-lime px-5 py-3
            text-sm font-bold text-darkwood
            transition hover:-translate-y-0.5 hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
          "
        >
          Continuer
        </button>
      </div>
    </div>
  )
}

export default ReadingGoalStep
