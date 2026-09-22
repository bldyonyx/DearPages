import { FALLBACK_DISCOVER_PREFERENCES } from '../constants/discoverPreferences'
import { AVAILABLE_GENRES } from '../constants/genres'

const AVAILABLE_GENRES_BY_SUBJECT = new Map(
  AVAILABLE_GENRES.map((genre) => [genre.subject, genre])
)

/**
 * Converts Firebase favorite genre subjects into the Discover preference shape.
 * Invalid, duplicate, or unsupported subjects are ignored; if nothing valid
 * remains, the stable Discover fallback is used for legacy accounts.
 *
 * @param {unknown} favoriteGenres - Stored Firebase favoriteGenres value.
 * @returns {Array<{label: string, subject: string}>} Discover preferences.
 */
export function normalizeDiscoverPreferences(favoriteGenres) {
  if (!Array.isArray(favoriteGenres)) {
    return FALLBACK_DISCOVER_PREFERENCES
  }

  const seenSubjects = new Set()
  const normalizedPreferences = []

  favoriteGenres.forEach((favoriteGenre) => {
    if (typeof favoriteGenre !== 'string') return

    const subject = favoriteGenre.trim()
    const availableGenre = AVAILABLE_GENRES_BY_SUBJECT.get(subject)

    if (!subject || !availableGenre || seenSubjects.has(subject)) {
      return
    }

    seenSubjects.add(subject)
    normalizedPreferences.push({
      label: availableGenre.label,
      subject: availableGenre.subject,
    })
  })

  return normalizedPreferences.length
    ? normalizedPreferences
    : FALLBACK_DISCOVER_PREFERENCES
}

/**
 * Builds a stable cache signature from normalized Discover preferences.
 *
 * @param {Array<{subject: string}>} discoverPreferences - Normalized preferences.
 * @returns {string} Stable subject-only signature.
 */
export function createDiscoverPreferencesSignature(
  discoverPreferences
) {
  return discoverPreferences
    .map(({ subject }) => subject)
    .join('|')
}
