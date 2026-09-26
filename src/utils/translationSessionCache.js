const CACHE_PREFIX = 'dearpages:description-translation:v1'

function getSessionStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Creates a small deterministic hash for cache identity.
 *
 * This is not cryptographic. It only protects the session cache from reusing a
 * translation when the exact source description has changed.
 *
 * @param {string} value - Text to hash.
 * @returns {string} Stable base-36 hash.
 */
export function hashDescription(value) {
  const text = String(value || '')
  let hash = 5381

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index)
  }

  return (hash >>> 0).toString(36)
}

/**
 * Builds the session cache key for a translated book description.
 *
 * @param {Object} params - Cache identity parts.
 * @param {string} params.bookId - Stable book identifier.
 * @param {string} params.source - Catalog source.
 * @param {string} params.sourceLanguage - Source language.
 * @param {string} params.targetLanguage - Target language.
 * @param {string} params.description - Exact source description.
 * @returns {string|null} Cache key, or null when identity is incomplete.
 */
export function createTranslationCacheKey({
  bookId,
  source,
  sourceLanguage,
  targetLanguage,
  description,
}) {
  if (
    !bookId ||
    !source ||
    !sourceLanguage ||
    !targetLanguage ||
    !description
  ) {
    return null
  }

  return [
    CACHE_PREFIX,
    encodeURIComponent(source),
    encodeURIComponent(bookId),
    encodeURIComponent(sourceLanguage),
    encodeURIComponent(targetLanguage),
    hashDescription(description),
  ].join(':')
}

/**
 * Reads a successful description translation from sessionStorage.
 *
 * Storage can be unavailable, cleared, or corrupted, so failures are treated as
 * cache misses.
 *
 * @param {string|null} key - Cache key from createTranslationCacheKey.
 * @returns {string|null} Cached translation or null.
 */
export function getCachedTranslation(key) {
  const storage = getSessionStorage()

  if (!storage || !key) {
    return null
  }

  try {
    const cachedValue = storage.getItem(key)

    return cachedValue && cachedValue.trim()
      ? cachedValue
      : null
  } catch {
    return null
  }
}

/**
 * Stores a successful description translation for this browser session.
 *
 * @param {string|null} key - Cache key from createTranslationCacheKey.
 * @param {string} translatedText - Translated description.
 * @returns {void}
 */
export function setCachedTranslation(key, translatedText) {
  const storage = getSessionStorage()

  if (!storage || !key || !translatedText) {
    return
  }

  try {
    storage.setItem(key, translatedText)
  } catch {
    // Cache writes are optional; the BookPage should continue normally.
  }
}
