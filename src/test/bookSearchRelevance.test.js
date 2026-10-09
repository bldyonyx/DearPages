import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorSearchQuery,
  buildTitleSearchQuery,
  getSearchBookIdentityKeys,
  mergeAndRankSearchBooks,
  normalizeSearchText,
  scoreAuthorRelevance,
  scoreTitleRelevance,
  tokenizeSearchText,
} from '../utils/bookSearchRelevance.js'

function book({
  id,
  title,
  subtitle = '',
  authors = ['Auteur inconnu'],
  isbn = '',
  isbns = [],
  language = 'en',
  cover = 'https://example.com/cover.jpg',
  description = 'Useful search metadata.',
}) {
  return {
    id,
    googleBooksId: id,
    title,
    subtitle,
    authors,
    isbn,
    isbns,
    language,
    cover,
    description,
    source: 'google-books',
  }
}

function googleItem(
  id,
  title,
  authors = ['Auteur inconnu'],
  categories = [],
  overrides = {}
) {
  return {
    id,
    volumeInfo: {
      title,
      authors,
      industryIdentifiers: [],
      language: 'en',
      printType: 'BOOK',
      description: 'Useful search metadata.',
      imageLinks: {
        thumbnail:
          'https://books.google.com/books/content?id=cover&printsec=frontcover&img=1&zoom=1',
      },
      categories,
      ...overrides,
    },
  }
}

function successfulResponse(items) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ items }),
  })
}

function openLibraryDoc(id, title, authors = ['Auteur inconnu'], overrides = {}) {
  return {
    key: `/works/${id}`,
    title,
    author_name: authors,
    cover_i: 12345,
    first_sentence: ['Useful search metadata.'],
    ...overrides,
  }
}

function successfulOpenLibraryResponse(docs = []) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ docs }),
  })
}

function failedResponse(status, reason = 'backendFailed') {
  return Promise.resolve({
    ok: false,
    status,
    json: () =>
      Promise.resolve({
        error: {
          message: 'Service temporarily unavailable.',
          errors: [{ reason }],
        },
      }),
  })
}

function getRequestQuery(call) {
  const url = new URL(call[0])

  return url.searchParams.get('q')
}

function getRequestParam(call, name) {
  const url = new URL(call[0])

  return url.searchParams.get(name)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('book search normalization', () => {
  it('normalizes accents, punctuation, initials, and whitespace', () => {
    expect(normalizeSearchText('  George R.R. Martin  ')).toBe(
      'george r r martin'
    )
    expect(normalizeSearchText('L’Étranger!!!')).toBe('l etranger')
    expect(tokenizeSearchText('George R.R. Martin')).toEqual([
      'george',
      'r',
      'r',
      'martin',
    ])
  })

  it('builds controlled title and author Google Books queries', () => {
    expect(buildTitleSearchQuery('Harry Potter')).toBe(
      'intitle:"Harry Potter"'
    )
    expect(buildAuthorSearchQuery('George Martin')).toBe(
      'george martin inauthor:martin'
    )
    expect(buildAuthorSearchQuery('George R R Martin')).toBe(
      'george martin inauthor:martin'
    )
    expect(buildAuthorSearchQuery('Dune')).toBe('')
  })
})

describe('book search relevance scoring', () => {
  it('matches George Martin to George R. R. Martin', () => {
    const result = book({
      id: 'grrm',
      title: 'A Game of Thrones',
      authors: ['George R. R. Martin'],
    })

    expect(scoreAuthorRelevance(result, 'George Martin')).toBeGreaterThanOrEqual(
      90
    )
  })

  it('matches George R R Martin author searches', () => {
    const result = book({
      id: 'grrm',
      title: 'A Game of Thrones',
      authors: ['George R. R. Martin'],
    })

    expect(
      scoreAuthorRelevance(result, 'George R R Martin')
    ).toBeGreaterThanOrEqual(95)
  })

  it('matches George R.R. Martin author searches', () => {
    const result = book({
      id: 'grrm',
      title: 'A Game of Thrones',
      authors: ['George R. R. Martin'],
    })

    expect(
      scoreAuthorRelevance(result, 'George R.R. Martin')
    ).toBeGreaterThanOrEqual(95)
  })

  it('prioritizes Dune as an exact title match', () => {
    const dune = book({
      id: 'dune',
      title: 'Dune',
      authors: ['Frank Herbert'],
    })
    const sequel = book({
      id: 'messiah',
      title: 'Dune Messiah',
      authors: ['Frank Herbert'],
    })

    expect(scoreTitleRelevance(dune, 'Dune')).toBeGreaterThan(
      scoreTitleRelevance(sequel, 'Dune')
    )
  })

  it('prioritizes Harry Potter phrase title matches', () => {
    const phraseMatch = book({
      id: 'hp',
      title: 'Harry Potter and the Philosopher’s Stone',
      authors: ['J. K. Rowling'],
    })
    const partialMatch = book({
      id: 'harry',
      title: 'Harry, a History',
      authors: ['Melissa Anelli'],
    })

    expect(
      scoreTitleRelevance(phraseMatch, 'Harry Potter')
    ).toBeGreaterThan(scoreTitleRelevance(partialMatch, 'Harry Potter'))
  })

  it('keeps broad Harry title-token matches above weak matches', () => {
    const titleMatch = book({
      id: 'harry-title',
      title: 'Harry, a History',
      authors: ['Melissa Anelli'],
    })
    const weakMatch = book({
      id: 'weak',
      title: 'A Wizarding Companion',
      authors: ['Harry Smith'],
    })

    expect(scoreTitleRelevance(titleMatch, 'Harry')).toBeGreaterThan(
      scoreTitleRelevance(weakMatch, 'Harry')
    )
  })
})

describe('book search merge and ranking', () => {
  it('deduplicates by Google Books id, ISBN, then title and primary author', () => {
    const candidates = [
      book({
        id: 'same-google-id',
        title: 'Dune',
        authors: ['Frank Herbert'],
      }),
      book({
        id: 'same-google-id',
        title: 'Dune',
        authors: ['Frank Herbert'],
      }),
      book({
        id: 'isbn-a',
        title: 'Dune',
        authors: ['Isaac Asimov'],
        isbn: '9780441172719',
      }),
      book({
        id: 'isbn-b',
        title: 'Dune Deluxe',
        authors: ['Isaac Asimov'],
        isbn: '978-0-441-17271-9',
      }),
      book({
        id: 'title-author-a',
        title: 'Dune',
        authors: ['J. K. Rowling'],
      }),
      book({
        id: 'title-author-b',
        title: 'Dune',
        authors: ['J. K. Rowling'],
      }),
    ]

    const result = mergeAndRankSearchBooks([candidates], 'Dune', 20)

    expect(result.map((item) => item.id)).toEqual([
      'same-google-id',
      'isbn-a',
      'title-author-a',
    ])
  })

  it('returns at most the requested final result limit', () => {
    const candidates = Array.from({ length: 30 }, (_, index) =>
      book({
        id: `book-${index}`,
        title: `Harry Book ${index}`,
        authors: ['Author'],
      })
    )

    expect(mergeAndRankSearchBooks([candidates], 'Harry', 20)).toHaveLength(
      20
    )
  })

  it('creates stable identity keys for search deduplication', () => {
    expect(
      getSearchBookIdentityKeys(
        book({
          id: 'google-1',
          title: 'L’Étranger',
          authors: ['Albert Camus'],
          isbn: '978-2-07-036002-4',
        })
      )
    ).toEqual([
      'google:google-1',
      'isbn:9782070360024',
      'title-author:l etranger:albert camus',
    ])
  })

  it('excludes records with neither a cover nor description', () => {
    const candidates = [
      book({
        id: 'empty-record',
        title: 'The Housemaid',
        cover: null,
        description: '',
      }),
      book({
        id: 'known-author',
        title: 'The Housemaid',
        authors: ['Freida McFadden'],
        cover: null,
        description: 'A domestic thriller.',
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      'The Housemaid',
      20
    )

    expect(result.map((item) => item.id)).toEqual(['known-author'])
  })

  it('keeps relevant books without covers when they have other useful metadata', () => {
    const candidates = [
      book({
        id: 'description-only-quality',
        title: 'The Housemaid',
        description: 'A domestic thriller.',
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      'The Housemaid',
      20
    )

    expect(result.map((item) => item.id)).toEqual([
      'description-only-quality',
    ])
  })

  it('uses metadata quality only as a secondary ranking signal', () => {
    const candidates = [
      book({
        id: 'weak-with-metadata',
        title: 'The Housemaid Stories',
        authors: ['Known Author'],
        cover: 'https://example.com/cover.jpg',
        description: 'Useful metadata.',
      }),
      book({
        id: 'exact-with-author',
        title: 'The Housemaid',
        authors: ['Freida McFadden'],
        cover: null,
        description: 'A domestic thriller.',
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      'The Housemaid',
      20
    )

    expect(result.map((item) => item.id)).toEqual([
      'exact-with-author',
      'weak-with-metadata',
    ])
  })

  it('uses metadata quality to order otherwise equal relevant records', () => {
    const candidates = [
      book({
        id: 'exact-sparse',
        title: 'The Housemaid',
        authors: ['Freida McFadden'],
        cover: null,
        description: 'A sparse but usable record.',
      }),
      book({
        id: 'exact-rich',
        title: 'The Housemaid',
        authors: ['Amma Darko'],
        cover: 'https://example.com/cover.jpg',
        description: 'A complete search record.',
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      'The Housemaid',
      20
    )

    expect(result.map((item) => item.id)).toEqual([
      'exact-rich',
      'exact-sparse',
    ])
    expect(result[0].cover).toBe('https://example.com/cover.jpg')
    expect(result[0].description).toBe('A complete search record.')
  })
})

describe('booksApi search request behavior', () => {
  it('uses title, broad, Open Library title, and author requests for two-token searches', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem(
            'hp-1',
            'Harry Potter and the Philosopher’s Stone',
            ['J. K. Rowling']
          ),
        ])
      )
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem(
            'hp-2',
            'Harry Potter and the Chamber of Secrets',
            ['J. K. Rowling']
          ),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Harry Potter')

    expect(results).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(getRequestQuery(fetchMock.mock.calls[0])).toBe(
      'intitle:"Harry Potter"'
    )
    expect(getRequestQuery(fetchMock.mock.calls[1])).toBe('Harry Potter')
    expect(getRequestParam(fetchMock.mock.calls[2], 'title')).toBe(
      'Harry Potter'
    )
    expect(getRequestQuery(fetchMock.mock.calls[3])).toBe(
      'harry potter inauthor:potter'
    )
    expect(getRequestParam(fetchMock.mock.calls[4], 'author')).toBe(
      'Harry Potter'
    )
    expect(fetchMock.mock.calls[0][0]).not.toContain('langRestrict')
  })

  it('includes author requests for possible author searches', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('weak-1', 'Martin Eden', ['Jack London']),
        ])
      )
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('weak-2', 'George and the Dragon', ['Margaret Hodges']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('grrm', 'A Game of Thrones', ['George R. R. Martin']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('George Martin')

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(getRequestQuery(fetchMock.mock.calls[3])).toBe(
      'george martin inauthor:martin'
    )
    expect(results[0].id).toBe('grrm')
  })

  it('keeps single-token autocomplete to one broad request and returns five ranked suggestions', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      successfulResponse(
        Array.from({ length: 10 }, (_, index) =>
          googleItem(`harry-${index}`, `Harry Book ${index}`, [
            'Author',
          ])
        )
      )
    )

    vi.stubGlobal('fetch', fetchMock)
    const { getBookSuggestions } = await import('../services/booksApi.js')

    const suggestions = await getBookSuggestions('Harry')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestQuery(fetchMock.mock.calls[0])).toBe('Harry')
    expect(fetchMock.mock.calls[0][0]).toContain('maxResults=10')
    expect(fetchMock.mock.calls[0][0]).not.toContain('langRestrict')
    expect(suggestions).toHaveLength(5)
  })

  it('does not filter explicit categories from ordinary user search', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('explicit-1', 'Explicit User Search Result', [
            'Author',
          ], ['Erotica']),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Explicit User Search Result')

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('explicit-1')
    expect(results[0].categories).toEqual(['Erotica'])
  })

  it('retries once when the first request returns 503 and the retry succeeds', async () => {
    vi.useFakeTimers()

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('retry-success', 'Retry Success', ['Author']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('retry-title', 'Retry Success', ['Author']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('retry-title-retry', 'Retry Success', ['Author']),
        ])
      )

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const promise = searchBooks('Retry Success')
    await vi.advanceTimersByTimeAsync(250)
    const results = await promise

    expect(results).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(getRequestQuery(fetchMock.mock.calls[0])).toBe(
      'intitle:"Retry Success"'
    )
    expect(getRequestQuery(fetchMock.mock.calls[1])).toBe('Retry Success')
    expect(getRequestParam(fetchMock.mock.calls[2], 'title')).toBe(
      'Retry Success'
    )
    expect(getRequestQuery(fetchMock.mock.calls[3])).toBe(
      'retry success inauthor:success'
    )
    expect(getRequestQuery(fetchMock.mock.calls[5])).toBe(
      'intitle:"Retry Success"'
    )
  })

  it('surfaces the existing error when a 503 retry also fails', async () => {
    vi.useFakeTimers()

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))
      .mockImplementationOnce(() => failedResponse(503))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const promise = expect(searchBooks('Retry Failure')).rejects.toMatchObject({
      message: 'Impossible de récupérer les livres.',
      status: 503,
      apiError: {
        message: 'Service temporarily unavailable.',
        errors: [{ reason: 'backendFailed' }],
      },
    })
    await vi.advanceTimersByTimeAsync(250)
    await promise
    expect(fetchMock).toHaveBeenCalledTimes(8)
  })

  it.each([400, 403])(
    'does not retry permanent Google Books %s errors',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(() => failedResponse(status, 'badRequest'))
        .mockImplementationOnce(() => failedResponse(status, 'badRequest'))
        .mockImplementationOnce(() => failedResponse(status, 'badRequest'))
        .mockImplementationOnce(() => failedResponse(status, 'badRequest'))
        .mockImplementationOnce(() => failedResponse(status, 'badRequest'))

      vi.stubGlobal('fetch', fetchMock)
      const { searchBooks } = await import('../services/booksApi.js')

      await expect(searchBooks('Permanent Failure')).rejects.toMatchObject({
        message: 'Impossible de récupérer les livres.',
        status,
      })
      expect(fetchMock).toHaveBeenCalledTimes(5)
    }
  )

  it('does not retry normal successful requests', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('normal-broad', 'Normal Success', ['Author']),
        ])
      )
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('normal-title', 'Normal Success', ['Author']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Normal Success')

    expect(results).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('keeps distinct works that share The Housemaid title', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('freida-google', 'The Housemaid', [
            'Freida McFadden',
          ]),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() =>
        successfulOpenLibraryResponse([
          openLibraryDoc('OLAMMAW', 'The Housemaid', ['Amma Darko']),
        ])
      )

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('The Housemaid')

    expect(results.map((result) => result.authors[0])).toEqual([
      'Freida McFadden',
      'Amma Darko',
    ])
    expect(results[1].googleBooksId).toBeUndefined()
    expect(results[1].openLibraryId).toBe('/works/OLAMMAW')
  })

  it('prioritizes Freida McFadden for The Housemaid Freida McFadden', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('amma-google', 'The Housemaid', ['Amma Darko']),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('freida-google', 'The Housemaid', [
            'Freida McFadden',
          ]),
        ])
      )
      .mockImplementationOnce(() =>
        successfulOpenLibraryResponse([
          openLibraryDoc('OLFREIDAW', 'The Housemaid', [
            'Freida McFadden',
          ]),
        ])
      )

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('The Housemaid Freida McFadden')

    expect(results[0].authors).toContain('Freida McFadden')
    expect(results[0].googleBooksId).toBe('freida-google')
    expect(results[0].openLibraryId).toBe('/works/OLFREIDAW')
    expect(
      results.some((result) => result.authors.includes('Amma Darko'))
    ).toBe(false)
  })

  it('excludes Harry Potter description-only matches', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('hp-1', 'Harry Potter and the Sorcerer’s Stone', [
            'J. K. Rowling',
          ]),
        ])
      )
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('description-only', 'A Wizarding Companion', [
            'Someone Else',
          ], [], {
            description: 'Mentions Harry Potter in passing.',
          }),
        ])
      )
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Harry Potter')

    expect(results.map((result) => result.id)).toEqual(['hp-1'])
  })

  it('keeps Victor Hugo author searches working', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('les-miserables', 'Les Misérables', ['Victor Hugo']),
        ])
      )
      .mockImplementationOnce(() =>
        successfulOpenLibraryResponse([
          openLibraryDoc('OLVHUGOW', 'Notre-Dame de Paris', [
            'Victor Hugo',
          ]),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Victor Hugo')

    expect(results.map((result) => result.authors[0])).toEqual([
      'Victor Hugo',
      'Victor Hugo',
    ])
    expect(results.map((result) => result.title)).toContain('Les Misérables')
  })

  it('finds relevant French La Femme de ménage titles', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem('femme-google', 'La Femme de ménage', [
            'Freida McFadden',
          ], [], {
            language: 'fr',
          }),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() =>
        successfulOpenLibraryResponse([
          openLibraryDoc('OLFEMMEW', 'La Femme de ménage', [
            'Freida McFadden',
          ]),
        ])
      )

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('La Femme de ménage')

    expect(results[0].title).toBe('La Femme de ménage')
    expect(results[0].authors).toContain('Freida McFadden')
  })
})
