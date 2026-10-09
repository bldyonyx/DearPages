
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../services/books/googleBooksApi.js', () => ({
  createVolumesSearchUrl: vi.fn(
    (query) => `https://example.com/books?q=${encodeURIComponent(query)}`
  ),
  getGoogleBooksData: vi.fn(),
}))

import {
  createVolumesSearchUrl,
  getGoogleBooksData,
} from '../services/books/googleBooksApi.js'

import { getBookEditions } from '../services/books/bookEditionsService.js'

const originalBook = {
  id: 'original-id',
  googleBooksId: 'original-id',
  title: 'The Hobbit',
  authors: ['J. R. R. Tolkien'],
  language: 'en',
  isbn: '9780000000001',
  isbns: ['9780000000001'],
  source: 'google-books',
}

function createGoogleVolume({
  id,
  title = 'The Hobbit',
  author = 'J. R. R. Tolkien',
  language = 'en',
  isbn,
}) {
  return {
    id,
    volumeInfo: {
      title,
      authors: [author],
      language,
      industryIdentifiers: isbn
        ? [{ type: 'ISBN_13', identifier: isbn }]
        : [],
    },
  }
}

describe('getBookEditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array without a valid title or author', async () => {
    expect(await getBookEditions(null)).toEqual([])
    expect(
      await getBookEditions({ title: 'The Hobbit', authors: [] })
    ).toEqual([])

    expect(getGoogleBooksData).not.toHaveBeenCalled()
  })

  it('finds French and English editions of the same book', async () => {
    getGoogleBooksData.mockResolvedValue({
      items: [
        createGoogleVolume({
          id: 'english-edition',
          isbn: '9780000000002',
        }),
        createGoogleVolume({
          id: 'french-edition',
          language: 'fr',
          isbn: '9780000000003',
        }),
        createGoogleVolume({
          id: 'spanish-edition',
          language: 'es',
          isbn: '9780000000004',
        }),
      ],
    })

    const editions = await getBookEditions(originalBook)

    expect(editions.map((edition) => edition.googleBooksId)).toEqual([
      'french-edition',
      'original-id',
      'english-edition',
    ])

    expect(createVolumesSearchUrl).toHaveBeenCalledOnce()
    expect(getGoogleBooksData).toHaveBeenCalledOnce()
  })

  it('rejects books by another author or with another title', async () => {
    getGoogleBooksData.mockResolvedValue({
      items: [
        createGoogleVolume({
          id: 'wrong-author',
          author: 'Another Author',
        }),
        createGoogleVolume({
          id: 'wrong-title',
          title: 'The Silmarillion',
        }),
      ],
    })

    const editions = await getBookEditions(originalBook)

    expect(editions.map((edition) => edition.googleBooksId)).toEqual([
      'original-id',
    ])
  })

  it('removes duplicate ISBNs', async () => {
    getGoogleBooksData.mockResolvedValue({
      items: [
        createGoogleVolume({
          id: 'duplicate-original',
          isbn: '9780000000001',
        }),
        createGoogleVolume({
          id: 'unique-edition',
          isbn: '9780000000005',
        }),
      ],
    })

    const editions = await getBookEditions(originalBook)

    expect(editions).toHaveLength(2)
    expect(editions.map((edition) => edition.googleBooksId)).toContain(
      'unique-edition'
    )
  })

  it('keeps separate editions when ISBNs are missing', async () => {
    getGoogleBooksData.mockResolvedValue({
      items: [
        createGoogleVolume({ id: 'edition-a' }),
        createGoogleVolume({ id: 'edition-b' }),
      ],
    })

    const editions = await getBookEditions(originalBook)

    expect(editions).toHaveLength(3)
  })

  it('propagates API errors to the caller', async () => {
    getGoogleBooksData.mockRejectedValue(
      new Error('Google Books unavailable')
    )

    await expect(getBookEditions(originalBook)).rejects.toThrow(
      'Google Books unavailable'
    )
  })
})
