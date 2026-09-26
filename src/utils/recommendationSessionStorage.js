const STORAGE_PREFIX = 'booktracker:recommendations'
const FOR_YOU_CACHE_VERSION = 'v4'

function getUserStorageScope(userId) {
  return `user:${userId}`
}

export const RECOMMENDATION_STORAGE_KEYS = {
  homeForYou: (userId, signature) =>
    `${STORAGE_PREFIX}:${getUserStorageScope(
      userId
    )}:discover:home-for-you:${FOR_YOU_CACHE_VERSION}:${signature}`,
  trending: (userId) =>
    `${STORAGE_PREFIX}:${getUserStorageScope(
      userId
    )}:discover:trending`,
  mustReads: (userId) =>
    `${STORAGE_PREFIX}:${getUserStorageScope(
      userId
    )}:discover:must-reads`,
  forYouGenre: (userId, signature, subject) =>
    `${STORAGE_PREFIX}:${getUserStorageScope(
      userId
    )}:for-you:${FOR_YOU_CACHE_VERSION}:${signature}:${subject}`,
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isValidRecommendationState(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.books) &&
    Array.isArray(value.seenIdentityKeys) &&
    (Array.isArray(value.candidatePool) ||
      value.candidatePool === undefined) &&
    (typeof value.isPoolExhausted === 'boolean' ||
      value.isPoolExhausted === undefined) &&
    (typeof value.startIndex === 'number' ||
      value.startIndex === undefined)
  )
}

/**
 * Reads a recommendation shelf snapshot from sessionStorage. Invalid or
 * corrupted data is ignored so hooks can safely fall back to their normal
 * initial API load.
 *
 * @param {string} key - sessionStorage key for one recommendation shelf.
 * @returns {Object|null} Saved books, startIndex, and seen identity keys.
 */
export function readRecommendationState(key) {
  const storage = getSessionStorage()

  if (!storage) return null

  try {
    const parsedValue = JSON.parse(storage.getItem(key))

    if (!isValidRecommendationState(parsedValue)) return null

    return {
      books: parsedValue.books,
      startIndex: parsedValue.startIndex || 0,
      seenIdentityKeys: parsedValue.seenIdentityKeys,
      candidatePool: parsedValue.candidatePool || [],
      isPoolExhausted: Boolean(parsedValue.isPoolExhausted),
    }
  } catch {
    return null
  }
}

/**
 * Persists one recommendation shelf snapshot for the current browser session.
 * Writes are best-effort because storage may be unavailable or full.
 *
 * @param {string} key - sessionStorage key for one recommendation shelf.
 * @param {Object} state - Snapshot to save.
 * @param {Array<Object>} state.books - Currently displayed books.
 * @param {number} [state.startIndex=0] - Current pagination cursor.
 * @param {Iterable<string>} state.seenIdentityKeys - Session seen identities.
 * @param {Array<Object>} [state.candidatePool] - Stored candidates for locally rotated shelves.
 * @param {boolean} [state.isPoolExhausted=false] - Whether a stored local pool has no unseen books left.
 */
export function writeRecommendationState(
  key,
  {
    books,
    startIndex = 0,
    seenIdentityKeys,
    candidatePool,
    isPoolExhausted = false,
  }
) {
  const storage = getSessionStorage()

  if (!storage) return

  try {
    storage.setItem(
      key,
      JSON.stringify({
        books,
        startIndex,
        seenIdentityKeys: Array.from(seenIdentityKeys || []),
        candidatePool,
        isPoolExhausted,
      })
    )
  } catch {
    // Storage is optional; recommendation refresh should still work.
  }
}
