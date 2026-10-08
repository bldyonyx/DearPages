import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import fr from './locales/fr.json'

export const LANGUAGE_STORAGE_KEY = 'dearpages:language'
export const SUPPORTED_LANGUAGES = ['fr', 'en']
export const DEFAULT_LANGUAGE = 'fr'

function getStoredLanguage() {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const storedLanguage = window.localStorage.getItem(
    LANGUAGE_STORAGE_KEY,
  )

  return SUPPORTED_LANGUAGES.includes(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    fr: {
      translation: fr,
    },
    en: {
      translation: en,
    },
  },
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || DEFAULT_LANGUAGE
}

export default i18n
