import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '../../i18n/index.js'
import { settingsLarge } from './settingsResponsive.js'

function LanguageCard() {
  const { i18n, t } = useTranslation()
  const currentLanguage = SUPPORTED_LANGUAGES.includes(i18n.language)
    ? i18n.language
    : 'fr'

  function handleLanguageChange(language) {
    if (language === currentLanguage) {
      return
    }

    i18n.changeLanguage(language)
  }

  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10
        bg-cream/80 p-5 shadow-sm
        sm:p-6
        ${settingsLarge.card}
      `}
    >
      <div className="sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h2
            className={`
              mt-1 font-heading text-3xl font-bold leading-tight text-darkwood
              ${settingsLarge.cardTitle}
            `}
          >
            {t('language.applicationLanguage')}
          </h2>

          <p
            className={`
              mt-2 max-w-xl font-ui text-sm leading-6 text-darkwood/60
              ${settingsLarge.description}
            `}
          >
            {t('language.description')}
          </p>
        </div>

        <div
          className="
            mt-5 grid grid-cols-2 gap-2 rounded-2xl
            border border-walnut/15 bg-mintcream/75 p-1
            sm:mt-0 sm:w-auto
          "
          role="radiogroup"
          aria-label={t('language.applicationLanguage')}
        >
          {SUPPORTED_LANGUAGES.map((language) => {
            const isSelected = currentLanguage === language

            return (
              <button
                key={language}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleLanguageChange(language)}
                className={[
                  'min-w-24 rounded-xl px-4 py-2.5',
                  'font-ui text-sm font-bold transition',
                  'focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-olive/35',
                  settingsLarge.controlButton,
                  isSelected
                    ? 'bg-lime text-darkwood shadow-sm'
                    : 'text-darkwood/60 hover:bg-cream/70 hover:text-darkwood',
                ].join(' ')}
              >
                {t(`language.${language}`)}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default LanguageCard
