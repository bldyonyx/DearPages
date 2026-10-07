import {
  act,
  fireEvent,
  render,
  screen,
  within,
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

import CurrentlyReading from '../components/dashboard/CurrentlyReading.jsx'

vi.mock('../components/books/BookCover.jsx', () => ({
  default: ({ title }) => (
    <div>{`Couverture test ${title}`}</div>
  ),
}))

const baseBooks = Array.from({ length: 5 }, (_, index) => ({
  googleBooksId: `book-${index + 1}`,
  title: `Livre ${index + 1}`,
  authors: [`Auteur ${index + 1}`],
  cover: null,
  isbn: null,
  source: 'google-books',
  status: 'reading',
}))

function mockReducedMotion(matches = false) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}

function renderCurrentlyReading(books = baseBooks) {
  return render(
    <MemoryRouter>
      <CurrentlyReading
        books={books}
        updatingBookId={null}
        onStatusChange={vi.fn()}
      />
    </MemoryRouter>
  )
}

function stackButtons() {
  return screen.getAllByTestId('current-reading-cover')
}

function activeStackButton() {
  return stackButtons().find(
    (button) => button.dataset.active === 'true'
  )
}

function expectActiveBook(title, bookId) {
  expect(
    screen.getByRole('heading', { name: title })
  ).toBeInTheDocument()

  expect(activeStackButton()).toHaveAttribute(
    'data-book-id',
    bookId
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  mockReducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CurrentlyReading', () => {
  it('gives the active book the front stack position and highest z-index', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    const [frontCover, secondCover, thirdCover] = stackButtons()

    expect(frontCover).toHaveAttribute('data-active', 'true')
    expect(frontCover).toHaveAttribute('data-stack-position', '0')
    expect(frontCover).toHaveStyle({ zIndex: '3' })

    expect(secondCover).toHaveAttribute('data-active', 'false')
    expect(secondCover).toHaveStyle({ zIndex: '2' })

    expect(thirdCover).toHaveAttribute('data-active', 'false')
    expect(thirdCover).toHaveStyle({ zIndex: '1' })
  })

  it('renders a maximum of 3 visible covers', () => {
    renderCurrentlyReading(baseBooks)

    expect(stackButtons()).toHaveLength(3)
    expect(
      screen.queryByText('Couverture test Livre 4')
    ).not.toBeInTheDocument()
  })

  it('does not create an automatic rotation timer for 1 book', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    renderCurrentlyReading(baseBooks.slice(0, 1))

    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', {
        name: 'Lecture suivante',
      })
    ).not.toBeInTheDocument()
  })

  it('automatically rotates to the next book after 5 seconds', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expectActiveBook('Livre 2', 'book-2')
  })

  it('wraps automatic rotation from the last book to the first', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    act(() => {
      vi.advanceTimersByTime(15000)
    })

    expectActiveBook('Livre 1', 'book-1')
  })

  it('advances the 3-book visible window when there are more than 3 books', () => {
    renderCurrentlyReading(baseBooks)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )

    expect(
      stackButtons().map((button) => button.dataset.bookId)
    ).toEqual(['book-2', 'book-3', 'book-4'])
  })

  it('navigates to the next book and wraps from the last to the first', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )
    expectActiveBook('Livre 2', 'book-2')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )

    expectActiveBook('Livre 1', 'book-1')
  })

  it('navigates to the previous book and wraps from the first to the last', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture précédente',
      })
    )

    expectActiveBook('Livre 3', 'book-3')
    expect(
      stackButtons().map((button) => button.dataset.bookId)
    ).toEqual(['book-3', 'book-1', 'book-2'])
  })

  it('makes every current read reachable when more than 3 books exist', () => {
    renderCurrentlyReading(baseBooks)

    for (const expectedBook of baseBooks.slice(1)) {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Lecture suivante',
        })
      )

      expectActiveBook(
        expectedBook.title,
        expectedBook.googleBooksId
      )
    }
  })

  it('updates the active/front book from direct stack navigation', () => {
    renderCurrentlyReading(baseBooks)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Afficher Livre 3',
      })
    )

    expectActiveBook('Livre 3', 'book-3')
  })

  it('resets automatic rotation timing after manual navigation', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )

    act(() => {
      vi.advanceTimersByTime(4999)
    })

    expectActiveBook('Livre 2', 'book-2')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expectActiveBook('Livre 3', 'book-3')
  })

  it('preserves the selected book page link', () => {
    renderCurrentlyReading(baseBooks.slice(0, 3))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lecture suivante',
      })
    )

    const detailsLink = screen.getByRole('link', {
      name: 'Voir la fiche',
    })

    expect(detailsLink).toHaveAttribute(
      'href',
      '/books/book-2'
    )
  })

  it('keeps manual navigation available without auto-rotation when reduced motion is enabled', () => {
    mockReducedMotion(true)
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    renderCurrentlyReading(baseBooks.slice(0, 3))

    expect(setIntervalSpy).not.toHaveBeenCalled()

    fireEvent.click(
      within(screen.getByText('Livre 1').closest('section'))
        .getByRole('button', {
          name: 'Lecture suivante',
        })
    )

    expectActiveBook('Livre 2', 'book-2')
  })
})
