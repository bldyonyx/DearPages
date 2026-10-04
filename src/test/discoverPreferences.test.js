import { describe, expect, it } from 'vitest'
import { FALLBACK_DISCOVER_PREFERENCES } from '../constants/discoverPreferences'
import { AVAILABLE_GENRES } from '../constants/genres'
import {
  createDiscoverPreferencesSignature,
  normalizeDiscoverPreferences,
} from '../utils/discoverPreferences'

describe('normalizeDiscoverPreferences', () => {
  it('normalizes valid genre subjects into Discover preferences', () => {
    const firstGenre = AVAILABLE_GENRES[0]
    const secondGenre = AVAILABLE_GENRES[1]

    const result = normalizeDiscoverPreferences([
      firstGenre.subject,
      secondGenre.subject,
    ])

    expect(result).toEqual([
      {
        label: firstGenre.label,
        subject: firstGenre.subject,
      },
      {
        label: secondGenre.label,
        subject: secondGenre.subject,
      },
    ])
  })

  it('ignores invalid and unsupported genres', () => {
    const validGenre = AVAILABLE_GENRES[0]

    const result = normalizeDiscoverPreferences([
      validGenre.subject,
      'genre-that-does-not-exist',
      '',
      null,
      42,
    ])

    expect(result).toEqual([
      {
        label: validGenre.label,
        subject: validGenre.subject,
      },
    ])
  })

  it('removes duplicate genre subjects', () => {
    const genre = AVAILABLE_GENRES[0]

    const result = normalizeDiscoverPreferences([
      genre.subject,
      genre.subject,
      `  ${genre.subject}  `,
    ])

    expect(result).toEqual([
      {
        label: genre.label,
        subject: genre.subject,
      },
    ])
  })

  it('uses the fallback preferences when no valid genre remains', () => {
    expect(normalizeDiscoverPreferences(['invalid-genre'])).toEqual(
      FALLBACK_DISCOVER_PREFERENCES
    )

    expect(normalizeDiscoverPreferences(null)).toEqual(
      FALLBACK_DISCOVER_PREFERENCES
    )
  })
})

describe('createDiscoverPreferencesSignature', () => {
  it('creates a stable signature from preference subjects', () => {
    const preferences = [
      { label: 'Fantasy', subject: 'fantasy' },
      { label: 'Romance', subject: 'romance' },
    ]

    expect(createDiscoverPreferencesSignature(preferences)).toBe(
      'fantasy|romance'
    )
  })
})