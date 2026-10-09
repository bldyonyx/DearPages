
import {
  createVolumesSearchUrl,
  getGoogleBooksData,
} from './googleBooksApi.js'
import { formatGoogleBook } from './googleBooksFormatter.js'

const SUPPORTED_LANGUAGES = ['fr', 'en']
const MAX_RESULTS = 40

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeLanguage(language = '') {
  return String(language).toLowerCase().split('-')[0]
}

function isSameAuthor(firstBook, secondBook) {
  const originalAuthors = (firstBook.authors || [])
    .map(normalizeText)
    .filter(Boolean)

  const candidateAuthors = (secondBook.authors || [])
    .map(normalizeText)
    .filter(Boolean)

  return originalAuthors.some((author) =>
    candidateAuthors.includes(author)
  )
}

function isMatchingTitle(originalTitle, candidateTitle) {
  const original = normalizeText(originalTitle)
  const candidate = normalizeText(candidateTitle)

  if (!original || !candidate) {
    return false
  }

  return (
    original === candidate ||
    original.startsWith(`${candidate} `) ||
    candidate.startsWith(`${original} `)
  )
}

function isMatchingEdition(book, candidate, titles) {
  if (!candidate?.googleBooksId) {
    return false
  }

  if (
    !SUPPORTED_LANGUAGES.includes(
      normalizeLanguage(candidate.language)
    )
  ) {
    return false
  }

  const matchesTitle = titles.some((title) =>
    isMatchingTitle(title, candidate.title)
  )

  return isSameAuthor(book, candidate) && matchesTitle
}

function removeDuplicateEditions(editions) {
  const seen = new Set()

  return editions.filter((edition) => {
    const key = edition.isbn
      ? `isbn:${edition.isbn}`
      : `google:${edition.googleBooksId}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getSearchTitles(book, alternativeTitles) {
  const titles = [
    book.title,
    ...alternativeTitles,
  ]

  const seen = new Set()

  return titles
    .map((title) => String(title || '').trim())
    .filter(Boolean)
    .filter((title) => {
      const normalized = normalizeText(title)

      if (!normalized || seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
}

/**
 * Recherche les éditions FR/EN d'un livre sur Google Books.
 *
 * Les titres alternatifs doivent provenir d'une source
 * fiable associée à la même œuvre (Open Library).
 *
 * Chaque résultat est vérifié par son titre et son auteur.
 * Les éditions conservent leurs identifiants et métadonnées.
 */
export async function getBookEditions(
  book,
  alternativeTitles = []
) {
  if (!book?.title || !book?.authors?.length) {
    return []
  }

  const author = String(book.authors[0] || '').trim()

  if (!author) {
    return []
  }

  const searchTitles = getSearchTitles(
    book,
    Array.isArray(alternativeTitles)
      ? alternativeTitles
      : []
  )

  if (searchTitles.length === 0) {
    return []
  }

  const searches = searchTitles.map(async (title) => {
    const safeTitle = title.replace(/"/g, '')
    const safeAuthor = author.replace(/"/g, '')

    const query =
      `intitle:"${safeTitle}"` +
      `+inauthor:"${safeAuthor}"`

    const url = createVolumesSearchUrl(query, {
      maxResults: MAX_RESULTS,
      printType: 'books',
    })

    const data = await getGoogleBooksData(
      url,
      'Impossible de récupérer les éditions du livre.'
    )

    return (data.items || [])
      .map(formatGoogleBook)
      .filter((candidate) =>
        isMatchingEdition(
          book,
          candidate,
          searchTitles
        )
      )
  })

    const results = await Promise.allSettled(searches)

    const successfulResults = results.filter(
    (result) => result.status === 'fulfilled'
    )

    // Si toutes les recherches échouent, on propage
    // l'erreur au lieu de retourner un faux succès.
    if (successfulResults.length === 0) {
    const firstError = results.find(
        (result) => result.status === 'rejected'
    )

    throw firstError.reason
    }

    const candidates = successfulResults.flatMap(
    (result) => result.value
    )

  const currentBook = {
    ...book,
    googleBooksId:
      book.googleBooksId ||
      (book.source === 'google-books'
        ? book.id
        : null),
  }

  const editions = isMatchingEdition(
    book,
    currentBook,
    searchTitles
  )
    ? [currentBook, ...candidates]
    : candidates

  return removeDuplicateEditions(editions)
    .sort((first, second) => {
      const firstLanguage = normalizeLanguage(
        first.language
      )
      const secondLanguage = normalizeLanguage(
        second.language
      )

      return (
        SUPPORTED_LANGUAGES.indexOf(firstLanguage) -
        SUPPORTED_LANGUAGES.indexOf(secondLanguage)
      )
    })
}
