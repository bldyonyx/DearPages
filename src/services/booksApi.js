
import { fetchJsonOnce } from '../utils/inFlightRequest'

import {
  buildAuthorSearchQuery,
  buildTitleSearchQuery,
  getConfirmedTitleAuthorParts,
  isConfirmedAuthorSearch,
  mergeAndRankSearchBooks,
} from '../utils/bookSearchRelevance.js'

import {
  getBestGoogleCover,
  getIndustryIdentifierIsbns,
  getPreferredIsbn,
} from './coverUtils.js'

import { getOpenLibraryBooksBySearch } from './trendingBooksApi.js'

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY

const SEARCH_RESULTS_LIMIT = 20
const SEARCH_CANDIDATE_LIMIT = 40
const TITLE_SEARCH_CANDIDATE_LIMIT = 20
const OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT = 20
const SUGGESTION_CANDIDATE_LIMIT = 10
const SUGGESTION_RESULTS_LIMIT = 5

const GOOGLE_SUBJECT_QUERIES = {
  crime: 'subject:"crime fiction"',
  comics: 'subject:"comics graphic novels"',
  'young adult': 'subject:"young adult fiction"',
}

const GOOGLE_BOOKS_RETRY_DELAY_MS = 250

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
    categories: [
      'horror',
      'ghost',
      'occult',
      'supernatural',
    ],
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
    categories: [
      'science fiction',
      'sci-fi',
      'sci fi',
    ],
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
    categories: [
      'biography',
      'autobiography',
      'memoir',
    ],
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
    categories: [
      'philosophy',
      'ethics',
      'logic',
      'metaphysics',
    ],
  },
}

/**
 * Construit une recherche Google Books par sujet.
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
 * Vérifie la pertinence d'un livre pour un sujet.
 */
function isRelevantSubjectBook(item, subject) {
  const rule = SUBJECT_RELEVANCE_RULES[subject]

  if (!rule) return true

  const volumeInfo = item.volumeInfo || {}

  const categories = (volumeInfo.categories || []).map(
    normalizeSearchText
  )

  if (
    metadataContainsAnyTerm(
      categories.join(' '),
      rule.categories
    )
  ) {
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
 * Normalise les URLs des couvertures Google Books.
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
 * Nettoie les descriptions Google Books.
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
 * Formate un livre Google Books pour Dear Pages.
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
 * Gestion des requêtes Google Books.
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetryableGoogleBooksError(error) {
  return error.status === 503
}

function createGoogleBooksError(message, error) {
  const wrappedError = new Error(message)

  wrappedError.status = error.status
  wrappedError.apiError = error.apiError
  wrappedError.cause = error

  return wrappedError
}

async function getGoogleBooksData(url, message) {
  try {
    return await fetchJsonOnce(url)
  } catch (error) {
    if (isRetryableGoogleBooksError(error)) {
      try {
        await delay(GOOGLE_BOOKS_RETRY_DELAY_MS)
        return await fetchJsonOnce(url)
      } catch (retryError) {
        throw createGoogleBooksError(message, retryError)
      }
    }

    throw createGoogleBooksError(message, error)
  }
}

/**
 * Construit l'URL Google Books.
 */
function createVolumesSearchUrl(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(
      options.maxResults || SEARCH_RESULTS_LIMIT
    ),
  })

  if (options.startIndex) {
    params.set(
      'startIndex',
      String(options.startIndex)
    )
  }

  if (options.printType) {
    params.set('printType', options.printType)
  }

  if (API_KEY) {
    params.set('key', API_KEY)
  }

  return `${BASE_URL}?${params.toString()}`
}

/**
 * Récupère des candidats Google Books.
 */
async function searchGoogleBooksCandidates(
  query,
  maxResults,
  message,
  startIndex = 0
) {
  const data = await getGoogleBooksData(
    createVolumesSearchUrl(query, {
      maxResults,
      startIndex,
      printType: 'books',
    }),
    message
  )

  return data.items?.map(formatBook) || []
}

function getFulfilledCandidateGroups(results) {
  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
}

function getFirstRejectedSearchError(results) {
  return (
    results.find(
      (result) =>
        result.status === 'rejected' && result.reason?.status
    )?.reason ||
    results.find(
      (result) => result.status === 'rejected'
    )?.reason
  )
}

/**
 * Recherche principale dans Découvrir.
 *
 * Combine Google Books et Open Library.
 * Détecte les recherches par auteur et titre + auteur
 * à partir des métadonnées des livres.
 */
export async function searchBooks(query) {
  const trimmedQuery = String(query || '').trim()

  if (!trimmedQuery) return []

  const errorMessage = 'Impossible de récupérer les livres.'
  const candidateGroups = []

  const tokens = trimmedQuery.split(/\s+/)

  const possibleAuthor =
    tokens.length >= 2 && tokens.length <= 3

  const possibleCombined = tokens.length >= 3
  const authorName = tokens.slice(-2).join(' ')
  const titlePart = tokens.slice(0, -2).join(' ')

  const requests = [
    searchGoogleBooksCandidates(
      buildTitleSearchQuery(trimmedQuery),
      TITLE_SEARCH_CANDIDATE_LIMIT,
      errorMessage
    ),

    searchGoogleBooksCandidates(
      trimmedQuery,
      SEARCH_CANDIDATE_LIMIT,
      errorMessage
    ),

    getOpenLibraryBooksBySearch({
      title: trimmedQuery,
      limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
    }),
  ]

  // Chercher aussi par auteur, même lorsqu'une biographie
  // porte exactement le nom recherché.
  if (possibleAuthor) {
    requests.push(
      searchGoogleBooksCandidates(
        buildAuthorSearchQuery(trimmedQuery),
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage
      ),

      getOpenLibraryBooksBySearch({
        author: trimmedQuery,
        limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
      })
    )
  }

  // Chercher titre + auteur, y compris les requêtes
  // de trois mots comme "Misery Stephen King".
  if (possibleCombined && titlePart) {
    requests.push(
      searchGoogleBooksCandidates(
        `intitle:"${titlePart}" inauthor:${tokens.at(-1)}`,
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage
      ),

      getOpenLibraryBooksBySearch({
        title: titlePart,
        author: authorName,
        limit: OPEN_LIBRARY_SEARCH_CANDIDATE_LIMIT,
      })
    )
  }

  const initialResults = await Promise.allSettled(requests)

  candidateGroups.push(
    ...getFulfilledCandidateGroups(initialResults)
  )

  if (candidateGroups.length === 0) {
    throw getFirstRejectedSearchError(initialResults)
  }

  // L'intention n'est confirmée que si les résultats
  // contiennent des métadonnées correspondantes.
  const getIntent = () => {
    const candidates = candidateGroups.flat()

    const combined = getConfirmedTitleAuthorParts(
      candidates,
      trimmedQuery
    )

    return {
      combined,
      authorOnly:
        !combined &&
        isConfirmedAuthorSearch(candidates, trimmedQuery),
    }
  }

  let ranked = mergeAndRankSearchBooks(
    candidateGroups,
    trimmedQuery,
    SEARCH_RESULTS_LIMIT,
    getIntent()
  )

  // Pagination supplémentaire si aucun résultat pertinent.
  if (!ranked.length && !getIntent().authorOnly) {
    const extra = await Promise.allSettled([
      searchGoogleBooksCandidates(
        buildTitleSearchQuery(trimmedQuery),
        TITLE_SEARCH_CANDIDATE_LIMIT,
        errorMessage,
        TITLE_SEARCH_CANDIDATE_LIMIT
      ),
    ])

    candidateGroups.push(
      ...getFulfilledCandidateGroups(extra)
    )

    ranked = mergeAndRankSearchBooks(
      candidateGroups,
      trimmedQuery,
      SEARCH_RESULTS_LIMIT,
      getIntent()
    )
  }

  return ranked
}

/**
 * Suggestions pendant la saisie.
 */

export async function getBookSuggestions(query) {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 2) {
    return []
  }

  const tokens = trimmedQuery.split(/\s+/)

  // Pour une recherche complète comme "Misery Stephen King",
  // réutiliser les résultats pertinents de la recherche principale.
  if (tokens.length >= 2) {
    const books = await searchBooks(trimmedQuery)

    return books.slice(0, SUGGESTION_RESULTS_LIMIT)
  }

  // Pour les recherches courtes, conserver les suggestions
  // Google Books afin de limiter les appels API.
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
 * Livres d'une catégorie Google Books.
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
      .filter((item) =>
        isRelevantSubjectBook(item, subject)
      )
      .map(formatBook),

    returnedCount: items.length,
    nextStartIndex: startIndex + items.length,
  }
}

/**
 * Recherche par ISBN.
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
 * Récupère une fiche Google Books par son ID.
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
