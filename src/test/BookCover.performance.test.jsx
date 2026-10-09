import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import BookCard from '../components/books/BookCard.jsx'
import BookCover from '../components/books/BookCover.jsx'
import BookDetails from '../components/books/BookDetails.jsx'
import {
  clearOpenLibraryCoverCache,
  GOOGLE_COVER_CARD_WIDTH,
  GOOGLE_COVER_PAGE_WIDTH,
} from '../services/books/coverUtils.js'

function mockOpenLibraryCoverResponse(coverUrl) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      'ISBN:9780306406157': {
        cover: {
          large: coverUrl,
        },
      },
    }),
  })
}

beforeEach(() => {
  clearOpenLibraryCoverCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BookCover cover loading performance', () => {
  it('renders a valid Google cover immediately without waiting for Open Library metadata', async () => {
    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BookCover
        title="A Brief History of Time"
        cover="https://books.google.com/books/content?id=book&printsec=frontcover&img=1"
        isbn="9780306406157"
        source="google-books"
      />
    )

    expect(
      screen.getByRole('img', {
        name: 'Couverture de A Brief History of Time',
      })
    ).toHaveAttribute(
      'src',
      `https://books.google.com/books/content?id=book&printsec=frontcover&img=1&w=${GOOGLE_COVER_CARD_WIDTH}`
    )

    await Promise.resolve()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not replace a valid Google cover with an arbitrary Open Library cover', async () => {
    const fetchMock = mockOpenLibraryCoverResponse(
      'https://covers.openlibrary.org/b/id/12345-L.jpg'
    )

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BookCover
        title="Stable Cover"
        cover="https://books.google.com/books/content?id=stable&printsec=frontcover&img=1"
        isbn="9780306406157"
        source="google-books"
      />
    )

    await Promise.resolve()

    const image = screen.getByRole('img', {
      name: 'Couverture de Stable Cover',
    })

    expect(image).toHaveAttribute(
      'src',
      `https://books.google.com/books/content?id=stable&printsec=frontcover&img=1&w=${GOOGLE_COVER_CARD_WIDTH}`
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the card-sized Google source for BookCard covers', () => {
    render(
      <MemoryRouter>
        <BookCard
          bookId="book-1"
          title="Sized Card"
          author="Author"
          cover="https://books.google.com/books/content?id=sized-card&printsec=frontcover&img=1&source=gbs_api"
          isbn="9780306406157"
          source="google-books"
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('img', {
        name: 'Couverture de Sized Card',
      })
    ).toHaveAttribute(
      'src',
      `https://books.google.com/books/content?id=sized-card&printsec=frontcover&img=1&source=gbs_api&w=${GOOGLE_COVER_CARD_WIDTH}`
    )
  })

  it('can still resolve and display an Open Library cover when no Google cover exists', async () => {
    const fetchMock = mockOpenLibraryCoverResponse(
      'https://covers.openlibrary.org/b/id/12345-L.jpg'
    )

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BookCover
        title="Open Library Fallback"
        cover={null}
        isbn="9780306406157"
        source="google-books"
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole('img', {
          name: 'Couverture de Open Library Fallback',
        })
      ).toHaveAttribute(
        'src',
        'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false'
      )
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('can replace a Google cover with Open Library only after the Google image fails', async () => {
    const fetchMock = mockOpenLibraryCoverResponse(
      'https://covers.openlibrary.org/b/id/12345-L.jpg'
    )

    vi.stubGlobal('fetch', fetchMock)

    render(
      <BookCover
        title="Failed Google Cover"
        cover="https://books.google.com/books/content?id=failed&printsec=frontcover&img=1"
        isbn="9780306406157"
        source="google-books"
      />
    )

    fireEvent.error(
      screen.getByRole('img', {
        name: 'Couverture de Failed Google Cover',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('img', {
          name: 'Couverture de Failed Google Cover',
        })
      ).toHaveAttribute(
        'src',
        'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false'
      )
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses lazy loading for normal BookCard covers by default', () => {
    render(
      <MemoryRouter>
        <BookCard
          bookId="book-1"
          title="Lazy Card"
          author="Author"
          cover="https://books.google.com/books/content?id=lazy&printsec=frontcover&img=1"
          isbn="9780306406157"
          source="google-books"
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('img', {
        name: 'Couverture de Lazy Card',
      })
    ).toHaveAttribute('loading', 'lazy')
  })

  it('adds intrinsic dimensions to lazy BookCard covers', () => {
    render(
      <MemoryRouter>
        <BookCard
          bookId="book-1"
          title="Stable Lazy Ratio"
          author="Author"
          cover="https://books.google.com/books/content?id=ratio&printsec=frontcover&img=1"
          isbn="9780306406157"
          source="google-books"
        />
      </MemoryRouter>
    )

    const image = screen.getByRole('img', {
      name: 'Couverture de Stable Lazy Ratio',
    })

    expect(image).toHaveAttribute('width', '200')
    expect(image).toHaveAttribute('height', '300')
  })

  it('keeps BookPage-style details covers eager', () => {
    render(
      <BookDetails
        book={{
          title: 'Eager Details',
          authors: ['Author'],
          cover:
            'https://books.google.com/books/content?id=eager&printsec=frontcover&img=1',
          isbn: '9780306406157',
          source: 'google-books',
          categories: [],
        }}
        libraryBook={null}
        isSaving={false}
        libraryError=""
        statusOptions={[]}
        onAddToLibrary={() => {}}
        onStatusChange={() => {}}
        onRemoveFromLibrary={() => {}}
      />
    )

    const image = screen.getByRole('img', {
      name: 'Couverture de Eager Details',
    })

    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveAttribute(
      'src',
      `https://books.google.com/books/content?id=eager&printsec=frontcover&img=1&w=${GOOGLE_COVER_PAGE_WIDTH}`
    )
  })

  it('uses the larger Google source for BookPage-style details covers', () => {
    render(
      <BookDetails
        book={{
          title: 'Larger Details',
          authors: ['Author'],
          cover:
            'https://books.google.com/books/content?id=large-details&printsec=frontcover&img=1&source=gbs_api',
          isbn: '9780306406157',
          source: 'google-books',
          categories: [],
        }}
        libraryBook={null}
        isSaving={false}
        libraryError=""
        statusOptions={[]}
        onAddToLibrary={() => {}}
        onStatusChange={() => {}}
        onRemoveFromLibrary={() => {}}
      />
    )

    expect(
      screen.getByRole('img', {
        name: 'Couverture de Larger Details',
      })
    ).toHaveAttribute(
      'src',
      `https://books.google.com/books/content?id=large-details&printsec=frontcover&img=1&source=gbs_api&w=${GOOGLE_COVER_PAGE_WIDTH}`
    )
  })
})
