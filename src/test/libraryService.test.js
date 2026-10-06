import { describe, expect, it } from 'vitest'

import {
  BOOK_STATUSES,
  createLibraryBook,
} from '../services/libraryService.js'

describe('createLibraryBook', () => {
  it('preserves the selected book description for library navigation', () => {
    const libraryBook = createLibraryBook(
      {
        googleBooksId: 'volume-1',
        title: 'Book title',
        authors: ['Author name'],
        isbn: '9781234567890',
        isbns: ['9781234567890'],
        cover: 'https://example.com/cover.jpg',
        categories: ['Fiction'],
        publishedDate: '2024',
        description: 'Known description from the selected edition.',
        source: 'google-books',
      },
      BOOK_STATUSES.TO_READ
    )

    expect(libraryBook.description).toBe(
      'Known description from the selected edition.'
    )
  })

  it('stores an empty description when the selected book has none', () => {
    const libraryBook = createLibraryBook(
      {
        googleBooksId: 'volume-1',
        title: 'Book title',
        authors: ['Author name'],
      },
      BOOK_STATUSES.TO_READ
    )

    expect(libraryBook.description).toBe('')
  })
})
