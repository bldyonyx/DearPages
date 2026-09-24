import { AVAILABLE_GENRES } from '../../constants/genres.js'
import SettingsSaveBar from './SettingsSaveBar.jsx'

const QUICK_GOALS = [12, 24, 36, 50]

function ReadingPreferencesCard({
  annualGoal,
  goalError,
  hasChanges,
  isLoading,
  isSaveDisabled,
  isSaving,
  onAnnualGoalChange,
  onSave,
  onToggleGenre,
  saveError,
  selectedGenres,
  successMessage,
}) {
  return (
    <section
      className="
        rounded-3xl border border-walnut/15
        bg-cream/90 p-5 shadow-sm
        sm:p-6
      "
    >
      <div>
        <p className="font-handwritten text-xl text-walnut sm:text-2xl">
          tes envies de lecture
        </p>

        <h2 className="mt-1 font-heading text-3xl font-bold leading-tight text-darkwood">
          Préférences de lecture
        </h2>

        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-darkwood/60">
          Ajuste les genres qui nourrissent tes recommandations et
          ton objectif annuel.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-7 text-sm font-bold text-walnut/70">
          Chargement de tes préférences...
        </p>
      ) : (
        <div className="mt-7 grid gap-7">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
            <div>
              <h3 className="text-sm font-bold text-darkwood">
                Genres préférés
              </h3>

              <div className="mt-4 flex flex-wrap gap-2.5 sm:gap-3">
                {AVAILABLE_GENRES.map((genre) => {
                  const isSelected = selectedGenres.includes(
                    genre.subject
                  )

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

              <p className="mt-4 text-xs font-bold text-darkwood/50">
                {selectedGenres.length} genre
                {selectedGenres.length > 1 ? 's' : ''} sélectionné
                {selectedGenres.length > 1 ? 's' : ''}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-darkwood">
                Objectif annuel
              </h3>

              <div className="mt-4 flex flex-wrap gap-3">
                {QUICK_GOALS.map((goal) => {
                  const isSelected = Number(annualGoal) === goal

                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => onAnnualGoalChange(goal)}
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

              <label className="mt-5 block">
                <span className="text-sm font-bold text-darkwood">
                  Valeur personnalisée
                </span>

                <span className="mt-2 flex max-w-[250px] items-center gap-2 rounded-2xl border border-walnut/20 bg-white/45 px-3 py-2 focus-within:border-olive/60 focus-within:ring-2 focus-within:ring-lime/40 sm:max-w-[230px]">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="200"
                    step="1"
                    value={annualGoal}
                    onChange={(event) =>
                      onAnnualGoalChange(event.target.value)
                    }
                    className="
                      min-w-0 flex-1 bg-transparent text-sm font-bold
                      text-darkwood outline-none
                      placeholder:text-walnut/45
                    "
                  />

                  <span className="shrink-0 text-xs font-bold text-darkwood/50">
                    livres
                  </span>
                </span>
              </label>

              <div className="mt-3 min-h-5">
                {goalError && (
                  <p className="text-sm font-bold text-walnut">
                    {goalError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <SettingsSaveBar
            error={saveError}
            hasChanges={hasChanges}
            isDisabled={isSaveDisabled}
            isSaving={isSaving}
            successMessage={successMessage}
            onSave={onSave}
          />
        </div>
      )}
    </section>
  )
}

export default ReadingPreferencesCard
