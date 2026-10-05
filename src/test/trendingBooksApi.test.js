import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getOpenLibraryBooksBySubject,
  getTrendingBooksDetails,
  isEligibleTrendingBook,
} from '../services/trendingBooksApi.js'

function trendingDoc(id, subject = [], overrides = {}) {
  return {
    key: `/works/${id}`,
    title: `Book ${id}`,
    author_name: [`Author ${id}`],
    isbn: [`978000000${id}`],
    cover_i: Number(id.replace(/\D/g, '')) || 1,
    subject,
    edition_count: 5,
    ratings_count: 2,
    want_to_read_count: 80,
    currently_reading_count: 10,
    already_read_count: 10,
    ...overrides,
  }
}

function mainstreamBook(overrides = {}) {
  return {
    edition_count: 5,
    ratings_count: 2,
    want_to_read_count: 80,
    currently_reading_count: 10,
    already_read_count: 10,
    ...overrides,
  }
}

function mockTrendingResponse(docs) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ docs }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isEligibleTrendingBook', () => {
  it('excludes content warning cover subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['content_warning:cover'],
        ...mainstreamBook(),
      })
    ).toBe(false)
  })

  it('excludes exact erotica subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Erotica'],
        ...mainstreamBook(),
      })
    ).toBe(false)
  })

  it('excludes strong erotica classifications', () => {
    expect(
      isEligibleTrendingBook({
        subject: [
          'Fiction, Erotica, General',
          'Fiction, Romance, Erotica',
          'Erotic Literature',
        ],
        ...mainstreamBook(),
      })
    ).toBe(false)
  })

  it('excludes pornographic fiction subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Pornographic Fiction'],
        ...mainstreamBook(),
      })
    ).toBe(false)
  })

  it('excludes pornographic subject keys', () => {
    expect(
      isEligibleTrendingBook({
        subject_key: ['pornographic_fiction'],
        ...mainstreamBook(),
      })
    ).toBe(false)
  })

  it('allows normal romance subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Romance', 'Romance fiction'],
        ...mainstreamBook(),
      })
    ).toBe(true)
  })

  it('allows love stories', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Love stories'],
        ...mainstreamBook(),
      })
    ).toBe(true)
  })

  it('allows sexuality subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Sexuality'],
        ...mainstreamBook(),
      })
    ).toBe(true)
  })

  it('allows sex education subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Sex education'],
        ...mainstreamBook(),
      })
    ).toBe(true)
  })

  it('allows health subjects', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Health'],
        ...mainstreamBook(),
      })
    ).toBe(true)
  })

  it('rejects clearly low-signal candidates', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Fiction'],
        edition_count: 1,
        ratings_count: 0,
        want_to_read_count: 3,
        currently_reading_count: 1,
        already_read_count: 0,
      })
    ).toBe(false)
  })

  it('allows established multi-edition books', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Fiction'],
        edition_count: 5,
        ratings_count: 0,
        want_to_read_count: 3,
        currently_reading_count: 1,
        already_read_count: 0,
      })
    ).toBe(true)
  })

  it('allows newer books with meaningful reader interest', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Fiction'],
        edition_count: 1,
        ratings_count: 2,
        want_to_read_count: 20,
        currently_reading_count: 2,
        already_read_count: 1,
      })
    ).toBe(true)
  })

  it('allows meaningful reading-log activity with sparse ratings', () => {
    expect(
      isEligibleTrendingBook({
        subject: ['Fiction'],
        edition_count: 1,
        ratings_count: 0,
        want_to_read_count: 80,
        currently_reading_count: 10,
        already_read_count: 10,
      })
    ).toBe(true)
  })
})

describe('getTrendingBooksDetails', () => {
  it('requests and preserves subject metadata', async () => {
    const fetchMock = mockTrendingResponse([
      trendingDoc('OL1W', ['Romance fiction']),
    ])

    vi.stubGlobal('fetch', fetchMock)

    const books = await getTrendingBooksDetails(10)
    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('fields')).toContain('subject')
    expect(url.searchParams.get('fields')).toContain('subject_key')
    expect(url.searchParams.get('fields')).toContain('edition_count')
    expect(url.searchParams.get('fields')).toContain('ratings_count')
    expect(url.searchParams.get('fields')).toContain(
      'want_to_read_count'
    )
    expect(url.searchParams.get('fields')).toContain(
      'currently_reading_count'
    )
    expect(url.searchParams.get('fields')).toContain(
      'already_read_count'
    )
    expect(books[0].subjects).toEqual(['Romance fiction'])
    expect(books[0].categories).toEqual(['Romance fiction'])
    expect(books[0].editionCount).toBe(5)
    expect(books[0].ratingsCount).toBe(2)
    expect(books[0].wantToReadCount).toBe(80)
    expect(books[0].currentlyReadingCount).toBe(10)
    expect(books[0].alreadyReadCount).toBe(10)
  })

  it('keeps safe candidates from mixed safe and explicit pools', async () => {
    vi.stubGlobal(
      'fetch',
      mockTrendingResponse([
        trendingDoc('OL1W', ['content_warning:cover']),
        trendingDoc('OL2W', ['Erotica']),
        trendingDoc('OL3W', ['Love stories']),
        trendingDoc('OL4W', ['Health']),
        trendingDoc('OL5W', ['Fiction'], {
          edition_count: 1,
          ratings_count: 0,
          want_to_read_count: 2,
          currently_reading_count: 0,
          already_read_count: 0,
        }),
        trendingDoc('OL6W', ['Pornographic Fiction']),
      ])
    )

    const books = await getTrendingBooksDetails(10)

    expect(books.map((book) => book.id)).toEqual([
      'OL3W',
      'OL4W',
    ])
    expect(books.map((book) => book.subjects)).toEqual([
      ['Love stories'],
      ['Health'],
    ])
  })
})

describe('getOpenLibraryBooksBySubject', () => {
  it('requests and preserves Open Library subject metadata for fallback recommendations', async () => {
    const fetchMock = mockTrendingResponse([
      {
        ...trendingDoc('OL7W', ['Love stories'], {
          subject_key: ['love_stories'],
        }),
      },
    ])

    vi.stubGlobal('fetch', fetchMock)

    const books = await getOpenLibraryBooksBySubject('romance', 40, 1)
    const url = new URL(fetchMock.mock.calls[0][0])

    expect(url.searchParams.get('fields')).toContain('subject')
    expect(url.searchParams.get('fields')).toContain('subject_key')
    expect(books[0].subjects).toEqual(['Love stories'])
    expect(books[0].subjectKeys).toEqual(['love_stories'])
    expect(books[0].categories).toEqual(['Love stories'])
  })
})
