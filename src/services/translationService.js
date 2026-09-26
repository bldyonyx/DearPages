const TRANSLATION_URL =
  'https://translation.googleapis.com/language/translate/v2'
const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY

function decodeHtmlEntities(value) {
  if (!value || typeof document === 'undefined') {
    return value || ''
  }

  const textarea = document.createElement('textarea')
  textarea.innerHTML = value

  return textarea.value
}

/**
 * Translates plain text with Google Cloud Translation Basic v2.
 *
 * The API key is read from Vite environment variables and is never returned to
 * callers. Errors are intentionally generic so provider details and request
 * data do not leak into the UI.
 *
 * @param {string} text - Source text to translate.
 * @param {string} sourceLanguage - Known source language, such as "en".
 * @param {string} targetLanguage - Target language, such as "fr".
 * @returns {Promise<string>} Translated text only.
 * @throws {Error} When translation is unavailable or fails.
 */
export async function translateText(
  text,
  sourceLanguage,
  targetLanguage
) {
  const sourceText = String(text || '').trim()

  if (!sourceText || !targetLanguage || !API_KEY) {
    throw new Error('Translation unavailable.')
  }

  const body = new URLSearchParams({
    q: sourceText,
    target: targetLanguage,
    format: 'text',
  })

  if (sourceLanguage) {
    body.set('source', sourceLanguage)
  }

  let response

  try {
    response = await fetch(`${TRANSLATION_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
  } catch {
    throw new Error('Translation request failed.')
  }

  if (!response.ok) {
    throw new Error('Translation request failed.')
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw new Error('Translation response invalid.')
  }

  const translatedText =
    data?.data?.translations?.[0]?.translatedText

  if (typeof translatedText !== 'string' || !translatedText.trim()) {
    throw new Error('Translation response invalid.')
  }

  return decodeHtmlEntities(translatedText)
}
