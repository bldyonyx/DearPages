import { describe, expect, it } from 'vitest'
import {
  getBestGoogleCover,
  getIndustryIdentifierIsbns,
  getOpenLibraryIsbnCoverUrl,
  getPreferredIsbn,
} from '../services/coverUtils'

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