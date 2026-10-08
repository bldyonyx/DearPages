import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import BookCollectionsModal from '../components/collections/modals/BookCollectionsModal.jsx'
import CollectionBooksModal from '../components/collections/modals/CollectionBooksModal.jsx'
import {
  getUserCollections,
  updateBookCollectionMembership,
  updateCollectionBookMembership,
} from '../services/collectionsService.js'

vi.mock('react-i18next', () => {
  const translation = {
    t: (key) => key,
  }

  return {
    useTranslation: () => translation,
  }
})

vi.mock('../services/collectionsService.js', () => ({
  getUserCollections: vi.fn(),
  updateBookCollectionMembership: vi.fn(),
  updateCollectionBookMembership: vi.fn(),
}))

describe('collection membership modals', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('saves collection book memberships through the atomic service helper', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()

    updateCollectionBookMembership.mockResolvedValueOnce(true)

    render(
      <CollectionBooksModal
        isOpen
        userId="user-1"
        collection={{
          id: 'favorites',
          books: {
            'book-1': true,
          },
        }}
        libraryBooks={[
          {
            googleBooksId: 'book-1',
            title: 'Selected book',
            authors: ['Author One'],
          },
          {
            googleBooksId: 'book-2',
            title: 'New book',
            authors: ['Author Two'],
          },
        ]}
        onClose={onClose}
        onSaved={onSaved}
      />
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: /new book/i })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'common.save' })
    )

    await waitFor(() => {
      expect(updateCollectionBookMembership).toHaveBeenCalledWith(
        'user-1',
        'favorites',
        ['book-1'],
        ['book-1', 'book-2']
      )
    })

    expect(onSaved).toHaveBeenCalledWith({
      'book-1': true,
      'book-2': true,
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not report collection book save success when the database write fails', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()

    updateCollectionBookMembership.mockRejectedValueOnce(
      new Error('database unavailable')
    )

    render(
      <CollectionBooksModal
        isOpen
        userId="user-1"
        collection={{
          id: 'favorites',
          books: {
            'book-1': true,
          },
        }}
        libraryBooks={[
          {
            googleBooksId: 'book-1',
            title: 'Selected book',
            authors: ['Author One'],
          },
          {
            googleBooksId: 'book-2',
            title: 'New book',
            authors: ['Author Two'],
          },
        ]}
        onClose={onClose}
        onSaved={onSaved}
      />
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: /new book/i })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'common.save' })
    )

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('collectionPage.booksModal.saveError')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('saves book collection memberships through the atomic service helper', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()

    getUserCollections.mockResolvedValue([
      {
        id: 'favorites',
        name: 'Favorites',
        books: {
          'book-1': true,
        },
      },
      {
        id: 'backlog',
        name: 'Backlog',
        books: {},
      },
    ])
    updateBookCollectionMembership.mockResolvedValueOnce(true)

    render(
      <BookCollectionsModal
        isOpen
        userId="user-1"
        bookId="book-1"
        onClose={onClose}
        onSaved={onSaved}
      />
    )

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /backlog/i })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'common.save' })
    )

    await waitFor(() => {
      expect(updateBookCollectionMembership).toHaveBeenCalledWith(
        'user-1',
        'book-1',
        ['favorites'],
        ['favorites', 'backlog']
      )
    })

    expect(onSaved).toHaveBeenCalledWith(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
