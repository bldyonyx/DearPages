import { describe, expect, it } from 'vitest'
import { selectTrendingRefreshBooks } from '../hooks/useDiscoverHomeBooks'
import { addBooksToIdentitySet } from '../utils/recommendationSelection'

function book(id, cover = `cover-${id}.jpg`) {
  return {
    id,
    title: `Book ${id}`,
    authors: [`Author ${id}`],
    cover,
    source: 'open-library',
  }
}

function candidatePool(count) {
  return Array.from({ length: count }, (_, index) =>
    book(`book-${index + 1}`)
  )
}

function seenSet(books) {
  const seenIdentityKeys = new Set()

  addBooksToIdentitySet(seenIdentityKeys, books)

  return seenIdentityKeys
}

describe('selectTrendingRefreshBooks', () => {
  it('returns 7 books when at least 7 candidates exist', () => {
    const result = selectTrendingRefreshBooks(candidatePool(10), {
      limit: 7,
    })

    expect(result.books).toHaveLength(7)
    expect(result.isPoolExhausted).toBe(false)
  })

  it('prefers unseen candidates on refresh', () => {
    const candidates = candidatePool(14)
    const previouslyShown = candidates.slice(0, 7)
    const result = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: seenSet(previouslyShown),
    })

    expect(result.books).toHaveLength(7)
    result.books.forEach((selectedBook) => {
      expect(previouslyShown.map((item) => item.id)).not.toContain(
        selectedBook.id
      )
    })
  })

  it('fills partial remaining unseen candidates from the same pool', () => {
    const candidates = candidatePool(10)
    const remainingUnseen = candidates.slice(8)
    const result = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: seenSet(candidates.slice(0, 8)),
    })

    expect(result.books).toHaveLength(7)
    remainingUnseen.forEach((unseenBook) => {
      expect(result.books.map((item) => item.id)).toContain(
        unseenBook.id
      )
    })
    expect(result.isPoolExhausted).toBe(false)
  })

  it('resets seen history after the safe pool is exhausted', () => {
    const candidates = candidatePool(10)
    const result = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: seenSet(candidates),
    })

    expect(result.books).toHaveLength(7)
    expect(result.seenIdentityKeys.size).toBeGreaterThanOrEqual(7)
    expect(result.isPoolExhausted).toBe(false)
  })

  it('returns 7 again from the same pool after exhaustion', () => {
    const candidates = candidatePool(8)
    const exhaustedResult = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: seenSet(candidates),
    })
    const nextResult = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: exhaustedResult.seenIdentityKeys,
    })

    expect(exhaustedResult.books).toHaveLength(7)
    expect(nextResult.books).toHaveLength(7)
  })

  it('does not reintroduce excluded candidates during recycling', () => {
    const candidates = candidatePool(10)
    const excludedBook = candidates[0]
    const result = selectTrendingRefreshBooks(candidates, {
      limit: 7,
      shownIdentityKeys: seenSet(candidates),
      excludedBookIds: [excludedBook],
    })

    expect(result.books).toHaveLength(7)
    expect(result.books.map((item) => item.id)).not.toContain(
      excludedBook.id
    )
  })

  it('handles genuinely fewer than 7 available candidates gracefully', () => {
    const result = selectTrendingRefreshBooks(candidatePool(5), {
      limit: 7,
    })

    expect(result.books).toHaveLength(5)
    expect(result.isPoolExhausted).toBe(true)
  })
})
