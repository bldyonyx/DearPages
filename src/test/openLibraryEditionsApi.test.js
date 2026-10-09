
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
import { getOpenLibraryWorkEditions } from '../services/books/openLibraryEditionsApi.js'

const WORK_ID = 'OL12345W'

function createEdition({
  id,
  title = 'The Hobbit',
  language = 'eng',
  isbn13 = [],
  isbn10 = [],
  covers = [],
} = {}) {
  return {
    key: `/books/${id}`,
    title,
    languages: language
      ? [{ key: `/languages/${language}` }]
      : [],
    isbn_13: isbn13,
    isbn_10: isbn10,
    covers,
    publish_date: '2020',
    publishers: ['Example Publisher'],
  }
}

describe('getOpenLibraryWorkEditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array for an invalid work ID', async () => {
    expect(await getOpenLibraryWorkEditions(null)).toEqual([])
    expect(await getOpenLibraryWorkEditions('invalid')).toEqual([])

    expect(fetchJsonOnce).not.toHaveBeenCalled()
  })

  it('accepts both Open Library work ID formats', async () => {
    fetchJsonOnce.mockResolvedValue({ entries: [] })

    await getOpenLibraryWorkEditions(WORK_ID)
    await getOpenLibraryWorkEditions(`/works/${WORK_ID}`)

    expect(fetchJsonOnce).toHaveBeenCalledTimes(2)

    expect(fetchJsonOnce).toHaveBeenCalledWith(
      `https://openlibrary.org/works/${WORK_ID}/editions.json?limit=100`
    )
  })

  it('keeps French and English editions only', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({
          id: 'OL1M',
          title: 'The Hobbit',
          language: 'eng',
        }),
        createEdition({
          id: 'OL2M',
          title: 'Bilbo le Hobbit',
          language: 'fre',
        }),
        createEdition({
          id: 'OL3M',
          language: 'spa',
        }),
        createEdition({
          id: 'OL4M',
          language: null,
        }),
      ],
    })

    const editions = await getOpenLibraryWorkEditions(WORK_ID)

    expect(editions.map((edition) => edition.id)).toEqual([
      'OL1M',
      'OL2M',
    ])

    expect(editions.map((edition) => edition.language)).toEqual([
      'en',
      'fr',
    ])
  })

  it('supports the alternative French language code', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({
          id: 'OL5M',
          language: 'fra',
        }),
      ],
    })

    const editions = await getOpenLibraryWorkEditions(WORK_ID)

    expect(editions).toHaveLength(1)
    expect(editions[0].language).toBe('fr')
  })

  it('preserves ISBNs, publication details and cover ID', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({
          id: 'OL6M',
          isbn13: ['9780000000001'],
          isbn10: ['0000000001'],
          covers: [123456],
        }),
      ],
    })

    const [edition] = await getOpenLibraryWorkEditions(WORK_ID)

    expect(edition).toMatchObject({
      id: 'OL6M',
      openLibraryEditionId: 'OL6M',
      isbn: '9780000000001',
      isbns: ['9780000000001', '0000000001'],
      publishedDate: '2020',
      publishers: ['Example Publisher'],
      coverId: 123456,
      source: 'open-library',
    })
  })

  it('keeps editions without ISBNs', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({
          id: 'OL7M',
        }),
      ],
    })

    const [edition] = await getOpenLibraryWorkEditions(WORK_ID)

    expect(edition.isbn).toBeNull()
    expect(edition.isbns).toEqual([])
  })

  it('removes duplicate edition IDs', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({ id: 'OL8M' }),
        createEdition({ id: 'OL8M' }),
        createEdition({ id: 'OL9M' }),
      ],
    })

    const editions = await getOpenLibraryWorkEditions(WORK_ID)

    expect(editions.map((edition) => edition.id)).toEqual([
      'OL8M',
      'OL9M',
    ])
  })

  it('ignores entries without a valid edition ID', async () => {
    fetchJsonOnce.mockResolvedValue({
      entries: [
        createEdition({ id: 'invalid' }),
        createEdition({ id: 'OL10M' }),
      ],
    })

    const editions = await getOpenLibraryWorkEditions(WORK_ID)

    expect(editions).toHaveLength(1)
    expect(editions[0].id).toBe('OL10M')
  })

  it('returns an empty array when there are no entries', async () => {
    fetchJsonOnce.mockResolvedValue({})

    expect(await getOpenLibraryWorkEditions(WORK_ID)).toEqual([])
  })

  it('propagates API errors', async () => {
    fetchJsonOnce.mockRejectedValue(
      new Error('Open Library unavailable')
    )

    await expect(
      getOpenLibraryWorkEditions(WORK_ID)
    ).rejects.toThrow('Open Library unavailable')
  })
})
