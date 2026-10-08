import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  ref,
  update,
} from 'firebase/database'

import {
  updateBookCollectionMembership,
  updateCollectionBookMembership,
} from '../services/collectionsService.js'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  push: vi.fn(),
  ref: vi.fn((database, path) => ({
    database,
    path,
  })),
  remove: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../services/firebase.js', () => ({
  database: {
    app: 'firebase-test-app',
  },
}))

function expectNoAncestorConflicts(updatePaths) {
  updatePaths.forEach((path) => {
    const pathSegments = path.split('/')

    pathSegments.slice(0, -1).forEach((_, index) => {
      const ancestorPath = pathSegments
        .slice(0, index + 1)
        .join('/')

      expect(updatePaths).not.toContain(ancestorPath)
    })
  })
}

describe('updateCollectionBookMembership', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('adds a book to a collection with one atomic write', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1'],
      ['book-1', 'book-2']
    )

    expect(ref).toHaveBeenCalledWith(
      expect.any(Object),
      'users/user-1/collections'
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/collections',
      }),
      {
        'favorites/books/book-2': true,
        'favorites/updatedAt': 1234567890,
      }
    )
  })

  it('removes a book from a collection with one atomic write', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1', 'book-2'],
      ['book-2']
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/collections',
      }),
      {
        'favorites/books/book-1': null,
        'favorites/updatedAt': 1234567890,
      }
    )
  })

  it('adds and removes different books in the same save', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1', 'book-2'],
      ['book-2', 'book-3']
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/collections',
      }),
      {
        'favorites/books/book-3': true,
        'favorites/books/book-1': null,
        'favorites/updatedAt': 1234567890,
      }
    )
  })

  it('handles empty selections by removing selected memberships', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1', 'book-2'],
      []
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1]).toEqual({
      'favorites/books/book-1': null,
      'favorites/books/book-2': null,
      'favorites/updatedAt': 1234567890,
    })
  })

  it('does not write when there are no membership changes', async () => {
    const didWrite = await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1', 'book-2'],
      ['book-2', 'book-1']
    )

    expect(didWrite).toBe(false)
    expect(ref).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('preserves unrelated memberships and collection metadata', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1'],
      ['book-2']
    )

    const updates = update.mock.calls[0][1]

    expect(updates).toEqual({
      'favorites/books/book-2': true,
      'favorites/books/book-1': null,
      'favorites/updatedAt': 1234567890,
    })
    expect(updates).not.toHaveProperty(
      'favorites/books/other-book'
    )
    expect(updates).not.toHaveProperty('favorites/name')
    expect(updates).not.toHaveProperty('favorites/pinned')
    expect(updates).not.toHaveProperty('backlog/books/book-1')
  })

  it('constructs valid non-conflicting RTDB update paths', async () => {
    await updateCollectionBookMembership(
      'user-1',
      'favorites',
      ['book-1'],
      ['book-2']
    )

    const updatePaths = Object.keys(update.mock.calls[0][1])

    expect(updatePaths).toEqual([
      'favorites/books/book-2',
      'favorites/books/book-1',
      'favorites/updatedAt',
    ])
    expectNoAncestorConflicts(updatePaths)
  })

  it('propagates database write failures', async () => {
    update.mockRejectedValueOnce(
      new Error('database unavailable')
    )

    await expect(
      updateCollectionBookMembership(
        'user-1',
        'favorites',
        ['book-1'],
        ['book-2']
      )
    ).rejects.toThrow('database unavailable')

    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('updateBookCollectionMembership', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('adds one book to multiple collections with one atomic write', async () => {
    await updateBookCollectionMembership(
      'user-1',
      'book-1',
      [],
      ['favorites', 'backlog']
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'users/user-1/collections',
      }),
      {
        'favorites/books/book-1': true,
        'favorites/updatedAt': 1234567890,
        'backlog/books/book-1': true,
        'backlog/updatedAt': 1234567890,
      }
    )
  })

  it('removes one book from multiple collections with one atomic write', async () => {
    await updateBookCollectionMembership(
      'user-1',
      'book-1',
      ['favorites', 'backlog'],
      []
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1]).toEqual({
      'favorites/books/book-1': null,
      'favorites/updatedAt': 1234567890,
      'backlog/books/book-1': null,
      'backlog/updatedAt': 1234567890,
    })
  })

  it('handles mixed additions and removals across collections', async () => {
    await updateBookCollectionMembership(
      'user-1',
      'book-1',
      ['favorites', 'owned'],
      ['favorites', 'backlog']
    )

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1]).toEqual({
      'backlog/books/book-1': true,
      'backlog/updatedAt': 1234567890,
      'owned/books/book-1': null,
      'owned/updatedAt': 1234567890,
    })
  })

  it('does not write when selected collections are unchanged', async () => {
    const didWrite = await updateBookCollectionMembership(
      'user-1',
      'book-1',
      ['favorites', 'backlog'],
      ['backlog', 'favorites']
    )

    expect(didWrite).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('updates only affected collections updatedAt values', async () => {
    await updateBookCollectionMembership(
      'user-1',
      'book-1',
      ['favorites', 'unchanged'],
      ['favorites', 'unchanged', 'new-list']
    )

    const updates = update.mock.calls[0][1]

    expect(updates).toHaveProperty(
      'new-list/updatedAt',
      1234567890
    )
    expect(updates).not.toHaveProperty('favorites/updatedAt')
    expect(updates).not.toHaveProperty('unchanged/updatedAt')
  })

  it('constructs valid non-conflicting RTDB update paths', async () => {
    await updateBookCollectionMembership(
      'user-1',
      'book-1',
      ['favorites'],
      ['backlog']
    )

    const updatePaths = Object.keys(update.mock.calls[0][1])

    expect(updatePaths).toEqual([
      'backlog/books/book-1',
      'backlog/updatedAt',
      'favorites/books/book-1',
      'favorites/updatedAt',
    ])
    expectNoAncestorConflicts(updatePaths)
  })
})
