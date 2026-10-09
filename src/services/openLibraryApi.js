
import { fetchJsonOnce } from '../utils/inFlightRequest'
import { getPreferredIsbn } from './coverUtils.js'

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b/id'

const OPEN_LIBRARY_SUBJECT_QUERIES = {
  classics: 'classics',
  crime: 'crime fiction',
  comics: 'comics',
  'science fiction': 'science fiction',
  'self help': 'self help',
  'young adult': 'young adult fiction',
}

/**
 * Normalizes an Open Library description.
 */
function getDescription(description) {
  if (Array.isArray(description)) {
    return description.find((item) => typeof item === 'string') || ''
  }

  if (typeof description === 'string') {
    return description
  }

  if (
    description &&
    typeof description === 'object' &&
    typeof description.value === 'string'
  ) {
    return description.value
  }

  return ''
}

/**
 * Formats an Open Library search result for Dear Pages.
 */
export function formatOpenLibrarySearchBook(book) {
  const isbns = book.isbn || []
  const normalizedId = book.key.replace('/works/', '')
  const subjects = book.subject || []
  const subjectKeys = book.subject_key || []

  return {
    id: normalizedId,
    openLibraryId: book.key,
    title: book.title || 'Titre inconnu',
    authors: book.author_name || ['Auteur inconnu'],
    isbn: getPreferredIsbn(isbns),
    isbns,
    cover: book.cover_i
      ? `${OPEN_LIBRARY_COVERS_URL}/${book.cover_i}-L.jpg?default=false`
      : null,
    subjects,
    subjectKeys,
    categories: subjects,
    description: getDescription(book.first_sentence),
    publishedDate: book.first_publish_year
      ? String(book.first_publish_year)
      : '',
    source: 'open-library',
  }
}

/**
 * Searches Open Library using title and author parameters.
 */
export async function getOpenLibraryBooksBySearch({
  title = '',
  author = '',
  limit = 20,
} = {}) {
  const normalizedTitle = String(title || '').trim()
  const normalizedAuthor = String(author || '').trim()

  if (!normalizedTitle && !normalizedAuthor) {
    return []
  }

  const params = new URLSearchParams({
    limit: String(limit),
    fields:
      'key,title,author_name,isbn,cover_i,subject,subject_key,first_publish_year,first_sentence',
  })

  if (normalizedTitle) {
    params.set('title', normalizedTitle)
  }

  if (normalizedAuthor) {
    params.set('author', normalizedAuthor)
  }

  let data

  try {
    data = await fetchJsonOnce(
      `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`
    )
  } catch {
    throw new Error('Impossible de recuperer ces suggestions.')
  }

  return (data.docs || [])
    .filter((book) => book.key && book.key.startsWith('/works/'))
    .map(formatOpenLibrarySearchBook)
}

/**
 * Searches Open Library by subject for Discover fallback results.
 */
export async function getOpenLibraryBooksBySubject(
  subject,
  limit = 40,
  page = 1
) {
  const normalizedSubject = String(subject || '').trim()
  const params = new URLSearchParams({
    subject:
      OPEN_LIBRARY_SUBJECT_QUERIES[normalizedSubject] ||
      normalizedSubject,
    limit: String(limit),
    page: String(page),
    fields:
      'key,title,author_name,isbn,cover_i,subject,subject_key,first_publish_year,first_sentence',
  })

  let data

  try {
    data = await fetchJsonOnce(
      `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`
    )
  } catch {
    throw new Error('Impossible de recuperer ces suggestions.')
  }

  return (data.docs || []).map(formatOpenLibrarySearchBook)
}

/**
 * Fetches a complete Open Library work.
 */
export async function getOpenLibraryBookById(workId) {
  if (!workId) {
    return null
  }

  const normalizedId = workId.replace('/works/', '')

  let work

  try {
    work = await fetchJsonOnce(
      `${OPEN_LIBRARY_BASE_URL}/works/${encodeURIComponent(
        normalizedId
      )}.json`
    )
  } catch {
    throw new Error('Impossible de recuperer ce livre.')
  }

  const authorKeys =
    work.authors
      ?.map((author) => author.author?.key)
      .filter(Boolean) || []

  let authors = ['Auteur inconnu']

  if (authorKeys.length > 0) {
    const authorResults = await Promise.allSettled(
      authorKeys.map((authorKey) =>
        fetchJsonOnce(
          `${OPEN_LIBRARY_BASE_URL}${authorKey}.json`
        )
      )
    )

    const authorNames = authorResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value?.name)
      .filter(Boolean)

    if (authorNames.length > 0) {
      authors = authorNames
    }
  }

  const coverId = work.covers?.[0]

  return {
    id: normalizedId,
    openLibraryId: `/works/${normalizedId}`,
    title: work.title || 'Titre inconnu',
    authors,
    isbn: null,
    isbns: [],
    cover: coverId
      ? `${OPEN_LIBRARY_COVERS_URL}/${coverId}-L.jpg?default=false`
      : null,
    description: getDescription(work.description),
    categories: work.subjects || [],
    publishedDate:
      work.first_publish_date ||
      work.created?.value?.slice(0, 4) ||
      '',
    language: '',
    source: 'open-library',
  }
}
