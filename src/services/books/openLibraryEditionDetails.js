
import { fetchJsonOnce } from '../../utils/inFlightRequest.js'
import { getPreferredIsbn } from './coverUtils.js'

const OPEN_LIBRARY_URL = 'https://openlibrary.org'
const COVER_URL = 'https://covers.openlibrary.org/b/id'

const LANGUAGE_CODES = {
  fre: 'fr',
  fra: 'fr',
  eng: 'en',
}

function getDescription(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value?.value === 'string') {
    return value.value
  }

  return ''
}

function getLanguage(languages = []) {
  for (const language of languages) {
    const code = String(language?.key || '')
      .split('/')
      .pop()
      .toLowerCase()

    if (LANGUAGE_CODES[code]) {
      return LANGUAGE_CODES[code]
    }
  }

  return ''
}

async function getAuthorNames(authorReferences = []) {
  const keys = authorReferences
    .map((author) => author?.key || author?.author?.key)
    .filter((key) => /^\/authors\/OL\d+A$/i.test(key))

  if (!keys.length) {
    return []
  }

  const results = await Promise.allSettled(
    keys.map((key) => fetchJsonOnce(`${OPEN_LIBRARY_URL}${key}.json`))
  )

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value?.name)
    .filter(Boolean)
}

/**
 * Charge une édition Open Library (OL...M).
 * Chaque édition conserve son propre identifiant.
 */
export async function getOpenLibraryEditionById(editionId) {
  const id = String(editionId || '').trim()

  if (!/^OL\d+M$/i.test(id)) {
    return null
  }

  const edition = await fetchJsonOnce(
    `${OPEN_LIBRARY_URL}/books/${id}.json`
  )

  const isbns = [
    ...(edition.isbn_13 || []),
    ...(edition.isbn_10 || []),
  ]

  const workKey = (edition.works || [])
    .map((work) => work?.key)
    .find((key) => /^\/works\/OL\d+W$/i.test(key))

  const workId = workKey?.split('/').pop() || null

  const editionAuthors = await getAuthorNames(edition.authors)

  let work = null

  if (workId) {
    try {
      work = await fetchJsonOnce(
        `${OPEN_LIBRARY_URL}/works/${workId}.json`
      )
    } catch {
      // L'édition reste consultable sans les détails de l'œuvre.
    }
  }

  const authors = editionAuthors.length
    ? editionAuthors
    : await getAuthorNames(work?.authors)

  const coverId = edition.covers?.[0] || work?.covers?.[0]

  return {
    id,
    openLibraryEditionId: id,
    openLibraryId: workKey || null,
    googleBooksId: null,
    title: edition.title || work?.title || 'Titre inconnu',
    authors: authors.length ? authors : ['Auteur inconnu'],
    isbn: getPreferredIsbn(isbns),
    isbns,
    cover: coverId
      ? `${COVER_URL}/${coverId}-L.jpg?default=false`
      : null,
    description: getDescription(
      edition.description || work?.description
    ),
    categories: work?.subjects || [],
    publishedDate: edition.publish_date || '',
    language: getLanguage(edition.languages),
    publishers: edition.publishers || [],
    source: 'open-library',
  }
}
