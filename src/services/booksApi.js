import { fetchJsonOnce } from '../utils/inFlightRequest'
import {
  buildAuthorSearchQuery,
  buildTitleSearchQuery,
  hasSufficientSearchMatches,
  mergeAndRankSearchBooks,
} from '../utils/bookSearchRelevance.js'
import {
  getBestGoogleCover,
  getIndustryIdentifierIsbns,
  getPreferredIsbn,
} from './coverUtils.js'

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
const SEARCH_RESULTS_LIMIT = 20
const SEARCH_CANDIDATE_LIMIT = 40
const TITLE_SEARCH_CANDIDATE_LIMIT = 20
const SUGGESTION_CANDIDATE_LIMIT = 10
const SUGGESTION_RESULTS_LIMIT = 5
const GOOGLE_SUBJECT_QUERIES = {
  crime: 'subject:"crime fiction"',
  comics: 'subject:"comics graphic novels"',
  'young adult': 'subject:"young adult fiction"',
}

const SUBJECT_RELEVANCE_RULES = {
  fantasy: {
    categories: ['fantasy'],
    genericFictionTerms: [
      'fantasy',
      'magic',
      'magical',
      'dragon',
      'wizard',
      'witch',
      'kingdom',
    ],
  },
  romance: {
    categories: [
      'romance',
      'love stories',
      'romantic fiction',
      'dating',
      'courtship',
      'marriage',
      'man-woman relationships',
    ],
    genericFictionTerms: [
      'romance',
      'romantic',
      'love',
      'relationship',
      'marriage',
      'bride',
      'dating',
    ],
  },
  mystery: {
    categories: [
      'mystery',
      'detective',
      'crime',
      'suspense',
      'thriller',
    ],
    genericFictionTerms: [
      'mystery',
      'detective',
      'murder',
      'crime',
      'missing',
      'case',
      'death',
    ],
  },
  thriller: {
    categories: ['thriller', 'suspense'],
    genericFictionTerms: [
      'thriller',
      'suspense',
      'conspiracy',
      'killer',
      'spy',
      'secret',
      'danger',
    ],
  },
  crime: {
    categories: [
      'crime fiction',
      'detective',
      'mystery',
      'police',
      'thriller',
      'suspense',
    ],
    genericFictionTerms: [
      'crime',
      'criminal',
      'detective',
      'murder',
      'police',
      'investigation',
      'killer',
    ],
  },
  horror: {
    categories: ['horror', 'ghost', 'occult', 'supernatural'],
    genericFictionTerms: [
      'horror',
      'haunted',
      'ghost',
      'vampire',
      'zombie',
      'monster',
      'supernatural',
    ],
  },
  'science fiction': {
    categories: ['science fiction', 'sci-fi', 'sci fi'],
    genericFictionTerms: [
      'science fiction',
      'sci-fi',
      'sci fi',
      'dystopian',
      'space opera',
      'interstellar',
      'alien',
    ],
  },
  adventure: {
    categories: ['adventure'],
    genericFictionTerms: [
      'adventure',
      'quest',
      'journey',
      'explorer',
      'expedition',
      'island',
      'treasure',
    ],
  },
  'young adult': {
    categories: [
      'young adult fiction',
      'juvenile fiction',
      'teen fiction',
    ],
    genericFictionTerms: [
      'young adult',
      'teen',
      'teenage',
      'high school',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
    ],
  },
  classics: {
    categories: [
      'classic',
      'classic-fiction',
      'literary classics',
      'literature',
      'fiction',
      'juvenile fiction',
    ],
  },
  history: {
    categories: ['history'],
  },
  biography: {
    categories: ['biography', 'autobiography', 'memoir'],
  },
  poetry: {
    categories: ['poetry'],
  },
  comics: {
    categories: [
      'comics',
      'comic books',
      'graphic novels',
      'manga',
      'cartoons',
    ],
  },
  'self help': {
    categories: [
      'self-help',
      'self help',
      'conduct of life',
      'personal growth',
      'health & fitness',
    ],
  },
  philosophy: {
    categories: ['philosophy', 'ethics', 'logic', 'metaphysics'],
  },
}

/**
 * Builds a Google Books subject query while preserving Dear Pages subject
 * values. Multi-word subjects must be quoted so Google treats them as a
 * single subject phrase instead of mixing a subject token with free text.
 *
 * @param {string} subject - Dear Pages genre subject.
 * @returns {string} Encoded Google Books query value.
 */
function createSubjectQuery(subject) {
  const normalizedSubject = String(subject || '').trim()
  const subjectQuery =
    GOOGLE_SUBJECT_QUERIES[normalizedSubject] ||
    (/\s/.test(normalizedSubject)
      ? `subject:"${normalizedSubject}"`
      : `subject:${normalizedSubject}`)

  return encodeURIComponent(subjectQuery)
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function metadataContainsAnyTerm(metadata, terms) {
  return terms.some((term) =>
    metadata.includes(normalizeSearchText(term))
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function metadataContainsAnyWholeTerm(metadata, terms) {
  return terms.some((term) => {
    const normalizedTerm = normalizeSearchText(term)

    if (/\s/.test(normalizedTerm)) {
      return metadata.includes(normalizedTerm)
    }

    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(
        normalizedTerm
      )}([^a-z0-9]|$)`
    ).test(metadata)
  })
}

function hasGenericFictionCategory(categories) {
  return categories.some((category) =>
    ['fiction', 'literature'].includes(category)
  )
}

/**
 * Checks whether a Google Books item reasonably matches the requested Dear
 * Pages subject. Category matches are preferred; limited text fallback is only
 * used when Google gives a broad fiction category for genres that need it.
 *
 * @param {Object} item - Raw Google Books item.
 * @param {string} subject - Dear Pages genre subject.
 * @returns {boolean} True when the item is relevant enough for recommendations.
 */
function isRelevantSubjectBook(item, subject) {
  const rule = SUBJECT_RELEVANCE_RULES[subject]

  if (!rule) return true

  const volumeInfo = item.volumeInfo || {}
  const categories = (volumeInfo.categories || []).map(
    normalizeSearchText
  )

  if (metadataContainsAnyTerm(categories.join(' '), rule.categories)) {
    return true
  }

  if (
    rule.genericFictionTerms &&
    hasGenericFictionCategory(categories)
  ) {
    const metadata = normalizeSearchText(
      [
        volumeInfo.title,
        volumeInfo.subtitle,
        volumeInfo.description,
      ].join(' ')
    )

    return metadataContainsAnyWholeTerm(
      metadata,
      rule.genericFictionTerms
    )
  }

  return false
}

function isGoogleBooksImageHost(hostname) {
  return (
    hostname === 'books.googleusercontent.com' ||
    /^books\.google\./.test(hostname) ||
    /^www\.google\./.test(hostname) ||
    /^google\./.test(hostname)
  )
}

/**
 * Keeps Google Books cover URLs as close as possible to the API response.
 *
 * Google Books `zoom` and size parameters can change both image dimensions and
 * crop behavior, so this helper only upgrades known Google image URLs to HTTPS
 * and rejects Google's generic no-cover asset when it is visible in the URL.
 *
 * @param {string|null} coverUrl - Cover URL returned by Google Books.
 * @returns {string|null} Original, HTTPS-normalized, or null cover URL.
 */
function normalizeGoogleBooksCoverUrl(coverUrl) {
  if (!coverUrl) {
    return coverUrl
  }

  try {
    const url = new URL(coverUrl)
    const hostname = url.hostname.toLowerCase()

    if (!isGoogleBooksImageHost(hostname)) {
      return coverUrl
    }

    const urlText = url.toString().toLowerCase()

    if (
      urlText.includes('/googlebooks/images/no_cover') ||
      urlText.includes('no_cover_thumb') ||
      urlText.includes('image_not_available')
    ) {
      return null
    }

    if (url.protocol === 'http:') {
      url.protocol = 'https:'
    }

    return url.toString()
  } catch {
    return coverUrl
  }
}

/**
 * Nettoie une description provenant de Google Books.
 *
 * Certaines descriptions contiennent des balises HTML ou des entités HTML
 * qui ne doivent pas apparaître telles quelles dans l'interface.
 *
 * @param {string} description - Description brute Google Books.
 * @returns {string} Description nettoyée.
 */
function cleanBookDescription(description = '') {
  return description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Formate un livre reçu depuis l'API Google Books
 * pour l'utiliser plus facilement dans l'application.
 *
 * @param {Object} item - Livre retourné par Google Books.
 * @returns {Object} Livre formaté pour Dear Pages.
 */
function formatBook(item) {
  const volumeInfo = item.volumeInfo || {}
  const isbns = getIndustryIdentifierIsbns(
    volumeInfo.industryIdentifiers || []
  )
  const isbn = getPreferredIsbn(isbns)

  return {
    id: item.id,
    googleBooksId: item.id,
    title: volumeInfo.title || 'Titre inconnu',
    subtitle: volumeInfo.subtitle || '',
    authors: volumeInfo.authors || ['Auteur inconnu'],
    isbn,
    isbns,

    cover: normalizeGoogleBooksCoverUrl(
      getBestGoogleCover(volumeInfo.imageLinks || {})
    ),

    description: cleanBookDescription(
      volumeInfo.description || ''
    ),

    categories: volumeInfo.categories || [],
    publishedDate: volumeInfo.publishedDate || '',
    language: volumeInfo.language || '',
    printType: volumeInfo.printType || '',
    source: 'google-books',
  }
}

/**
 * Effectue une requête vers Google Books.
 *
 * @param {string} url - URL Google Books à appeler.
 * @param {string} message - Message d'erreur à utiliser si la requête échoue.
 * @returns {Promise<Object>} Réponse JSON Google Books.
 */
async function getGoogleBooksData(url, message) {
  try {
    return await fetchJsonOnce(url)
  } catch {
    throw new Error(message)
  }
}

function createVolumesSearchUrl(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(options.maxResults || SEARCH_RESULTS_LIMIT),
  })

  if (options.printType) {
    params.set('printType', options.printType)
  }

  if (API_KEY) {
    params.set('key', API_KEY)
  }

  return `${BASE_URL}?${params.toString()}`
}

async function searchGoogleBooksCandidates(
  query,
  maxResults,
  message
) {
  const data = await getGoogleBooksData(
    createVolumesSearchUrl(query, {
      maxResults,
      printType: 'books',
    }),
    message
  )

  return data.items?.map(formatBook) || []
}

/**
 * Recherche des livres dans l'API Google Books.
 *
 * @param {string} query - Recherche saisie par l'utilisateur.
 * @returns {Promise<Array>} Liste des livres trouvés et formatés.
 */
export async function searchBooks(query) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) return []

  const broadCandidates = await searchGoogleBooksCandidates(
    trimmedQuery,
    SEARCH_CANDIDATE_LIMIT,
    'Impossible de récupérer les livres.'
  )

  const titleCandidates = await searchGoogleBooksCandidates(
    buildTitleSearchQuery(trimmedQuery),
    TITLE_SEARCH_CANDIDATE_LIMIT,
    'Impossible de récupérer les livres.'
  )

  const rankedInitialCandidates = mergeAndRankSearchBooks(
    [broadCandidates, titleCandidates],
    trimmedQuery,
    SEARCH_RESULTS_LIMIT
  )

  const authorQuery = buildAuthorSearchQuery(trimmedQuery)

  if (
    !authorQuery ||
    hasSufficientSearchMatches(
      rankedInitialCandidates,
      trimmedQuery
    )
  ) {
    return rankedInitialCandidates
  }

  const authorCandidates = await searchGoogleBooksCandidates(
    authorQuery,
    TITLE_SEARCH_CANDIDATE_LIMIT,
    'Impossible de récupérer les livres.'
  )

  return mergeAndRankSearchBooks(
    [broadCandidates, titleCandidates, authorCandidates],
    trimmedQuery,
    SEARCH_RESULTS_LIMIT
  )
}

/**
 * Récupère quelques suggestions de livres à partir
 * de la recherche saisie par l'utilisateur.
 *
 * @param {string} query - Texte actuellement saisi.
 * @returns {Promise<Array>} Liste courte de livres suggérés.
 */
export async function getBookSuggestions(query) {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 2) {
    return []
  }

  const candidates = await searchGoogleBooksCandidates(
    trimmedQuery,
    SUGGESTION_CANDIDATE_LIMIT,
    'Impossible de récupérer les suggestions.'
  )

  return mergeAndRankSearchBooks(
    [candidates],
    trimmedQuery,
    SUGGESTION_RESULTS_LIMIT
  )
}

/**
 * Récupère des livres appartenant à une catégorie Google Books.
 *
 * @param {string} subject - Catégorie de livres à rechercher.
 * @param {number} [maxResults=10] - Nombre maximum de livres.
 * @param {number} [startIndex=0] - Position du premier résultat.
 * @returns {Promise<Array>} Liste de livres formatés.
 */
export async function getBooksBySubject(
  subject,
  maxResults = 10,
  startIndex = 0
) {
  const { books } = await getBooksBySubjectWindow(
    subject,
    maxResults,
    startIndex
  )

  return books
}

export async function getBooksBySubjectWindow(
  subject,
  maxResults = 10,
  startIndex = 0
) {
  const data = await getGoogleBooksData(
    `${BASE_URL}?q=${createSubjectQuery(
      subject
    )}&langRestrict=fr&maxResults=${maxResults}&startIndex=${startIndex}&key=${API_KEY}`,
    'Impossible de récupérer cette sélection de livres.'
  )

  const items = data.items || []

  return {
    books: items
      .filter((item) => isRelevantSubjectBook(item, subject))
      .map(formatBook),
    returnedCount: items.length,
    nextStartIndex: startIndex + items.length,
  }
}

/**
 * Recherche un livre Google Books à partir de son ISBN.
 *
 * @param {string} isbn - ISBN du livre à rechercher.
 * @returns {Promise<Object|null>} Livre formaté ou null.
 */
export async function getBookByIsbn(isbn) {
  if (!isbn) {
    return null
  }

  const data = await getGoogleBooksData(
    `${BASE_URL}?q=isbn:${encodeURIComponent(
      isbn
    )}&langRestrict=fr&maxResults=1&key=${API_KEY}`,
    'Impossible de récupérer les informations du livre.'
  )

  const item = data.items?.[0]

  return item ? formatBook(item) : null
}

/**
 * Récupère la fiche complète du volume Google Books sélectionné.
 *
 * @param {string} bookId - Identifiant Google Books du livre.
 * @returns {Promise<Object|null>} Livre formaté pour Dear Pages.
 */
export async function getBookById(bookId) {
  if (!bookId) {
    return null
  }

  const data = await getGoogleBooksData(
    `${BASE_URL}/${encodeURIComponent(
      bookId
    )}?key=${API_KEY}`,
    'Impossible de récupérer ce livre.'
  )

  return formatBook(data)
}
