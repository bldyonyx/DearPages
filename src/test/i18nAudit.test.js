import { describe, expect, it } from 'vitest'

import i18n, {
  LANGUAGE_STORAGE_KEY,
} from '../i18n/index.js'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'

function getLeafKeys(value, prefix = '') {
  return Object.keys(value).flatMap((key) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    const nextValue = value[key]

    if (
      nextValue &&
      typeof nextValue === 'object' &&
      !Array.isArray(nextValue)
    ) {
      return getLeafKeys(nextValue, nextPrefix)
    }

    return nextPrefix
  })
}

describe('i18n locale audit', () => {
  it('keeps French and English locale keys in sync', () => {
    expect(getLeafKeys(en).sort()).toEqual(
      getLeafKeys(fr).sort()
    )
  })

  it('persists language changes immediately', async () => {
    await i18n.changeLanguage('en')

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(
      'en'
    )
    expect(document.documentElement.lang).toBe('en')

    await i18n.changeLanguage('fr')

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(
      'fr'
    )
    expect(document.documentElement.lang).toBe('fr')
  })
})
