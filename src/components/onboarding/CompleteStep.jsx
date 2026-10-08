import { useTranslation } from 'react-i18next'

import { AVAILABLE_GENRES } from '../../constants/genres.js'

function CompleteStep({
  annualGoal,
  favoriteGenres,
  isSaving = false,
  saveError = '',
  onBack,
  onFinish,
}) {
  const { t } = useTranslation()
  const selectedGenreLabels = AVAILABLE_GENRES.filter((genre) =>
    favoriteGenres.includes(genre.subject)
  ).map((genre) => t(`genres.${genre.subject}`))

  return (
    <div>
      <p className="font-handwritten text-xl text-walnut sm:text-2xl">
        {t('onboarding.complete.eyebrow')}
      </p>

      <h1
        className="
          mt-3 font-heading text-3xl font-bold
          leading-tight text-darkwood sm:text-5xl
        "
      >
        {t('onboarding.complete.title')}
      </h1>

      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-darkwood/65 sm:text-base">
        {t('onboarding.complete.description')}
      </p>

      <div
        className="
          mt-8 grid gap-3 rounded-3xl border border-walnut/15
          bg-mintcream p-4 sm:max-w-xl sm:p-5
        "
      >
        <div>
          <p className="text-xs font-bold uppercase text-walnut/60">
            {t('onboarding.complete.genresLabel')}
          </p>

          <p className="mt-1 text-sm font-bold text-darkwood">
            {t('onboarding.complete.genreCount', {
              count: selectedGenreLabels.length,
            })}
          </p>

          <p className="mt-1 break-words text-sm leading-relaxed text-darkwood/60">
            {selectedGenreLabels.join(', ')}
          </p>
        </div>

        <div className="border-t border-walnut/10 pt-3">
          <p className="text-xs font-bold uppercase text-walnut/60">
            {t('onboarding.complete.annualGoal')}
          </p>

          <p className="mt-1 text-sm font-bold text-darkwood">
            {t('onboarding.complete.annualGoalValue', {
              count: annualGoal,
            })}
          </p>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="mt-4 text-sm font-bold text-walnut">
          {saveError}
        </p>
      )}

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
          {t('onboarding.back')}
        </button>

        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving}
          className="
            rounded-2xl bg-lime px-5 py-3
            text-sm font-bold text-darkwood
            transition hover:-translate-y-0.5 hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {isSaving
            ? t('onboarding.complete.saving')
            : t('onboarding.complete.finish')}
        </button>
      </div>
    </div>
  )
}

export default CompleteStep
