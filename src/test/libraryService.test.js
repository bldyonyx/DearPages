import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  get,
  ref,
  update,
} from 'firebase/database'

import {
  BOOK_STATUSES,
  createLibraryBook,
  removeBookFromLibrary,
  updateBookNote,
  updateBookReview,
} from '../services/libraryService.js'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  ref: vi.fn((database, path) => ({
    database,
    path,
  })),
  set: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../services/firebase.js', () => ({
  database: {
    app: 'firebase-test-app',
  },
}))

function createSnapshot(value) {
  return {
    exists: () => value !== null && value !== undefined,
    val: () => value,
  }
}

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

describe('removeBookFromLibrary', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('deletes a book that belongs to no collections with one atomic write', async () => {
    get.mockResolvedValueOnce(
      createSnapshot({
        favorites: {
          books: {
            'other-book': true,
          },
          updatedAt: 100,
        },
      })
    )

    await removeBookFromLibrary('user-1', 'book-1')

    expect(ref).toHaveBeenCalledWith(
      expect.any(Object),
      'users/user-1'
    )
    expect(ref).toHaveBeenCalledWith(
      expect.any(Object),
      'users/user-1/collections'
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      {
        database: expect.any(Object),
        path: 'users/user-1',
      },
      {
        'library/book-1': null,
      }
    )
  })

  it('deletes a book and removes its reference from one collection atomically', async () => {
    get.mockResolvedValueOnce(
      createSnapshot({
        favorites: {
          books: {
            'book-1': true,
            'other-book': true,
          },
          name: 'Favorites',
          updatedAt: 100,
        },
        backlog: {
          books: {
            'other-book': true,
          },
          updatedAt: 200,
        },
      })
    )

    await removeBookFromLibrary('user-1', 'book-1')

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1',
      }),
      {
        'library/book-1': null,
        'collections/favorites/books/book-1': null,
        'collections/favorites/updatedAt': 1234567890,
      }
    )
  })

  it('deletes a book and removes its references from multiple collections atomically', async () => {
    get.mockResolvedValueOnce(
      createSnapshot({
        favorites: {
          books: {
            'book-1': true,
          },
        },
        rereads: {
          books: {
            'book-1': true,
          },
        },
        backlog: {
          books: {
            'other-book': true,
          },
        },
      })
    )

    await removeBookFromLibrary('user-1', 'book-1')

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1',
      }),
      {
        'library/book-1': null,
        'collections/favorites/books/book-1': null,
        'collections/favorites/updatedAt': 1234567890,
        'collections/rereads/books/book-1': null,
        'collections/rereads/updatedAt': 1234567890,
      }
    )
  })

  it('preserves unrelated books and collection memberships by omitting them from the update', async () => {
    get.mockResolvedValueOnce(
      createSnapshot({
        favorites: {
          name: 'Favorites',
          books: {
            'book-1': true,
            'other-book': true,
          },
          pinned: true,
        },
        backlog: {
          books: {
            'other-book': true,
          },
        },
      })
    )

    await removeBookFromLibrary('user-1', 'book-1')

    const updates = update.mock.calls[0][1]

    expect(updates).toEqual({
      'library/book-1': null,
      'collections/favorites/books/book-1': null,
      'collections/favorites/updatedAt': 1234567890,
    })
    expect(updates).not.toHaveProperty(
      'collections/favorites/books/other-book'
    )
    expect(updates).not.toHaveProperty(
      'collections/backlog/books/other-book'
    )
    expect(updates).not.toHaveProperty(
      'collections/favorites/name'
    )
    expect(updates).not.toHaveProperty(
      'collections/favorites/pinned'
    )
  })

  it('constructs valid relative multi-location update paths without ancestor conflicts', async () => {
    get.mockResolvedValueOnce(
      createSnapshot({
        favorites: {
          books: {
            'book-1': true,
          },
        },
      })
    )

    await removeBookFromLibrary('user-1', 'book-1')

    const updates = update.mock.calls[0][1]
    const updatePaths = Object.keys(updates)

    expect(updatePaths).toEqual([
      'library/book-1',
      'collections/favorites/books/book-1',
      'collections/favorites/updatedAt',
    ])
    expect(updatePaths).not.toContain('library')
    expect(updatePaths).not.toContain('collections')
    expect(updatePaths).not.toContain(
      'collections/favorites'
    )
    expect(updatePaths).not.toContain(
      'collections/favorites/books'
    )
  })

  it('does not report a successful deletion when the atomic write fails', async () => {
    const writeError = new Error('database unavailable')

    get.mockResolvedValueOnce(createSnapshot(null))
    update.mockRejectedValueOnce(writeError)

    await expect(
      removeBookFromLibrary('user-1', 'book-1')
    ).rejects.toThrow('database unavailable')

    expect(update).toHaveBeenCalledTimes(1)
  })

  it('preserves missing collection data behavior by deleting only the library book', async () => {
    get.mockResolvedValueOnce(createSnapshot(null))

    await removeBookFromLibrary('user-1', 'book-1')

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1',
      }),
      {
        'library/book-1': null,
      }
    )
  })

  it('rejects invalid deletion IDs without reading or writing Firebase data', async () => {
    await expect(
      removeBookFromLibrary('', 'book-1')
    ).rejects.toThrow('Missing user or book information.')
    await expect(
      removeBookFromLibrary('user-1', '')
    ).rejects.toThrow('Missing user or book information.')

    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('notes and reviews persistence', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('persists sanitized note HTML without changing other fields', async () => {
    await updateBookNote(
      'user-1',
      'book-1',
      '<p onclick="alert(1)">Note <strong>text</strong><img src=x onerror=alert(1)></p>'
    )

    expect(ref).toHaveBeenCalledWith(
      expect.any(Object),
      'users/user-1/library/book-1'
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/library/book-1',
      }),
      {
        note: '<p>Note <strong>text</strong></p>',
        updatedAt: 1234567890,
      }
    )
  })

  it('persists sanitized review HTML independently from notes', async () => {
    await updateBookReview(
      'user-1',
      'book-1',
      '<div><font size="5">Great</font><font size="7"> huge</font><iframe src=x></iframe></div>'
    )

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/library/book-1',
      }),
      {
        review:
          '<div><font size="5">Great</font><font> huge</font></div>',
        updatedAt: 1234567890,
      }
    )
    expect(update.mock.calls[0][1]).not.toHaveProperty('note')
  })

  it('preserves supported formatted content when saving', async () => {
    const formattedHtml =
      '<p><strong>Bold</strong> and <em>italic</em></p><div><font size="2">small</font><br><font size="3">normal</font><font size="5">large</font></div>'

    await updateBookNote('user-1', 'book-1', formattedHtml)

    expect(update.mock.calls[0][1]).toEqual({
      note: formattedHtml,
      updatedAt: 1234567890,
    })
  })
})
