import { afterEach, describe, expect, it } from 'vitest'
import {
  readRecommendationState,
  RECOMMENDATION_STORAGE_KEYS,
  writeRecommendationState,
} from '../utils/recommendationSessionStorage'

const USER_ID = 'user-1'

function recommendationState() {
  return {
    books: [{ id: 'book-1', title: 'Book One' }],
    seenIdentityKeys: new Set(['id:book-1']),
    candidatePool: [{ id: 'book-1', title: 'Book One' }],
    isPoolExhausted: false,
  }
}

afterEach(() => {
  window.sessionStorage.clear()
})

describe('RECOMMENDATION_STORAGE_KEYS', () => {
  it('versions the Trending storage key', () => {
    expect(RECOMMENDATION_STORAGE_KEYS.trending(USER_ID)).toBe(
      'booktracker:recommendations:user:user-1:discover:trending:v3'
    )
  })

  it('keeps other recommendation storage keys unchanged', () => {
    expect(
      RECOMMENDATION_STORAGE_KEYS.homeForYou(USER_ID, 'sig')
    ).toBe(
      'booktracker:recommendations:user:user-1:discover:home-for-you:v6:sig'
    )
    expect(RECOMMENDATION_STORAGE_KEYS.mustReads(USER_ID)).toBe(
      'booktracker:recommendations:user:user-1:discover:must-reads:v2'
    )
    expect(
      RECOMMENDATION_STORAGE_KEYS.forYouGenre(
        USER_ID,
        'sig',
        'classics'
      )
    ).toBe(
      'booktracker:recommendations:user:user-1:for-you:v6:sig:classics'
    )
  })
})

describe('automatic recommendation storage', () => {
  it('does not restore old personalized recommendation states through new keys', () => {
    const staleKeys = [
      'booktracker:recommendations:user:user-1:discover:home-for-you:v5:sig',
      'booktracker:recommendations:user:user-1:for-you:v5:sig:romance',
      'booktracker:recommendations:user:user-1:discover:must-reads',
    ]

    staleKeys.forEach((key) => {
      writeRecommendationState(key, recommendationState())
    })

    expect(
      readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.homeForYou(USER_ID, 'sig')
      )
    ).toBeNull()
    expect(
      readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.forYouGenre(
          USER_ID,
          'sig',
          'romance'
        )
      )
    ).toBeNull()
    expect(
      readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.mustReads(USER_ID)
      )
    ).toBeNull()
  })

  it('saves and restores new personalized recommendation states normally', () => {
    const keys = [
      RECOMMENDATION_STORAGE_KEYS.homeForYou(USER_ID, 'sig'),
      RECOMMENDATION_STORAGE_KEYS.forYouGenre(
        USER_ID,
        'sig',
        'romance'
      ),
      RECOMMENDATION_STORAGE_KEYS.mustReads(USER_ID),
    ]

    keys.forEach((key) => {
      writeRecommendationState(key, recommendationState())
      expect(readRecommendationState(key)?.books).toEqual([
        { id: 'book-1', title: 'Book One' },
      ])
    })
  })
})

describe('Trending recommendation storage', () => {
  it('does not restore v1 or v2 Trending state through the v3 key', () => {
    const staleTrendingKeys = [
      'booktracker:recommendations:user:user-1:discover:trending',
      'booktracker:recommendations:user:user-1:discover:trending:v2',
    ]

    staleTrendingKeys.forEach((key) => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          books: [{ id: 'explicit-old-book' }],
          seenIdentityKeys: ['id:explicit-old-book'],
          candidatePool: [{ id: 'explicit-old-book' }],
          isPoolExhausted: false,
        })
      )
    })

    expect(
      readRecommendationState(
        RECOMMENDATION_STORAGE_KEYS.trending(USER_ID)
      )
    ).toBeNull()
  })

  it('saves and restores new versioned Trending state normally', () => {
    const key = RECOMMENDATION_STORAGE_KEYS.trending(USER_ID)

    writeRecommendationState(key, recommendationState())

    expect(readRecommendationState(key)).toEqual({
      books: [{ id: 'book-1', title: 'Book One' }],
      startIndex: 0,
      seenIdentityKeys: ['id:book-1'],
      candidatePool: [{ id: 'book-1', title: 'Book One' }],
      isPoolExhausted: false,
      bookLimit: 0,
    })
  })
})
