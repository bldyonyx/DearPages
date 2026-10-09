
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../services/books/bookEditionsService.js', () => ({
  getBookEditions: vi.fn(),
}))

vi.mock('../services/books/openLibraryEditionsApi.js', () => ({
  getOpenLibraryWorkEditions: vi.fn(),
}))

vi.mock('../services/books/openLibraryWorkResolver.js', () => ({
  resolveOpenLibraryWorkId: vi.fn(),
}))

import { getBookEditions } from '../services/books/bookEditionsService.js'
import { getOpenLibraryWorkEditions } from '../services/books/openLibraryEditionsApi.js'
import { resolveOpenLibraryWorkId } from '../services/books/openLibraryWorkResolver.js'
import { discoverBookEditions } from '../services/books/bookEditionsDiscovery.js'

const googleBook = {
  id: 'google-123',
  googleBooksId: 'google-123',
  title: 'The Hobbit',
  authors: ['J. R. R. Tolkien'],
  isbn: '9780000000001',
  source: 'google-books',
}

const openLibraryEdition = {
  id: 'OL456M',
  openLibraryEditionId: 'OL456M',
  title: 'Bilbo le Hobbit',
  language: 'fr',
  isbn: '9780000000002',
  isbns: ['9780000000002'],
  coverId: 123,
  source: 'open-library',
}

const googleEdition = {
  id: 'google-456',
  googleBooksId: 'google-456',
  title: 'The Hobbit',
  language: 'en',
  isbn: '9780000000003',
  source: 'google-books',
}

describe('discoverBookEditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    resolveOpenLibraryWorkId.mockResolvedValue(null)
    getOpenLibraryWorkEditions.mockResolvedValue([])
    getBookEditions.mockResolvedValue([])
  })

  it('returns empty results without a book', async () => {
    expect(await discoverBookEditions(null)).toEqual({
      workId: null,
      source: null,
      editions: [],
    })
  })

  it('uses the existing Open Library work ID', async () => {
    getOpenLibraryWorkEditions.mockResolvedValue([
      openLibraryEdition,
    ])

    const result = await discoverBookEditions({
      id: 'OL123W',
      source: 'open-library',
    })

    expect(result.workId).toBe('OL123W')
    expect(result.source).toBe('open-library')

    expect(resolveOpenLibraryWorkId).not.toHaveBeenCalled()
    expect(getBookEditions).toHaveBeenCalledWith({
        id: 'OL123W',
        source: 'open-library',
    })
  })

  it('resolves Google Books ISBNs to an Open Library work', async () => {
    resolveOpenLibraryWorkId.mockResolvedValue('OL123W')
    getOpenLibraryWorkEditions.mockResolvedValue([
      openLibraryEdition,
    ])

    const result = await discoverBookEditions(googleBook)

    expect(resolveOpenLibraryWorkId).toHaveBeenCalledWith(
      googleBook
    )

    expect(getOpenLibraryWorkEditions).toHaveBeenCalledWith(
      'OL123W'
    )

    expect(result.editions[0]).toMatchObject({
      id: 'OL456M',
      title: 'Bilbo le Hobbit',
      language: 'fr',
      openLibraryEditionId: 'OL456M',
      googleBooksId: null,
      coverId: 123,
    })
  })

  it('falls back to Google Books when no work is found', async () => {
    getBookEditions.mockResolvedValue([googleEdition])

    const result = await discoverBookEditions(googleBook)

    expect(result.source).toBe('google-books')
    expect(result.editions[0]).toMatchObject({
      googleBooksId: 'google-456',
      openLibraryEditionId: null,
    })
  })

  it('falls back when Open Library has no editions', async () => {
    resolveOpenLibraryWorkId.mockResolvedValue('OL123W')
    getBookEditions.mockResolvedValue([googleEdition])

    const result = await discoverBookEditions(googleBook)

    expect(result.workId).toBe('OL123W')
    expect(result.source).toBe('google-books')
    expect(result.editions).toHaveLength(1)
  })

  it('falls back when Open Library fails', async () => {
    resolveOpenLibraryWorkId.mockRejectedValue(
      new Error('Open Library unavailable')
    )
    getBookEditions.mockResolvedValue([googleEdition])

    const result = await discoverBookEditions(googleBook)

    expect(result.source).toBe('google-books')
    expect(result.editions).toHaveLength(1)
  })

  it('returns empty results if both providers fail', async () => {
    resolveOpenLibraryWorkId.mockRejectedValue(
      new Error('Open Library unavailable')
    )
    getBookEditions.mockRejectedValue(
      new Error('Google Books unavailable')
    )

    expect(await discoverBookEditions(googleBook)).toEqual({
      workId: null,
      source: null,
      editions: [],
    })
  })
})
