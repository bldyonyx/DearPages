
import {
  getBestGoogleCover,
  getIndustryIdentifierIsbns,
  getPreferredIsbn,
} from './coverUtils.js'

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
export function formatGoogleBook(item) {
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
