import { AVAILABLE_GENRES } from '../constants/genres.js'
import { BOOK_STATUSES } from '../services/libraryService.js'

const GENERIC_CATEGORY_KEYS = new Set([
  'fiction',
  'general',
  'non fiction',
  'nonfiction',
])

const CATEGORY_SUBJECT_ALIASES = {
  autobiography: 'biography',
  biographies: 'biography',
  biography: 'biography',
  classics: 'classics',
  comics: 'comics',
  'comics graphic novels': 'comics',
  crime: 'crime',
  fantasy: 'fantasy',
  'graphic novels': 'comics',
  history: 'history',
  horror: 'horror',
  memoir: 'biography',
  memoirs: 'biography',
  mystery: 'mystery',
  'mystery detective': 'mystery',
  philosophy: 'philosophy',
  poetry: 'poetry',
  romance: 'romance',
  'science fiction': 'science fiction',
  'self help': 'self help',
  'self-help': 'self help',
  thriller: 'thriller',
  'young adult': 'young adult',
}

const GENRE_LABELS_BY_SUBJECT = AVAILABLE_GENRES.reduce(
  (labels, genre) => ({
    ...labels,
    [genre.subject]: genre.label,
  }),
  {}
)

function normalizeCategoryKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function formatCategoryLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getDisplayGenreForCategory(category) {
  const key = normalizeCategoryKey(category)
  const subject = CATEGORY_SUBJECT_ALIASES[key]

  return {
    key: subject || key,
    label: subject
      ? GENRE_LABELS_BY_SUBJECT[subject]
      : formatCategoryLabel(category),
  }
}

/**
 * Computes the most represented library genre from stored Google Books
 * categories. Abandoned books are ignored, generic categories are filtered,
 * known aliases are folded into Dear Pages genre labels, and ties keep the
 * genre that appeared first while walking the library.
 *
 * @param {Object[]} library Books already loaded for the dashboard.
 * @returns {string} User-facing genre label, or "Non défini".
 */
export function getFavoriteGenreLabelFromLibrary(library) {
  const genreCounts = new Map()
  const firstSeenByGenre = new Map()
  let genreOrder = 0

  library
    .filter((book) => book.status !== BOOK_STATUSES.ABANDONED)
    .forEach((book) => {
      const categoryParts = (book.categories || [])
        .flatMap((category) => String(category).split('/'))
        .map((category) => category.trim())
        .filter(Boolean)

      const usefulParts = categoryParts.filter(
        (category) =>
          !GENERIC_CATEGORY_KEYS.has(
            normalizeCategoryKey(category)
          )
      )

      const categoriesToCount = usefulParts.length
        ? usefulParts
        : categoryParts.filter(
            (category) =>
              !GENERIC_CATEGORY_KEYS.has(
                normalizeCategoryKey(category)
              )
          )

      const bookGenres = new Map()

      categoriesToCount.forEach((category) => {
        const genre = getDisplayGenreForCategory(category)

        if (!genre.key) return

        bookGenres.set(genre.key, genre.label)
      })

      bookGenres.forEach((label, key) => {
        if (!firstSeenByGenre.has(key)) {
          firstSeenByGenre.set(key, genreOrder)
          genreOrder += 1
        }

        genreCounts.set(key, {
          label,
          count: (genreCounts.get(key)?.count || 0) + 1,
        })
      })
    })

  let favoriteGenre = null

  genreCounts.forEach((genre, key) => {
    if (
      !favoriteGenre ||
      genre.count > favoriteGenre.count ||
      (genre.count === favoriteGenre.count &&
        firstSeenByGenre.get(key) < favoriteGenre.firstSeen)
    ) {
      favoriteGenre = {
        ...genre,
        firstSeen: firstSeenByGenre.get(key),
      }
    }
  })

  return favoriteGenre?.label || 'Non défini'
}
