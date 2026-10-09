
import {
  BASE_URL,
  API_KEY,
  getGoogleBooksData,
} from './googleBooksApi.js'

import { formatGoogleBook } from './googleBooksFormatter.js'

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
  const keyParam = API_KEY
    ? `&key=${encodeURIComponent(API_KEY)}`
    : ''

  const data = await getGoogleBooksData(
    `${BASE_URL}?q=${createSubjectQuery(
      subject
    )}&langRestrict=fr&maxResults=${maxResults}&startIndex=${startIndex}${keyParam}`,
    'Impossible de récupérer cette sélection de livres.'
  )

  const items = data.items || []

  return {
    books: items
      .filter((item) =>
        isRelevantSubjectBook(item, subject)
      )
      .map(formatGoogleBook),

    returnedCount: items.length,
    nextStartIndex: startIndex + items.length,
  }
}
