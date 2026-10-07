import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  clearOpenLibraryCoverCache,
  getBestGoogleCover,
  getIndustryIdentifierIsbns,
  getOpenLibraryIsbnCoverUrl,
  getPreferredIsbn,
  getSizedGoogleBooksCoverUrl,
  resolveOpenLibraryCoverByIsbn,
} from '../services/coverUtils'

function mockOpenLibraryBooksResponse(metadata) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(metadata),
  })
}

beforeEach(() => {
  clearOpenLibraryCoverCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getPreferredIsbn', () => {
  it('prefers an ISBN-13 when one is available', () => {
    const result = getPreferredIsbn([
      '0-306-40615-2',
      '978-0-306-40615-7',
    ])

    expect(result).toBe('9780306406157')
  })

  it('uses an ISBN-10 when no ISBN-13 is available', () => {
    const result = getPreferredIsbn([
      '0-306-40615-2',
    ])

    expect(result).toBe('0306406152')
  })

  it('returns null when no ISBN is available', () => {
    expect(getPreferredIsbn([])).toBeNull()
  })
})

describe('getIndustryIdentifierIsbns', () => {
  it('normalizes identifiers and prioritizes ISBN-13 before ISBN-10', () => {
    const result = getIndustryIdentifierIsbns([
      {
        type: 'ISBN_10',
        identifier: '0-306-40615-2',
      },
      {
        type: 'ISBN_13',
        identifier: '978-0-306-40615-7',
      },
    ])

    expect(result).toEqual([
      '9780306406157',
      '0306406152',
    ])
  })
})

describe('getBestGoogleCover', () => {
  it('returns the highest-priority available Google Books cover', () => {
    const result = getBestGoogleCover({
      thumbnail: 'thumbnail.jpg',
      medium: 'medium.jpg',
      large: 'large.jpg',
    })

    expect(result).toBe('large.jpg')
  })

  it('falls back to a lower-priority cover when needed', () => {
    const result = getBestGoogleCover({
      smallThumbnail: 'small-thumbnail.jpg',
      thumbnail: 'thumbnail.jpg',
    })

    expect(result).toBe('thumbnail.jpg')
  })

  it('returns null when Google Books has no cover', () => {
    expect(getBestGoogleCover({})).toBeNull()
  })
})

describe('getSizedGoogleBooksCoverUrl', () => {
  it('converts a recognized Google Books cover URL to a card-sized source', () => {
    expect(
      getSizedGoogleBooksCoverUrl(
        'http://books.google.com/books/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api',
        400
      )
    ).toBe(
      'https://books.google.com/books/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api&w=400'
    )
  })

  it('converts a recognized Google Books cover URL to a BookPage-sized source', () => {
    expect(
      getSizedGoogleBooksCoverUrl(
        'https://books.google.com/books/publisher/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api',
        800
      )
    ).toBe(
      'https://books.google.com/books/publisher/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api&w=800'
    )
  })

  it('preserves Google Books volume identity and unrelated query parameters', () => {
    const sizedUrl = getSizedGoogleBooksCoverUrl(
      'https://books.google.com/books/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api&imgtk=token',
      400
    )
    const url = new URL(sizedUrl)

    expect(url.searchParams.get('id')).toBe('mzKCDwAAQBAJ')
    expect(url.searchParams.get('img')).toBe('1')
    expect(url.searchParams.get('printsec')).toBe('frontcover')
    expect(url.searchParams.get('edge')).toBe('curl')
    expect(url.searchParams.get('source')).toBe('gbs_api')
    expect(url.searchParams.get('imgtk')).toBe('token')
    expect(url.searchParams.get('w')).toBe('400')
  })

  it('does not request full-resolution Google covers', () => {
    const sizedUrl = getSizedGoogleBooksCoverUrl(
      'https://books.google.com/books/content?id=mzKCDwAAQBAJ&printsec=frontcover&img=1&zoom=0&source=gbs_api',
      800
    )
    const url = new URL(sizedUrl)

    expect(url.searchParams.get('zoom')).toBe('1')
    expect(url.searchParams.get('w')).toBe('800')
  })

  it('leaves non-Google cover URLs unchanged', () => {
    expect(
      getSizedGoogleBooksCoverUrl(
        'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false',
        400
      )
    ).toBe(
      'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false'
    )
  })
})

describe('getOpenLibraryIsbnCoverUrl', () => {
  it('builds an Open Library cover URL from a normalized ISBN', () => {
    expect(
      getOpenLibraryIsbnCoverUrl('978-0-306-40615-7')
    ).toBe(
      'https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false'
    )
  })

  it('returns null when no ISBN is provided', () => {
    expect(getOpenLibraryIsbnCoverUrl()).toBeNull()
  })
})

describe('resolveOpenLibraryCoverByIsbn', () => {
  it('returns and caches cover.large from Open Library metadata', async () => {
    const fetchMock = mockOpenLibraryBooksResponse({
      'ISBN:9780306406157': {
        cover: {
          large:
            'https://covers.openlibrary.org/b/id/12345-L.jpg',
        },
      },
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveOpenLibraryCoverByIsbn('978-0-306-40615-7')
    ).resolves.toBe(
      'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://openlibrary.org/api/books?'
    )
    expect(fetchMock.mock.calls[0][0]).toContain(
      'bibkeys=ISBN%3A9780306406157'
    )
  })

  it('returns null when metadata has no cover', async () => {
    const fetchMock = mockOpenLibraryBooksResponse({
      'ISBN:9780306406158': {},
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveOpenLibraryCoverByIsbn('9780306406158')
    ).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null when metadata has no ISBN entry', async () => {
    const fetchMock = mockOpenLibraryBooksResponse({})

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveOpenLibraryCoverByIsbn('9780306406159')
    ).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a RESOLVED cache entry', async () => {
    const fetchMock = mockOpenLibraryBooksResponse({
      'ISBN:9780306406160': {
        cover: {
          large:
            'https://covers.openlibrary.org/b/id/12346-L.jpg',
        },
      },
    })

    vi.stubGlobal('fetch', fetchMock)

    await resolveOpenLibraryCoverByIsbn('9780306406160')

    await expect(
      resolveOpenLibraryCoverByIsbn('978-0-306-40616-0')
    ).resolves.toBe(
      'https://covers.openlibrary.org/b/id/12346-L.jpg?default=false'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a MISSING cache entry without another request', async () => {
    const fetchMock = mockOpenLibraryBooksResponse({
      'ISBN:9780306406161': {},
    })

    vi.stubGlobal('fetch', fetchMock)

    await resolveOpenLibraryCoverByIsbn('9780306406161')

    await expect(
      resolveOpenLibraryCoverByIsbn('9780306406161')
    ).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a PENDING request for concurrent calls', async () => {
    let resolveMetadata
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveMetadata = resolve
          })
      ),
    })

    vi.stubGlobal('fetch', fetchMock)

    const firstRequest =
      resolveOpenLibraryCoverByIsbn('9780306406162')
    const secondRequest =
      resolveOpenLibraryCoverByIsbn('9780306406162')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await Promise.resolve()

    resolveMetadata({
      'ISBN:9780306406162': {
        cover: {
          large:
            'https://covers.openlibrary.org/b/id/12347-L.jpg',
        },
      },
    })

    await expect(
      Promise.all([firstRequest, secondRequest])
    ).resolves.toEqual([
      'https://covers.openlibrary.org/b/id/12347-L.jpg?default=false',
      'https://covers.openlibrary.org/b/id/12347-L.jpg?default=false',
    ])
  })

  it('returns null for invalid or missing ISBN without requesting metadata', async () => {
    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveOpenLibraryCoverByIsbn()
    ).resolves.toBeNull()
    await expect(
      resolveOpenLibraryCoverByIsbn('')
    ).resolves.toBeNull()
    await expect(
      resolveOpenLibraryCoverByIsbn('---')
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
