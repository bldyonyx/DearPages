import { AVAILABLE_GENRES } from '../../constants/genres.js'

function CompleteStep({
  annualGoal,
  favoriteGenres,
  onBack,
  onFinish,
}) {
  const selectedGenreLabels = AVAILABLE_GENRES.filter((genre) =>
    favoriteGenres.includes(genre.subject)
  ).map((genre) => genre.label)

  return (
    <div>
      <p className="font-handwritten text-xl text-walnut sm:text-2xl">
        merci ♡
      </p>

      <h1
        className="
          mt-3 font-heading text-3xl font-bold
          leading-tight text-darkwood sm:text-5xl
        "
      >
        Tout est prêt
      </h1>

      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-darkwood/65 sm:text-base">
        Ton espace pourra bientôt utiliser ces choix pour t'aider à
        retrouver des lectures qui collent à tes envies.
      </p>

      <div
        className="
          mt-8 grid gap-3 rounded-3xl border border-walnut/15
          bg-mintcream p-4 sm:max-w-xl sm:p-5
        "
      >
        <div>
          <p className="text-xs font-bold uppercase text-walnut/60">
            Genres choisis
          </p>

          <p className="mt-1 text-sm font-bold text-darkwood">
            {selectedGenreLabels.length} genre
            {selectedGenreLabels.length > 1 ? 's' : ''}
          </p>

          <p className="mt-1 break-words text-sm leading-relaxed text-darkwood/60">
            {selectedGenreLabels.join(', ')}
          </p>
        </div>

        <div className="border-t border-walnut/10 pt-3">
          <p className="text-xs font-bold uppercase text-walnut/60">
            Objectif annuel
          </p>

          <p className="mt-1 text-sm font-bold text-darkwood">
            {annualGoal} livre{annualGoal > 1 ? 's' : ''} cette année
          </p>
        </div>
      </div>

      <div
        className="
          mt-10 flex flex-col-reverse gap-3
          sm:flex-row sm:items-center sm:justify-between
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
          onClick={onFinish}
          className="
            rounded-2xl bg-lime px-5 py-3
            text-sm font-bold text-darkwood
            transition hover:-translate-y-0.5 hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
          "
        >
          Entrer dans Dear Pages
        </button>
      </div>
    </div>
  )
}

export default CompleteStep
