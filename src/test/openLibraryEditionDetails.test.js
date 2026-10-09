
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../utils/inFlightRequest.js', () => ({
  fetchJsonOnce: vi.fn(),
}))

import { fetchJsonOnce } from '../utils/inFlightRequest.js'
import { getOpenLibraryEditionById } from '../services/books/openLibraryEditionDetails.js'

describe('getOpenLibraryEditionById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for an invalid edition ID', async () => {
    expect(
      await getOpenLibraryEditionById('OL123W')
    ).toBeNull()

    expect(fetchJsonOnce).not.toHaveBeenCalled()
  })

  it('loads an edition and preserves its own ID', async () => {
    fetchJsonOnce.mockResolvedValueOnce({
      key: '/books/OL456M',
      title: 'Bilbo le Hobbit',
      isbn_13: ['9780000000001'],
      publish_date: '2020',
      publishers: ['Gallimard'],
      languages: [{ key: '/languages/fre' }],
      covers: [12345],
      works: [],
    })

    const result = await getOpenLibraryEditionById('OL456M')

    expect(result).toMatchObject({
      id: 'OL456M',
      openLibraryEditionId: 'OL456M',
      googleBooksId: null,
      title: 'Bilbo le Hobbit',
      language: 'fr',
      isbn: '9780000000001',
      publishedDate: '2020',
      publishers: ['Gallimard'],
      source: 'open-library',
    })

    expect(result.cover).toContain('/12345-L.jpg')

    expect(fetchJsonOnce).toHaveBeenCalledWith(
      'https://openlibrary.org/books/OL456M.json'
    )
  })

  it('uses work details when edition metadata is incomplete', async () => {
    fetchJsonOnce
      .mockResolvedValueOnce({
        key: '/books/OL456M',
        title: 'The Hobbit',
        works: [{ key: '/works/OL123W' }],
      })
      .mockResolvedValueOnce({
        title: 'The Hobbit',
        description: { value: 'A fantasy adventure.' },
        subjects: ['Fantasy'],
        covers: [789],
      })

    const result = await getOpenLibraryEditionById('OL456M')

    expect(result).toMatchObject({
      id: 'OL456M',
      openLibraryId: '/works/OL123W',
      description: 'A fantasy adventure.',
      categories: ['Fantasy'],
    })

    expect(result.cover).toContain('/789-L.jpg')
  })

  it('loads authors from edition references', async () => {
    fetchJsonOnce
      .mockResolvedValueOnce({
        title: 'The Hobbit',
        authors: [{ key: '/authors/OL123A' }],
      })
      .mockResolvedValueOnce({
        name: 'J. R. R. Tolkien',
      })

    const result = await getOpenLibraryEditionById('OL456M')

    expect(result.authors).toEqual(['J. R. R. Tolkien'])
  })

  it('falls back to work authors', async () => {
    fetchJsonOnce
      .mockResolvedValueOnce({
        title: 'The Hobbit',
        works: [{ key: '/works/OL123W' }],
      })
      .mockResolvedValueOnce({
        authors: [
          { author: { key: '/authors/OL123A' } },
        ],
      })
      .mockResolvedValueOnce({
        name: 'J. R. R. Tolkien',
      })

    const result = await getOpenLibraryEditionById('OL456M')

    expect(result.authors).toEqual(['J. R. R. Tolkien'])
  })

  it('keeps edition data when the work request fails', async () => {
    fetchJsonOnce
      .mockResolvedValueOnce({
        title: 'Bilbo le Hobbit',
        works: [{ key: '/works/OL123W' }],
      })
      .mockRejectedValueOnce(new Error('Work unavailable'))

    const result = await getOpenLibraryEditionById('OL456M')

    expect(result.id).toBe('OL456M')
    expect(result.title).toBe('Bilbo le Hobbit')
  })

  it('propagates an edition API failure', async () => {
    fetchJsonOnce.mockRejectedValueOnce(
      new Error('Edition unavailable')
    )

    await expect(
      getOpenLibraryEditionById('OL456M')
    ).rejects.toThrow('Edition unavailable')
  })
})
