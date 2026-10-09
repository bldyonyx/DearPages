import { afterEach, describe, expect, it, vi } from 'vitest'

function googleBook(overrides = {}) {
  return {
    id: 'volume-1',
    volumeInfo: {
      title: 'Test book',
      authors: ['Test author'],
      categories: ['Fantasy'],
      ...overrides,
    },
  }
}

function mockGoogleBooksResponse(data) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(data),
  })
}

async function importGoogleBooksApi(apiKey) {
  vi.resetModules()
  vi.stubEnv('VITE_GOOGLE_BOOKS_API_KEY', apiKey)

  return import('../services/books/googleBooksApi.js')
}

async function importBookSubjectService(apiKey) {
  vi.resetModules()
  vi.stubEnv('VITE_GOOGLE_BOOKS_API_KEY', apiKey)

  return import('../services/books/bookSubjectService.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Google Books API URL key handling', () => {
  it('keeps createVolumesSearchUrl key optional', async () => {
    const { createVolumesSearchUrl } =
      await importGoogleBooksApi('')
    const url = new URL(
      createVolumesSearchUrl('fantasy', {
        maxResults: 10,
        startIndex: 5,
        printType: 'books',
      })
    )

    expect(url.searchParams.get('q')).toBe('fantasy')
    expect(url.searchParams.get('maxResults')).toBe('10')
    expect(url.searchParams.get('startIndex')).toBe('5')
    expect(url.searchParams.get('printType')).toBe('books')
    expect(url.searchParams.has('key')).toBe(false)
  })

  it('adds key to createVolumesSearchUrl when configured', async () => {
    const { createVolumesSearchUrl } =
      await importGoogleBooksApi('test-key')
    const url = new URL(createVolumesSearchUrl('fantasy'))

    expect(url.searchParams.get('key')).toBe('test-key')
  })

  it('does not add key to getBookByIsbn without a configured key', async () => {
    const { getBookByIsbn } = await importGoogleBooksApi('')
    const fetchMock = mockGoogleBooksResponse({
      items: [googleBook()],
    })

    vi.stubGlobal('fetch', fetchMock)

    await getBookByIsbn('9780000000001')

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('q')).toBe('isbn:9780000000001')
    expect(url.searchParams.get('langRestrict')).toBe('fr')
    expect(url.searchParams.get('maxResults')).toBe('1')
    expect(url.searchParams.has('key')).toBe(false)
  })

  it('adds key to getBookByIsbn when configured', async () => {
    const { getBookByIsbn } =
      await importGoogleBooksApi('test-key')
    const fetchMock = mockGoogleBooksResponse({
      items: [googleBook()],
    })

    vi.stubGlobal('fetch', fetchMock)

    await getBookByIsbn('9780000000001')

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('key')).toBe('test-key')
  })

  it('does not add key to getBookById without a configured key', async () => {
    const { getBookById } = await importGoogleBooksApi('')
    const fetchMock = mockGoogleBooksResponse(googleBook())

    vi.stubGlobal('fetch', fetchMock)

    await getBookById('volume-1')

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.pathname).toBe('/books/v1/volumes/volume-1')
    expect(url.searchParams.has('key')).toBe(false)
  })

  it('adds key to getBookById when configured', async () => {
    const { getBookById } = await importGoogleBooksApi('test-key')
    const fetchMock = mockGoogleBooksResponse(googleBook())

    vi.stubGlobal('fetch', fetchMock)

    await getBookById('volume-1')

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('key')).toBe('test-key')
  })

  it('does not add key to subject windows without a configured key', async () => {
    const { getBooksBySubjectWindow } =
      await importBookSubjectService('')
    const fetchMock = mockGoogleBooksResponse({
      items: [googleBook()],
    })

    vi.stubGlobal('fetch', fetchMock)

    await getBooksBySubjectWindow('fantasy', 8, 16)

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('q')).toBe('subject:fantasy')
    expect(url.searchParams.get('langRestrict')).toBe('fr')
    expect(url.searchParams.get('maxResults')).toBe('8')
    expect(url.searchParams.get('startIndex')).toBe('16')
    expect(url.searchParams.has('key')).toBe(false)
  })

  it('adds key to subject windows when configured', async () => {
    const { getBooksBySubjectWindow } =
      await importBookSubjectService('test-key')
    const fetchMock = mockGoogleBooksResponse({
      items: [googleBook()],
    })

    vi.stubGlobal('fetch', fetchMock)

    await getBooksBySubjectWindow('fantasy', 8, 16)

    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('key')).toBe('test-key')
  })
})
