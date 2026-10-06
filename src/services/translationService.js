const TRANSLATION_URL =
  'https://translation.googleapis.com/language/translate/v2'
const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY

function getRequestOrigin() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location?.origin || ''
}

function getGoogleErrorReason(apiError) {
  return apiError?.errors?.find((error) => error?.reason)
    ?.reason
}

function createTranslationError(message, diagnostic = {}) {
  const error = new Error(message)
  error.status = diagnostic.status
  error.apiError = diagnostic.apiError || null
  error.diagnostic = {
    status: diagnostic.status || null,
    googleErrorCode: diagnostic.apiError?.code || null,
    googleErrorStatus: diagnostic.apiError?.status || null,
    googleErrorMessage: diagnostic.apiError?.message || null,
    googleErrorReason:
      diagnostic.reason ||
      getGoogleErrorReason(diagnostic.apiError) ||
      null,
    origin: getRequestOrigin(),
    hasApiKey: Boolean(API_KEY),
    hasHttpResponse: diagnostic.hasHttpResponse ?? true,
  }

  return error
}

async function getGoogleErrorBody(response) {
  try {
    const body = await response.json()

    return body?.error || null
  } catch {
    return null
  }
}

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
    throw createTranslationError('Translation unavailable.')
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
    throw createTranslationError('Translation request failed.', {
      hasHttpResponse: false,
    })
  }

  if (!response.ok) {
    const apiError = await getGoogleErrorBody(response)

    throw createTranslationError('Translation request failed.', {
      status: response.status,
      apiError,
      hasHttpResponse: true,
    })
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw createTranslationError('Translation response invalid.')
  }

  const translatedText =
    data?.data?.translations?.[0]?.translatedText

  if (typeof translatedText !== 'string' || !translatedText.trim()) {
    throw createTranslationError('Translation response invalid.')
  }

  return decodeHtmlEntities(translatedText)
}
