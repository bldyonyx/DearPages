import { describe, expect, it } from 'vitest'
import {
  addBooksToIdentitySet,
  getBookIdentityKeys,
  selectRecommendationBooks,
} from '../utils/recommendationSelection'

describe('getBookIdentityKeys', () => {
  it('creates normalized identity keys from book metadata', () => {
    const book = {
      id: 'book-1',
      googleBooksId: 'google-1',
      openLibraryId: 'OL1W',
      title: 'L’Étranger',
      authors: ['Albert Camus'],
      isbn: '978-2-07-036002-4',
    }

    expect(getBookIdentityKeys(book)).toEqual([
      'isbn:9782070360024',
      'title-author:l etranger:albert camus',
      'google:google-1',
      'openlibrary:OL1W',
      'id:book-1',
    ])
  })

  it('can identify a book using sparse metadata', () => {
    const book = {
      id: 'book-1',
      title: 'Unknown Book',
    }

    expect(getBookIdentityKeys(book)).toEqual([
      'id:book-1',
    ])
  })
})

describe('addBooksToIdentitySet', () => {
  it('adds the identity keys of several books to a set', () => {
    const identitySet = new Set()

    addBooksToIdentitySet(identitySet, [
      {
        id: 'book-1',
        title: 'Book One',
        authors: ['Author One'],
      },
      {
        id: 'book-2',
        title: 'Book Two',
        authors: ['Author Two'],
      },
    ])

    expect(identitySet.has('id:book-1')).toBe(true)
    expect(identitySet.has('id:book-2')).toBe(true)
  })
})

describe('selectRecommendationBooks', () => {
  it('removes duplicate editions before selecting recommendations', () => {
    const candidates = [
      {
        id: 'edition-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        isbn: '9780441172719',
      },
      {
        id: 'edition-2',
        title: 'Dune',
        authors: ['Frank Herbert'],
        isbn: '9780441172719',
      },
      {
        id: 'book-3',
        title: 'Foundation',
        authors: ['Isaac Asimov'],
        isbn: '9780553293357',
      },
    ]

    const result = selectRecommendationBooks(candidates, {
      limit: 3,
    })

    expect(result).toHaveLength(2)

    const titles = result.map((book) => book.title)

    expect(titles).toContain('Dune')
    expect(titles).toContain('Foundation')
  })

  it('does not recommend books that were already shown', () => {
    const candidates = [
      {
        id: 'book-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      },
      {
        id: 'book-2',
        title: 'Foundation',
        authors: ['Isaac Asimov'],
      },
    ]

    const alreadyShownIdentityKeys = new Set([
      'id:book-1',
    ])

    const result = selectRecommendationBooks(candidates, {
      limit: 2,
      alreadyShownIdentityKeys,
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('book-2')
  })

  it('removes explicitly excluded books', () => {
    const candidates = [
      {
        id: 'book-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      },
      {
        id: 'book-2',
        title: 'Foundation',
        authors: ['Isaac Asimov'],
      },
    ]

    const result = selectRecommendationBooks(candidates, {
      limit: 2,
      excludedBookIds: ['book-1'],
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('book-2')
  })

  it('prefers books with covers when requested', () => {
    const candidates = [
      {
        id: 'book-1',
        title: 'Book Without Cover',
        authors: ['Author One'],
        cover: null,
      },
      {
        id: 'book-2',
        title: 'Book With Cover',
        authors: ['Author Two'],
        cover: 'cover.jpg',
      },
    ]

    const result = selectRecommendationBooks(candidates, {
      limit: 1,
      preferBooksWithCovers: true,
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('book-2')
  })

  it('returns no books when every eligible recommendation was already shown', () => {
    const candidates = [
      {
        id: 'book-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      },
    ]

    const result = selectRecommendationBooks(candidates, {
      limit: 1,
      alreadyShownIdentityKeys: new Set(['id:book-1']),
    })

    expect(result).toEqual([])
  })

  it('can recycle already shown books when explicitly allowed', () => {
    const candidates = [
      {
        id: 'book-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
      },
    ]

    const result = selectRecommendationBooks(candidates, {
      limit: 1,
      alreadyShownIdentityKeys: new Set(['id:book-1']),
      recycleSeenWhenExhausted: true,
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('book-1')
  })
})