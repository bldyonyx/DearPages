import { AVAILABLE_GENRES } from '../../constants/genres.js'

function GenresStep({
  selectedGenres,
  validationMessage,
  onBack,
  onNext,
  onToggleGenre,
}) {
  return (
    <div>
      <div>
        <p className="font-handwritten text-xl text-walnut sm:text-2xl">
          tes envies du moment
        </p>

        <h1
          className="
            mt-2 font-heading text-3xl font-bold
            leading-tight text-darkwood sm:text-5xl
          "
        >
          Qu'est-ce que tu aimes lire ?
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-darkwood/65 sm:text-base">
          Choisis quelques genres. Ils serviront plus tard à
          personnaliser tes recommandations.
        </p>
      </div>

      <div
        className="
          mt-7 flex flex-wrap gap-2.5
          sm:gap-3
        "
      >
        {AVAILABLE_GENRES.map((genre) => {
          const isSelected = selectedGenres.includes(genre.subject)

          return (
            <button
              key={genre.subject}
              type="button"
              onClick={() => onToggleGenre(genre.subject)}
              aria-pressed={isSelected}
              className={[
                'rounded-full border px-3 py-2 text-xs font-bold sm:px-4 sm:py-2.5 sm:text-sm',
                'transition focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-olive/35',
                isSelected
                  ? 'border-olive bg-lime text-darkwood shadow-sm'
                  : 'border-walnut/20 bg-mintcream text-darkwood/70 hover:border-olive/50 hover:text-darkwood',
              ].join(' ')}
            >
              {genre.label}
            </button>
          )
        })}
      </div>

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

export default GenresStep
