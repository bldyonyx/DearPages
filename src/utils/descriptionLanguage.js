const FRENCH_WORDS = [
  'avec',
  'dans',
  'des',
  'elle',
  'est',
  'les',
  'leur',
  'mais',
  'pour',
  'que',
  'qui',
  'ses',
  'sur',
  'une',
]

const ENGLISH_WORDS = [
  'and',
  'as',
  'for',
  'from',
  'has',
  'her',
  'his',
  'in',
  'is',
  'of',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
]

function normalizeLanguageCode(language) {
  if (!language) {
    return ''
  }

  return String(language).trim().toLowerCase().slice(0, 2)
}

function countMatches(text, words) {
  return words.reduce((count, word) => {
    const matches = text.match(
      new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, 'g')
    )

    return count + (matches?.length || 0)
  }, 0)
}

/**
 * Classifies the visible description language for translation decisions.
 *
 * Metadata wins when it explicitly says French or English. Without metadata,
 * the heuristic only returns English or French when common function words and
 * French accents make the result reasonably clear; uncertain descriptions stay
 * unknown so Dear Pages does not offer translation for the wrong text.
 *
 * @param {string} description - Displayed book description.
 * @param {string} metadataLanguage - Normalized book metadata language.
 * @returns {'fr'|'en'|'unknown'} Description language.
 */
export function detectDescriptionLanguage(
  description,
  metadataLanguage
) {
  const explicitLanguage = normalizeLanguageCode(metadataLanguage)

  if (explicitLanguage === 'fr' || explicitLanguage === 'en') {
    return explicitLanguage
  }

  const normalizedText = String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = normalizedText.split(' ').filter(Boolean)

  if (words.length < 12) {
    return 'unknown'
  }

  const originalText = String(description || '').toLowerCase()
  const hasFrenchAccents = /[àâçéèêëîïôùûüÿœ]/i.test(
    originalText
  )
  const frenchScore =
    countMatches(normalizedText, FRENCH_WORDS) +
    (hasFrenchAccents ? 2 : 0)
  const englishScore = countMatches(normalizedText, ENGLISH_WORDS)

  if (englishScore >= 4 && englishScore >= frenchScore + 2) {
    return 'en'
  }

  if (frenchScore >= 4 && frenchScore >= englishScore + 2) {
    return 'fr'
  }

  return 'unknown'
}
