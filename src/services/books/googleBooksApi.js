
import { fetchJsonOnce } from '../../utils/inFlightRequest'

import { formatGoogleBook } from './googleBooksFormatter.js'

export const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'
export const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY

const GOOGLE_BOOKS_RETRY_DELAY_MS = 250
const SEARCH_RESULTS_LIMIT = 20

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

export async function getGoogleBooksData(url, message) {
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

export function createVolumesSearchUrl(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(options.maxResults || SEARCH_RESULTS_LIMIT),
  })

  if (options.startIndex) {
    params.set('startIndex', String(options.startIndex))
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
 * Recherche un livre par ISBN.
 */
export async function getBookByIsbn(isbn) {
  if (!isbn) {
    return null
  }

  const keyParam = API_KEY
    ? `&key=${encodeURIComponent(API_KEY)}`
    : ''

  const data = await getGoogleBooksData(
    `${BASE_URL}?q=isbn:${encodeURIComponent(
      isbn
    )}&langRestrict=fr&maxResults=1${keyParam}`,
    'Impossible de récupérer les informations du livre.'
  )

  const item = data.items?.[0]

  return item ? formatGoogleBook(item) : null
}

/**
 * Récupère une fiche Google Books par son ID.
 */
export async function getBookById(bookId) {
  if (!bookId) {
    return null
  }

  const keyParam = API_KEY
    ? `?key=${encodeURIComponent(API_KEY)}`
    : ''

  const data = await getGoogleBooksData(
    `${BASE_URL}/${encodeURIComponent(
      bookId
    )}${keyParam}`,
    'Impossible de récupérer ce livre.'
  )

  return formatGoogleBook(data)
}
