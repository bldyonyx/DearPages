import { useTranslation } from 'react-i18next'

import {
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from '../../i18n/index.js'

function LanguageToggle({
  buttonClassName = '',
  className = '',
  labelMode = 'full',
  onLanguageChange,
  orientation = 'horizontal',
}) {
  const { i18n, t } = useTranslation()
  const currentLanguage = normalizeLanguage(i18n.language)

  function handleLanguageChange(language) {
    if (language === currentLanguage) {
      return
    }

    i18n.changeLanguage(language)
    onLanguageChange?.(language)
  }

  return (
    <div
      className={[
        'grid gap-1 rounded-2xl',
        orientation === 'vertical' ? 'grid-cols-1' : 'grid-cols-2',
        'border border-walnut/15 bg-mintcream/75 p-1',
        className,
      ].join(' ')}
      role="radiogroup"
      aria-orientation={orientation}
      aria-label={t('language.applicationLanguage')}
    >
      {SUPPORTED_LANGUAGES.map((language) => {
        const isSelected = currentLanguage === language
        const label =
          labelMode === 'short'
            ? language.toUpperCase()
            : t(`language.${language}`)

        return (
          <button
            key={language}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={t('language.switchTo', {
              language: t(`language.${language}`),
            })}
            onClick={() => handleLanguageChange(language)}
            className={[
              'rounded-xl px-3 py-2',
              'font-ui text-sm font-bold transition',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-olive/35',
              buttonClassName,
              isSelected
                ? 'bg-lime text-darkwood shadow-sm'
                : 'text-darkwood/60 hover:bg-cream/70 hover:text-darkwood',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageToggle
