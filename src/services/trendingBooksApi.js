import { fetchJsonOnce } from '../utils/inFlightRequest'

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b/id'

/**
 * Extrait une description Open Library.
 *
 * Selon le livre, Open Library retourne soit une chaîne,
 * soit un objet contenant la description dans `value`.
 *
 * @param {string|Object|undefined} description - Description Open Library.
 * @returns {string} Description normalisée.
 */
function getDescription(description) {
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
 * Recupere les livres actuellement tendance sur Open Library.
 *
 * @param {number} [limit=10] - Nombre maximum de livres tendance a retourner.
 * @returns {Promise<Array>} Livres tendance formates pour Dear Pages.
 * @throws {Error} Si la requete Open Library echoue.
 */
export async function getTrendingBooksDetails(limit = 10) {
  const params = new URLSearchParams({
    q: 'trending_z_score:{0 TO *]',
    sort: 'trending',
    limit: String(limit),
    fields: 'key,title,author_name,isbn,cover_i',
  })

  let data

  try {
    data = await fetchJsonOnce(
      `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`
    )
  } catch {
    throw new Error('Impossible de recuperer les tendances.')
  }

  return (data.docs || []).map((book) => ({
    id: book.key.replace('/works/', ''),
    openLibraryId: book.key,
    title: book.title || 'Titre inconnu',
    authors: book.author_name || ['Auteur inconnu'],
    isbn: book.isbn?.[0] || null,
    isbns: book.isbn || [],
    cover: book.cover_i
      ? `${OPEN_LIBRARY_COVERS_URL}/${book.cover_i}-L.jpg?default=false`
      : null,
  }))
}

/**
 * Recupere la fiche complete d'un livre Open Library.
 *
 * Les identifiants de type `OL...W` correspondent aux Works
 * utilises notamment par le rayon "Tendances du moment".
 *
 * @param {string} workId - Identifiant Open Library du livre.
 * @returns {Promise<Object|null>} Livre formate pour Dear Pages.
 * @throws {Error} Si la requete Open Library echoue.
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

    // On garde une propriété commune afin que le reste de
    // l'application puisse manipuler le livre normalement.
    googleBooksId: normalizedId,

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