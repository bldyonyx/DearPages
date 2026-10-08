import { useTranslation } from 'react-i18next'

function WelcomeStep({
  displayName,
  onNext,
}) {
  const { t } = useTranslation()
  const firstName = displayName?.trim().split(/\s+/)[0]
  const greetingName = firstName ? `, ${firstName}` : ''

  return (
    <div>
      <p className="font-handwritten text-xl text-walnut sm:text-2xl">
        {t('onboarding.welcome.eyebrow')}
      </p>

      <h1
        className="
          mt-3 max-w-2xl font-heading
          text-3xl font-bold leading-tight text-darkwood
          sm:text-5xl
        "
      >
        {t('onboarding.welcome.title', {
          name: greetingName,
        })}
      </h1>

      <p
        className="
          mt-5 max-w-2xl text-sm leading-relaxed
          text-darkwood/65 sm:text-base
        "
      >
        {t('onboarding.welcome.description')}
      </p>

      <div className="mt-10">
        <button
          type="button"
          onClick={onNext}
          className="
            w-full rounded-2xl bg-lime px-6 py-4
            text-sm font-bold text-darkwood
            transition hover:-translate-y-0.5 hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
            sm:w-auto
          "
        >
          {t('onboarding.welcome.start')}
        </button>
      </div>
    </div>
  )
}

export default WelcomeStep
