import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorSearchQuery,
  buildTitleSearchQueries,
  buildTitleSearchQuery,
  getTitleAuthorSplitCandidates,
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

function getGoogleBooksCalls(fetchMock) {
  return fetchMock.mock.calls.filter(
    (call) => new URL(call[0]).hostname === 'www.googleapis.com'
  )
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
    expect(
      buildTitleSearchQueries("Le Crime de l'Orient-Express")
    ).toEqual([
      'intitle:"Le Crime de l\'Orient-Express"',
      'intitle:"le crime de l orient express"',
    ])
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

  it('matches initialized author queries to full author names', () => {
    const result = book({
      id: 'lmm',
      title: 'Anne of Green Gables',
      authors: ['Lucy Maud Montgomery'],
    })

    expect(
      scoreAuthorRelevance(result, 'L. M. Montgomery')
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

  it('builds progressive title and author split candidates', () => {
    expect(
      getTitleAuthorSplitCandidates(
        'Les Quatre Filles du docteur March Louisa May Alcott'
      )
    ).toEqual([
      {
        title: 'les quatre filles du docteur march louisa',
        author: 'may alcott',
      },
      {
        title: 'les quatre filles du docteur march',
        author: 'louisa may alcott',
      },
      {
        title: 'les quatre filles du docteur',
        author: 'march louisa may alcott',
      },
    ])
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

  it('prioritizes exact title matches over another book by the same author', () => {
    const candidates = [
      book({
        id: 'castle-air',
        title: 'Castle in the Air',
        authors: ['Diana Wynne Jones'],
      }),
      book({
        id: 'howl',
        title: "Howl's Moving Castle",
        authors: ['Diana Wynne Jones'],
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      "Howl's Moving Castle",
      20
    )

    expect(result.map((item) => item.id)).toEqual(['howl'])
  })

  it('prioritizes exact title matches inside title and author searches', () => {
    const candidates = [
      book({
        id: 'castle-air',
        title: 'Castle in the Air',
        authors: ['Diana Wynne Jones'],
      }),
      book({
        id: 'howl',
        title: "Howl's Moving Castle",
        authors: ['Diana Wynne Jones'],
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      "Howl's Moving Castle Diana Wynne Jones",
      20,
      {
        combined: {
          title: "howl s moving castle",
          author: 'diana wynne jones',
        },
      }
    )

    expect(result.map((item) => item.id)).toEqual(['howl'])
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

  it('keeps known-author exact title matches above unknown-author records', () => {
    const candidates = [
      book({
        id: 'unknown-cover-rich',
        title: "Le Crime de l'Orient-Express",
        authors: ['Auteur inconnu'],
        language: 'fr',
        cover: 'https://example.com/cover.jpg',
        description: 'Useful search metadata.',
      }),
      book({
        id: 'agatha-sparse',
        title: "Le Crime de l'Orient-Express",
        authors: ['Agatha Christie'],
        language: 'fr',
        cover: null,
        description: 'Useful search metadata.',
      }),
    ]

    const result = mergeAndRankSearchBooks(
      [candidates],
      "Le Crime de l'Orient-Express",
      20
    )

    expect(result.map((item) => item.id)).toEqual([
      'agatha-sparse',
      'unknown-cover-rich',
    ])
    expect(result[1].authors).toEqual(['Auteur inconnu'])
  })
})

describe('booksApi search request behavior', () => {
  it('keeps exact title results with normalized punctuation variants', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem(
            'orient-express',
            "Le Crime de l'Orient-Express",
            ['Agatha Christie'],
            [],
            { language: 'fr' }
          ),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks("Le Crime de l'Orient-Express")

    expect(results[0].id).toBe('orient-express')
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(getRequestQuery(fetchMock.mock.calls[0])).toBe(
      'intitle:"Le Crime de l\'Orient-Express"'
    )
    expect(getRequestQuery(fetchMock.mock.calls[1])).toBe(
      'intitle:"le crime de l orient express"'
    )
  })

  it('keeps punctuation-normalized title results', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        successfulResponse([
          googleItem(
            'orient-express',
            "Le Crime de l'Orient-Express",
            ['Agatha Christie'],
            [],
            { language: 'fr' }
          ),
        ])
      )
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))
      .mockImplementationOnce(() => successfulResponse([]))
      .mockImplementationOnce(() => successfulOpenLibraryResponse([]))

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Le Crime de l Orient Express')

    expect(results[0].id).toBe('orient-express')
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(getRequestQuery(fetchMock.mock.calls[0])).toBe(
      'intitle:"Le Crime de l Orient Express"'
    )
  })

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

  it('falls back to longer title and author splits when the author has three words', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname === 'openlibrary.org') {
        return successfulOpenLibraryResponse([])
      }

      const requestQuery = parsedUrl.searchParams.get('q')

      if (
        requestQuery ===
        'intitle:"les quatre filles du docteur march" inauthor:alcott'
      ) {
        return successfulResponse([
          googleItem(
            'little-women-fr',
            'Les Quatre Filles du docteur March',
            ['Louisa May Alcott'],
            [],
            { language: 'fr' }
          ),
        ])
      }

      return successfulResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Les Quatre Filles du docteur March Louisa May Alcott'
    )

    expect(results[0].id).toBe('little-women-fr')
    expect(results[0].authors).toContain('Louisa May Alcott')
  })

  it('matches initialized authors in title and author searches', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname === 'openlibrary.org') {
        return successfulOpenLibraryResponse([])
      }

      const requestQuery = parsedUrl.searchParams.get('q')

      if (
        requestQuery ===
        'intitle:"anne de la maison aux pignons verts" inauthor:montgomery'
      ) {
        return successfulResponse([
          googleItem(
            'anne-fr',
            'Anne de la maison aux pignons verts',
            ['Lucy Maud Montgomery'],
            [],
            { language: 'fr' }
          ),
        ])
      }

      return successfulResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Anne de la maison aux pignons verts L. M. Montgomery'
    )

    expect(results[0].id).toBe('anne-fr')
    expect(results[0].authors).toContain('Lucy Maud Montgomery')
  })

  it('uses normalized Open Library keyword fallback for alternate title results', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      const requestQuery = parsedUrl.searchParams.get('q')

      if (
        requestQuery ===
        'le chateau de hurle diana wynne jones'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc('OLHOWLW', "Howl's Moving Castle", [
            'Diana Wynne Jones',
          ]),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Le Château de Hurle Diana Wynne Jones'
    )

    expect(results[0].id).toBe('OLHOWLW')
    expect(results[0].title).toBe("Howl's Moving Castle")
  })

  it('keeps exact title-only Open Library results without cover metadata when the author is known', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      if (
        parsedUrl.searchParams.get('title') ===
        'Les Quatre Filles du docteur March'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc(
            'OLLITTLEWOMENFR',
            'Les quatre filles du docteur March',
            ['Louisa May Alcott'],
            { cover_i: null, first_sentence: [] }
          ),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Les Quatre Filles du docteur March'
    )

    expect(results[0].id).toBe('OLLITTLEWOMENFR')
    expect(results[0].authors).toContain('Louisa May Alcott')
  })

  it('enriches sparse title-only results with limited Open Library keyword results', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      if (
        parsedUrl.searchParams.get('title') ===
        'Les Quatre Filles du docteur March'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc(
            'OLLITTLEWOMENFRSPARSE',
            'Les quatre filles du docteur March',
            ['Louisa May Alcott'],
            { cover_i: null, first_sentence: [] }
          ),
        ])
      }

      if (
        parsedUrl.searchParams.get('q') ===
        'Les Quatre Filles du docteur March'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc('OLLITTLEWOMEN', 'Little Women', [
            'Louisa May Alcott',
          ]),
          openLibraryDoc(
            'OLLITTLEWOMENADAPTATION',
            'Little Women [adaptation]',
            ['Lucia Monfried']
          ),
          openLibraryDoc(
            'OLLITTLEWOMENCOLLECTION',
            'Little Women / Heidi / Anne of Green Gables',
            ['Louisa May Alcott']
          ),
          openLibraryDoc(
            'OLLITTLEWOMENFRCOVER',
            'Les quatre filles du docteur March',
            ['Louisa May Alcott'],
            { cover_i: 12345 }
          ),
          openLibraryDoc(
            'OLTUNNEL',
            'Une lumière au bout du tunnel',
            ['Xavier T.']
          ),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Les Quatre Filles du docteur March'
    )

    const titles = results.map((book) => book.title)

    expect(titles).toContain('Les quatre filles du docteur March')
    expect(titles).toContain('Little Women')
    expect(titles).toContain('Little Women [adaptation]')
    expect(titles).toContain(
      'Little Women / Heidi / Anne of Green Gables'
    )
    expect(titles).not.toContain('Une lumière au bout du tunnel')
    expect(results[0].title).toBe('Les quatre filles du docteur March')
    expect(results[0].cover).toContain('/12345-L.jpg')
    expect(titles.indexOf('Little Women')).toBeLessThan(
      titles.indexOf('Little Women / Heidi / Anne of Green Gables')
    )
    expect(
      fetchMock.mock.calls.filter(
        (call) =>
          new URL(call[0]).hostname === 'openlibrary.org' &&
          new URL(call[0]).searchParams.has('q')
      )
    ).toHaveLength(1)
  })

  it('finds French Anne title-only results from Open Library title search', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      if (
        parsedUrl.searchParams.get('title') ===
        'Anne de la maison aux pignons verts'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc(
            'OLANNEFR',
            'Anne de la Maison Aux Pignons Verts',
            ['Lucy Maud Montgomery'],
            { cover_i: null, first_sentence: [] }
          ),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      'Anne de la maison aux pignons verts'
    )

    expect(results[0].id).toBe('OLANNEFR')
    expect(results[0].authors).toContain('Lucy Maud Montgomery')
  })

  it('uses Open Library keyword ranking for translated title-only alternate titles', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      const requestQuery = parsedUrl.searchParams.get('q')

      if (requestQuery === 'le chateau de hurle') {
        return successfulOpenLibraryResponse([
          openLibraryDoc('OLHOWLW', "Howl's Moving Castle", [
            'Diana Wynne Jones',
          ]),
          openLibraryDoc('OLCASTLEAIRW', 'Castle in the Air', [
            'Diana Wynne Jones',
          ]),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Le Château de Hurle')

    expect(results[0].id).toBe('OLHOWLW')
    expect(results[0].title).toBe("Howl's Moving Castle")
  })

  it('keeps available French Narnia title-only editions', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      if (
        parsedUrl.searchParams.get('title') ===
        "Le Lion, la Sorcière blanche et l'Armoire magique"
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc(
            'OLNARNIAFR',
            "Le lion, la sorcière blanche et l'armoire magique",
            ['Jasmine Jones', 'Andrew Adamson'],
            { cover_i: 15166738 }
          ),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks(
      "Le Lion, la Sorcière blanche et l'Armoire magique"
    )

    expect(results[0].id).toBe('OLNARNIAFR')
    expect(results[0].title).toContain('sorcière blanche')
  })

  it('keeps original title searches working', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return successfulResponse([])
      }

      if (parsedUrl.searchParams.get('title') === 'Little Women') {
        return successfulOpenLibraryResponse([
          openLibraryDoc('OLLITTLEWOMEN', 'Little Women', [
            'Louisa May Alcott',
          ]),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Little Women')

    expect(results[0].id).toBe('OLLITTLEWOMEN')
    expect(results[0].title).toBe('Little Women')
  })

  it('preserves title-only Open Library results when Google Books returns 503', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return failedResponse(503)
      }

      if (
        parsedUrl.searchParams.get('title') ===
        'Les Quatre Filles du docteur March'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc(
            'OLLITTLEWOMENFR',
            'Les quatre filles du docteur March',
            ['Louisa May Alcott'],
            { cover_i: null, first_sentence: [] }
          ),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const promise = searchBooks(
      'Les Quatre Filles du docteur March'
    )
    await vi.advanceTimersByTimeAsync(250)
    const results = await promise

    expect(results[0].id).toBe('OLLITTLEWOMENFR')
    expect(getGoogleBooksCalls(fetchMock)).toHaveLength(6)
  })

  it('does not run fallback Google requests when initial results are already relevant', async () => {
    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname === 'openlibrary.org') {
        const title = parsedUrl.searchParams.get('title')

        if (title === 'Known Long Query Author Name') {
          return successfulOpenLibraryResponse([
            openLibraryDoc('OLKNOWNW', 'Known Long Query', [
              'Author Name',
            ]),
          ])
        }

        return successfulOpenLibraryResponse([])
      }

      return successfulResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const results = await searchBooks('Known Long Query Author Name')

    expect(results[0].id).toBe('OLKNOWNW')
    expect(getGoogleBooksCalls(fetchMock)).toHaveLength(3)
  })

  it('preserves Open Library fallback results and avoids extra Google fallback calls after Google 503s', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn((url) => {
      const parsedUrl = new URL(url)

      if (parsedUrl.hostname !== 'openlibrary.org') {
        return failedResponse(503)
      }

      const requestQuery = parsedUrl.searchParams.get('q')

      if (
        requestQuery ===
        'le chateau de hurle diana wynne jones'
      ) {
        return successfulOpenLibraryResponse([
          openLibraryDoc('OLHOWLW', "Howl's Moving Castle", [
            'Diana Wynne Jones',
          ]),
        ])
      }

      return successfulOpenLibraryResponse([])
    })

    vi.stubGlobal('fetch', fetchMock)
    const { searchBooks } = await import('../services/booksApi.js')

    const promise = searchBooks(
      'Le Château de Hurle Diana Wynne Jones'
    )
    await vi.advanceTimersByTimeAsync(250)
    const results = await promise

    expect(results[0].id).toBe('OLHOWLW')
    expect(getGoogleBooksCalls(fetchMock)).toHaveLength(8)
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
