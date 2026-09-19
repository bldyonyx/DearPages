import { fetchJsonOnce } from '../utils/inFlightRequest'

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY

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

  const isbns =
    volumeInfo.industryIdentifiers
      ?.map((identifier) => identifier.identifier)
      .filter(Boolean) || []

  return {
    id: item.id,
    googleBooksId: item.id,
    title: volumeInfo.title || 'Titre inconnu',
    authors: volumeInfo.authors || ['Auteur inconnu'],
    isbn: isbns[0] || null,
    isbns,

    cover: normalizeGoogleBooksCoverUrl(
      volumeInfo.imageLinks?.extraLarge ||
        volumeInfo.imageLinks?.large ||
        volumeInfo.imageLinks?.medium ||
        volumeInfo.imageLinks?.small ||
        volumeInfo.imageLinks?.thumbnail ||
        volumeInfo.imageLinks?.smallThumbnail ||
        null
    ),

    description: cleanBookDescription(
      volumeInfo.description || ''
    ),

    categories: volumeInfo.categories || [],
    publishedDate: volumeInfo.publishedDate || '',
    language: volumeInfo.language || '',
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

/**
 * Choisit le meilleur résultat français parmi une liste Google Books.
 *
 * Les éditions françaises possédant une description sont privilégiées,
 * puis celles possédant une couverture.
 *
 * @param {Array} items - Résultats bruts Google Books.
 * @returns {Object|null} Meilleure édition française trouvée.
 */
function findBestFrenchEdition(items = []) {
  const frenchItems = items.filter(
    (item) => item.volumeInfo?.language === 'fr'
  )

  if (frenchItems.length === 0) {
    return null
  }

  return (
    frenchItems.find(
      (item) =>
        item.volumeInfo?.description &&
        item.volumeInfo?.imageLinks
    ) ||
    frenchItems.find(
      (item) => item.volumeInfo?.description
    ) ||
    frenchItems.find(
      (item) => item.volumeInfo?.imageLinks
    ) ||
    frenchItems[0]
  )
}

/**
 * Recherche une édition française correspondant à un livre.
 *
 * La recherche essaie d'abord les ISBN, qui sont les identifiants
 * les plus précis. Si aucune édition française n'est trouvée,
 * une recherche titre + auteur est utilisée comme solution de repli.
 *
 * @param {Object} book - Livre Dear Pages formaté.
 * @returns {Promise<Object|null>} Édition française brute ou null.
 */
async function findFrenchEdition(book) {
  for (const isbn of book.isbns) {
    const data = await getGoogleBooksData(
      `${BASE_URL}?q=isbn:${encodeURIComponent(
        isbn
      )}&langRestrict=fr&maxResults=10&key=${API_KEY}`,
      'Impossible de rechercher une édition française.'
    )

    const frenchEdition = findBestFrenchEdition(
      data.items || []
    )

    if (frenchEdition) {
      return frenchEdition
    }
  }

  const mainAuthor = book.authors[0]

  if (!book.title || !mainAuthor) {
    return null
  }

  const query = `intitle:${book.title}+inauthor:${mainAuthor}`

  const data = await getGoogleBooksData(
    `${BASE_URL}?q=${encodeURIComponent(
      query
    )}&langRestrict=fr&maxResults=10&key=${API_KEY}`,
    'Impossible de rechercher une édition française.'
  )

  return findBestFrenchEdition(data.items || [])
}

/**
 * Fusionne les métadonnées d'une édition française avec le volume
 * initialement sélectionné.
 *
 * L'identifiant Google Books original est conservé afin que les routes
 * et les livres déjà stockés dans Firebase restent cohérents.
 *
 * @param {Object} originalBook - Livre initial.
 * @param {Object} frenchItem - Édition française Google Books.
 * @returns {Object} Livre enrichi avec les métadonnées françaises.
 */
function mergeFrenchMetadata(originalBook, frenchItem) {
  const frenchBook = formatBook(frenchItem)

  return {
    ...originalBook,

    title:
      frenchBook.title !== 'Titre inconnu'
        ? frenchBook.title
        : originalBook.title,

    description:
      frenchBook.description ||
      originalBook.description,

    categories:
      frenchBook.categories.length > 0
        ? frenchBook.categories
        : originalBook.categories,

    publishedDate:
      frenchBook.publishedDate ||
      originalBook.publishedDate,

    cover:
      frenchBook.cover ||
      originalBook.cover,

    language: 'fr',
  }
}

/**
 * Recherche des livres dans l'API Google Books.
 *
 * @param {string} query - Recherche saisie par l'utilisateur.
 * @returns {Promise<Array>} Liste des livres trouvés et formatés.
 */
export async function searchBooks(query) {
  const data = await getGoogleBooksData(
    `${BASE_URL}?q=${encodeURIComponent(
      query
    )}&langRestrict=fr&maxResults=20&key=${API_KEY}`,
    'Impossible de récupérer les livres.'
  )

  return data.items?.map(formatBook) || []
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

  const data = await getGoogleBooksData(
    `${BASE_URL}?q=${encodeURIComponent(
      trimmedQuery
    )}&langRestrict=fr&maxResults=5&key=${API_KEY}`,
    'Impossible de récupérer les suggestions.'
  )

  return data.items?.map(formatBook) || []
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
  const data = await getGoogleBooksData(
    `${BASE_URL}?q=subject:${encodeURIComponent(
      subject
    )}&langRestrict=fr&maxResults=${maxResults}&startIndex=${startIndex}&key=${API_KEY}`,
    'Impossible de récupérer cette sélection de livres.'
  )

  return data.items?.map(formatBook) || []
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
 * Récupère la fiche complète d'un livre.
 *
 * Si le volume sélectionné n'est pas français, Dear Pages essaie
 * de trouver une édition française du même livre afin d'utiliser
 * son titre, sa description et ses métadonnées lorsqu'elles existent.
 *
 * L'identifiant Google Books du volume original reste inchangé.
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

  const originalBook = formatBook(data)

  if (originalBook.language === 'fr') {
    return originalBook
  }

  try {
    const frenchEdition = await findFrenchEdition(
      originalBook
    )

    if (!frenchEdition) {
      return originalBook
    }

    return mergeFrenchMetadata(
      originalBook,
      frenchEdition
    )
  } catch (error) {
    console.warn(
      'Édition française introuvable :',
      error
    )

    return originalBook
  }
}