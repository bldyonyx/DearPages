
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

function isMatchingEdition(originalBook, candidate) {
  if (!candidate?.googleBooksId) {
    return false
  }

  if (!SUPPORTED_LANGUAGES.includes(
    normalizeLanguage(candidate.language)
  )) {
    return false
  }

  return (
    isSameAuthor(originalBook, candidate) &&
    isMatchingTitle(originalBook.title, candidate.title)
  )
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

/**
 * Recherche les éditions FR/EN d'un livre sur Google Books.
 *
 * Les résultats sont des volumes distincts :
 * chaque édition conserve son ID, ses ISBN et sa couverture.
 */
export async function getBookEditions(book) {
  if (!book?.title || !book?.authors?.length) {
    return []
  }

  const title = book.title.trim()
  const author = book.authors[0].trim()

  if (!title || !author) {
    return []
  }

  const query = `intitle:"${title.replace(/"/g, '')}"+inauthor:"${author.replace(/"/g, '')}"`

  const url = createVolumesSearchUrl(query, {
    maxResults: MAX_RESULTS,
    printType: 'books',
  })

  const data = await getGoogleBooksData(
    url,
    'Impossible de récupérer les éditions du livre.'
  )

  const candidates = (data.items || [])
    .map(formatGoogleBook)
    .filter((candidate) =>
      isMatchingEdition(book, candidate)
    )

  const currentBook = {
    ...book,
    googleBooksId: book.googleBooksId || (
      book.source === 'google-books' ? book.id : null
    ),
  }

  const editions = isMatchingEdition(book, currentBook)
    ? [currentBook, ...candidates]
    : candidates

  return removeDuplicateEditions(editions)
    .sort((first, second) => {
      const firstLanguage = normalizeLanguage(first.language)
      const secondLanguage = normalizeLanguage(second.language)

      return (
        SUPPORTED_LANGUAGES.indexOf(firstLanguage) -
        SUPPORTED_LANGUAGES.indexOf(secondLanguage)
      )
    })
}
