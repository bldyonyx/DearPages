import { useTranslation } from 'react-i18next'

import { useAuth } from '../../context/AuthContext.jsx'
import { normalizeLanguage } from '../../i18n/index.js'
import { updateReadingPreferences } from '../../services/preferencesService.js'
import LanguageToggle from '../ui/LanguageToggle.jsx'
import { settingsLarge } from './settingsResponsive.js'

function LanguageCard() {
  const { t } = useTranslation()
  const { user, preferences, updatePreferences } = useAuth()

  async function handleLanguageChange(language) {
    const nextLanguage = normalizeLanguage(language)

    if (!user?.uid) {
      return
    }

    try {
      const savedChanges = await updateReadingPreferences(user.uid, {
        language: nextLanguage,
      })

      updatePreferences({
        ...(preferences || {}),
        ...savedChanges,
      })
    } catch (firebaseError) {
      console.error(firebaseError)
    }
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

        <LanguageToggle
          onLanguageChange={handleLanguageChange}
          className={`
            mt-5
            sm:mt-0 sm:w-auto
          `}
          buttonClassName={`
            min-w-24 px-4 py-2.5
            ${settingsLarge.controlButton}
          `}
        />
      </div>
    </section>
  )
}

export default LanguageCard
