function ReadingStats({
  totalBooks,
  currentlyReading,
  favoriteGenre,
}) {
  return (
    <section className="w-full min-w-0 rounded-3xl border border-darkwood/10 bg-cream/80 p-5 md:p-6">
      {/* Titre */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-darkwood">
          Tes lectures
        </h2>

        <p className="mt-1 font-ui text-sm text-darkwood/60">
          Un petit aperçu de ta bibliothèque.
        </p>
      </div>

      {/* Statistiques */}
      <div className="mt-6 md:flex md:items-stretch">
        {/* Deux premières stats */}
        <div className="flex w-full min-w-0 md:flex-1">
          {/* Livres */}
          <div className="w-1/2 min-w-0 px-1 text-center sm:px-3">
            <p className="font-heading text-3xl font-bold text-darkwood">
              {totalBooks}
            </p>

            <p className="mt-1 font-ui text-xs font-bold text-darkwood">
              livres
            </p>

            <p className="font-ui text-[0.6rem] leading-tight text-darkwood/50 sm:text-xs">
              dans ta bibliothèque
            </p>
          </div>

          {/* En cours */}
          <div className="w-1/2 min-w-0 border-l border-darkwood/10 px-1 text-center sm:px-3">
            <p className="font-heading text-3xl font-bold text-darkwood">
              {currentlyReading}
            </p>

            <p className="mt-1 font-ui text-xs font-bold text-darkwood">
              en cours
            </p>

            <p className="font-ui text-[0.6rem] leading-tight text-darkwood/50 sm:text-xs">
              actuellement
            </p>
          </div>
        </div>

        {/* Genre */}
        <div
          className="
            mt-5 w-full
            border-t border-darkwood/10
            pt-5 text-center
            md:mt-0 md:w-1/3
            md:border-l md:border-t-0
            md:pt-0
          "
        >
          <p className="font-heading text-xl font-bold text-darkwood">
            {favoriteGenre}
          </p>

          <p className="mt-1 font-ui text-xs text-darkwood/50">
            genre préféré
          </p>
        </div>
      </div>
    </section>
  )
}

export default ReadingStats
