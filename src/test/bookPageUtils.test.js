import { describe, expect, it } from 'vitest'

import { mergeBookDetails } from '../utils/bookPageUtils.js'

describe('mergeBookDetails', () => {
  it('preserves the current route-state description over canonical data', () => {
    const mergedBook = mergeBookDetails(
      {
        id: 'volume-1',
        googleBooksId: 'volume-1',
        title: 'Route title',
        authors: ['Route author'],
        description: 'Known route-state description.',
      },
      {
        id: 'volume-1',
        googleBooksId: 'volume-1',
        title: 'Canonical title',
        authors: ['Canonical author'],
        description: 'Canonical description.',
      }
    )

    expect(mergedBook.description).toBe(
      'Known route-state description.'
    )
  })

  it('uses canonical description only when current book has none', () => {
    const mergedBook = mergeBookDetails(
      {
        id: 'volume-1',
        googleBooksId: 'volume-1',
        title: 'Route title',
        authors: ['Route author'],
        description: '',
      },
      {
        id: 'volume-1',
        googleBooksId: 'volume-1',
        title: 'Canonical title',
        authors: ['Canonical author'],
        description: 'Canonical description.',
      }
    )

    expect(mergedBook.description).toBe(
      'Canonical description.'
    )
  })
})
