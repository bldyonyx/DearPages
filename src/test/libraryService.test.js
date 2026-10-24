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
  runTransaction,
  update,
} from 'firebase/database'

import {
  BOOK_STATUSES,
  createLibraryBook,
  addBookToLibrary,
  updateBookRating,
  updateBookStatus,
  updateBookFinishedAt,
  updateBookAbandonedAt,
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
  runTransaction: vi.fn(),
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

describe('atomic book persistence', () => {
  const original = {
    id: 'book-1', title: 'Original title', authors: ['Author'],
    status: 'finished', addedAt: 10, finishedAt: 20,
    note: 'Private note', review: 'Private review', rating: 4,
    customMetadata: { preserved: true },
  }
  let stored
  beforeEach(() => {
    vi.clearAllMocks()
    stored = structuredClone(original)
    runTransaction.mockImplementation(async (_ref, callback) => {
      const next = callback(stored)
      if (next !== undefined) stored = next
      return { committed: next !== undefined, snapshot: createSnapshot(stored) }
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('creates a book once and preserves every existing field on repeated add', async () => {
    stored = null
    const book = { id: 'book-1', title: 'New book', authors: ['Author'] }
    await addBookToLibrary('user-1', book, BOOK_STATUSES.FINISHED)
    expect(stored).toMatchObject({ id: 'book-1', title: 'New book', status: 'finished' })
    expect(stored.finishedAt).toEqual(expect.any(Number))
    stored = structuredClone(original)
    await addBookToLibrary('user-1', book, BOOK_STATUSES.TO_READ)
    expect(stored).toEqual(original)
    expect(update).not.toHaveBeenCalled()
  })

  it('aborts a repeated add if another client creates the book during a retry', async () => {
    runTransaction.mockImplementationOnce(async (_ref, callback) => {
      expect(callback(null)).toMatchObject({ title: 'New book' })
      expect(callback(original)).toBeUndefined()
    })
    await addBookToLibrary('user-1', { id: 'book-1', title: 'New book', authors: [] })
  })

  it.each([
    [updateBookNote, 'note', '<p onclick="bad()">Safe<strong> text</strong><img src=x></p>', '<p>Safe<strong> text</strong></p>'],
    [updateBookReview, 'review', '<div><font size="5">Great</font><font size="7"> huge</font><iframe src=x></iframe></div>', '<div><font size="5">Great</font><font> huge</font></div>'],
    [updateBookRating, 'rating', 5, 5],
    [updateBookFinishedAt, 'finishedAt', 123, 123],
    [updateBookAbandonedAt, 'abandonedAt', 456, 456],
  ])('saves %s independently while preserving metadata', async (save, field, input, expected) => {
    await save('user-1', 'book-1', input)
    expect(stored).toEqual({ ...original, [field]: expected, updatedAt: expect.any(Number) })
    expect(runTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/library/book-1' }),
      expect.any(Function), { applyLocally: false }
    )
  })

  const saves = [
    [updateBookNote, 'draft'], [updateBookReview, 'draft'], [updateBookRating, 3],
    [updateBookFinishedAt, 123], [updateBookAbandonedAt, 456], [updateBookStatus, 'reading'],
  ]
  it.each(saves)('rejects %s after deletion without recreating data', async (save, value) => {
    stored = null
    await expect(save('user-1', 'book-1', value)).rejects.toMatchObject({ code: 'library/book-not-found' })
    expect(stored).toBeNull()
  })

  it.each(saves)('rechecks existence when %s races a deletion', async (save, value) => {
    runTransaction.mockImplementationOnce(async (_ref, callback) => {
      expect(callback(original)).toBeTruthy()
      expect(callback(null)).toBeNull()
      return { committed: true, snapshot: createSnapshot(null) }
    })
    await expect(save('user-1', 'book-1', value)).rejects.toMatchObject({ code: 'library/book-not-found' })
  })

  it('preserves concurrent note and rating changes when the transaction retries', async () => {
    const concurrent = { ...original, note: 'Concurrent note', rating: 2 }
    runTransaction.mockImplementationOnce(async (_ref, callback) => {
      callback(original)
      stored = callback(concurrent)
      return { committed: true, snapshot: createSnapshot(stored) }
    })
    await updateBookReview('user-1', 'book-1', 'New review')
    expect(stored).toMatchObject({ note: 'Concurrent note', rating: 2, review: 'New review' })
  })

  it('can retry from an empty local cache against an existing server book', async () => {
    runTransaction.mockImplementationOnce(async (_ref, callback) => {
      expect(callback(null)).toBeNull()
      stored = callback(original)
      return { committed: true, snapshot: createSnapshot(stored) }
    })
    await updateBookNote('user-1', 'book-1', 'Saved')
    expect(stored.note).toBe('Saved')
  })

  it('preserves supported formatted content when saving', async () => {
    const html = '<p><strong>Bold</strong> and <em>italic</em></p><div><font size="2">small</font><br><font size="3">normal</font><font size="5">large</font></div>'
    await updateBookNote('user-1', 'book-1', html)
    expect(stored.note).toBe(html)
  })

  it.each(saves)('rejects missing identifiers for %s without accessing Firebase', async (save, value) => {
    await expect(save('', 'book-1', value)).rejects.toThrow('Missing')
    await expect(save('user-1', '', value)).rejects.toThrow('Missing')
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('propagates failed adds and rejects missing add identifiers', async () => {
    const book = { id: 'book-1', title: 'Book', authors: [] }
    await expect(addBookToLibrary('', book)).rejects.toThrow('Missing')
    await expect(addBookToLibrary('user-1', {})).rejects.toThrow('Missing')
    expect(runTransaction).not.toHaveBeenCalled()
    runTransaction.mockRejectedValueOnce(new Error('permission denied'))
    await expect(addBookToLibrary('user-1', book)).rejects.toThrow('permission denied')
  })

  it('preserves status dates for unchanged status and transitions final dates', async () => {
    await expect(updateBookStatus('user-1', 'book-1', 'finished')).resolves.toBeNull()
    expect(stored).toEqual(original)
    await updateBookStatus('user-1', 'book-1', 'abandoned')
    expect(stored).toMatchObject({ status: 'abandoned', finishedAt: null, abandonedAt: expect.any(Number) })
  })

  it.each([0, 6, NaN, Infinity, '3', undefined, 2.5])('rejects invalid rating %s before writing', async (rating) => {
    await expect(updateBookRating('user-1', 'book-1', rating)).rejects.toThrow('Rating must be between 1 and 5.')
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it.each(saves)('propagates transaction errors for %s', async (save, value) => {
    runTransaction.mockRejectedValueOnce(new Error('permission denied'))
    await expect(save('user-1', 'book-1', value)).rejects.toThrow('permission denied')
  })
})

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

  it('stores Open Library books without inventing a Google Books ID', () => {
    const libraryBook = createLibraryBook(
      {
        id: 'OL123W',
        openLibraryId: '/works/OL123W',
        title: 'Open Library title',
        authors: ['Author name'],
        source: 'open-library',
      },
      BOOK_STATUSES.TO_READ
    )

    expect(libraryBook.id).toBe('OL123W')
    expect(libraryBook.googleBooksId).toBeNull()
    expect(libraryBook.openLibraryId).toBe('/works/OL123W')
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
