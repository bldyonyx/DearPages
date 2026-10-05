import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBooksBySubjectWindow } from '../services/booksApi'
import { fetchRecommendationBatch } from '../utils/recommendationBatching'

vi.mock('../services/booksApi', () => ({
  getBooksBySubjectWindow: vi.fn(),
}))

function book(id, categories = ['Romance']) {
  return {
    id,
    title: `Book ${id}`,
    authors: [`Author ${id}`],
    categories,
    cover: `cover-${id}.jpg`,
    source: 'google-books',
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('fetchRecommendationBatch discovery safety', () => {
  it('removes explicit Google Books category candidates', async () => {
    getBooksBySubjectWindow.mockResolvedValueOnce({
      books: [
        book('explicit-google', ['Fiction, Romance, Erotica']),
        ...Array.from({ length: 7 }, (_, index) =>
          book(`safe-google-${index + 1}`, ['Romance'])
        ),
      ],
      returnedCount: 8,
      nextStartIndex: 8,
    })

    const result = await fetchRecommendationBatch({
      subject: 'romance',
      limit: 7,
      windowSize: 8,
      maxAttempts: 1,
    })

    expect(result.books).toHaveLength(7)
    expect(result.books.map((item) => item.id)).not.toContain(
      'explicit-google'
    )
  })

  it('removes explicit Open Library fallback subject candidates', async () => {
    getBooksBySubjectWindow.mockResolvedValueOnce({
      books: [],
      returnedCount: 0,
      nextStartIndex: 0,
    })

    const fallbackBooksLoader = vi.fn().mockResolvedValue([
      {
        ...book('explicit-open-library'),
        categories: ['Pornographic Fiction'],
        subjects: ['Pornographic Fiction'],
        subjectKeys: ['pornographic_fiction'],
        source: 'open-library',
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        ...book(`safe-open-library-${index + 1}`, ['Love stories']),
        subjects: ['Love stories'],
        source: 'open-library',
      })),
    ])

    const result = await fetchRecommendationBatch({
      subject: 'romance',
      limit: 7,
      windowSize: 8,
      maxAttempts: 1,
      fallbackBooksLoader,
      maxFallbackAttempts: 1,
    })

    expect(result.books).toHaveLength(7)
    expect(result.books.map((item) => item.id)).not.toContain(
      'explicit-open-library'
    )
  })

  it('keeps normal Romance candidates and fills from safe books', async () => {
    getBooksBySubjectWindow.mockResolvedValueOnce({
      books: Array.from({ length: 7 }, (_, index) =>
        book(`safe-romance-${index + 1}`, [
          index === 0 ? 'Love stories' : 'Romance fiction',
        ])
      ),
      returnedCount: 7,
      nextStartIndex: 7,
    })

    const result = await fetchRecommendationBatch({
      subject: 'romance',
      limit: 7,
      windowSize: 7,
      maxAttempts: 1,
    })

    expect(result.books).toHaveLength(7)
    expect(
      result.books.some((item) =>
        item.categories.includes('Love stories')
      )
    ).toBe(true)
  })
})
