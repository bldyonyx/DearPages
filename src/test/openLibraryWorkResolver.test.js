
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
import { resolveOpenLibraryWorkId } from '../services/books/openLibraryWorkResolver.js'

describe('resolveOpenLibraryWorkId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when the book has no ISBN', async () => {
    expect(
      await resolveOpenLibraryWorkId({
        title: 'The Hobbit',
        isbns: [],
      })
    ).toBeNull()

    expect(fetchJsonOnce).not.toHaveBeenCalled()
  })

  it('resolves a work ID from an ISBN', async () => {
    fetchJsonOnce.mockResolvedValue({
      key: '/books/OL123M',
      works: [{ key: '/works/OL456W' }],
    })

    const result = await resolveOpenLibraryWorkId({
      isbn: '9780000000001',
    })

    expect(result).toBe('OL456W')

    expect(fetchJsonOnce).toHaveBeenCalledWith(
      'https://openlibrary.org/isbn/9780000000001.json'
    )
  })

  it('normalizes ISBN separators', async () => {
    fetchJsonOnce.mockResolvedValue({
      works: [{ key: '/works/OL789W' }],
    })

    const result = await resolveOpenLibraryWorkId({
      isbn: '978-0-00-000000-1',
    })

    expect(result).toBe('OL789W')
  })

  it('tries another ISBN when the first is missing', async () => {
    fetchJsonOnce
      .mockRejectedValueOnce(
        Object.assign(new Error('Not found'), {
          status: 404,
        })
      )
      .mockResolvedValueOnce({
        works: [{ key: '/works/OL999W' }],
      })

    const result = await resolveOpenLibraryWorkId({
      isbns: [
        '9780000000001',
        '9780000000002',
      ],
    })

    expect(result).toBe('OL999W')
    expect(fetchJsonOnce).toHaveBeenCalledTimes(2)
  })

  it('ignores invalid ISBNs', async () => {
    const result = await resolveOpenLibraryWorkId({
      isbns: ['invalid', '123'],
    })

    expect(result).toBeNull()
    expect(fetchJsonOnce).not.toHaveBeenCalled()
  })

  it('does not accept edition IDs as work IDs', async () => {
    fetchJsonOnce.mockResolvedValue({
      works: [{ key: '/books/OL123M' }],
    })

    expect(
      await resolveOpenLibraryWorkId({
        isbn: '9780000000001',
      })
    ).toBeNull()
  })

  it('returns null when the edition has no linked work', async () => {
    fetchJsonOnce.mockResolvedValue({
      key: '/books/OL123M',
    })

    expect(
      await resolveOpenLibraryWorkId({
        isbn: '9780000000001',
      })
    ).toBeNull()
  })

  it('propagates unexpected API errors', async () => {
    fetchJsonOnce.mockRejectedValue(
      Object.assign(new Error('Server error'), {
        status: 503,
      })
    )

    await expect(
      resolveOpenLibraryWorkId({
        isbn: '9780000000001',
      })
    ).rejects.toThrow('Server error')
  })
})
