import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import { updateBookNote, updateBookReview, updateBookRating } from '../services/libraryService.js'

vi.mock('../services/libraryService.js', () => ({
  BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' },
  updateBookNote: vi.fn(), updateBookReview: vi.fn(), updateBookRating: vi.fn(),
  updateBookFinishedAt: vi.fn(), updateBookAbandonedAt: vi.fn(),
}))
vi.mock('../services/collectionsService.js', () => ({ getUserCollections: vi.fn(async () => []) }))
vi.mock('../components/collections/modals/BookCollectionsModal.jsx', () => ({ default: () => null }))
vi.mock('../components/books/BookFinalStatusDate.jsx', () => ({ default: () => null }))
vi.mock('../components/books/BookNotesSection.jsx', () => ({
  default: ({ historicalReview }) => <section data-testid="notes">Multiple notes<output>{historicalReview}</output></section>,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options?.count ? key + '-' + options.count : key }) }))

function Harness({ initial }) {
  const [book, setBook] = useState(initial)
  return <><BookPersonalSpace userId="user-1" bookId="book-1" libraryBook={book} onLibraryBookChange={setBook} /><output data-testid="book">{JSON.stringify(book)}</output></>
}
beforeEach(() => vi.resetAllMocks())

it.each(['to-read', 'reading', 'finished', 'abandoned'])('shows notes for %s with the existing rating visibility and no review editor', (status) => {
  render(<Harness initial={{ status, note: 'Saved note', review: 'Saved review' }} />)
  expect(screen.getByTestId('notes')).toHaveTextContent('Saved review')
  expect(screen.queryAllByRole('button', { name: /starLabel/ })).toHaveLength(status === 'finished' ? 5 : 0)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText('bookPage.personal.reviewTitle')).not.toBeInTheDocument()
  expect(updateBookNote).not.toHaveBeenCalled()
  expect(updateBookReview).not.toHaveBeenCalled()
})

it('puts the rating before notes and preserves both historical fields on a star change', async () => {
  render(<Harness initial={{ status: 'finished', note: 'Saved note', review: 'Saved review', rating: 1 }} />)
  expect(screen.getByText('bookPage.personal.ratingTitle').compareDocumentPosition(screen.getByTestId('notes')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'bookPage.personal.starLabel-4' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent('"rating":4'))
  expect(updateBookRating).toHaveBeenCalledWith('user-1', 'book-1', 4)
  expect(screen.getByTestId('book')).toHaveTextContent('"note":"Saved note"')
  expect(screen.getByTestId('book')).toHaveTextContent('"review":"Saved review"')
  expect(updateBookNote).not.toHaveBeenCalled()
  expect(updateBookReview).not.toHaveBeenCalled()
})

it('shows a rating failure without altering historical data', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  updateBookRating.mockRejectedValueOnce(new Error('offline'))
  render(<Harness initial={{ status: 'finished', review: 'Saved review', note: 'Saved note', rating: 1 }} />)
  fireEvent.click(screen.getByRole('button', { name: 'bookPage.personal.starLabel-4' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('bookPage.personal.ratingSaveError'))
  expect(screen.getByTestId('book')).toHaveTextContent('"rating":1')
  expect(screen.getByTestId('notes')).toHaveTextContent('Saved review')
  vi.restoreAllMocks()
})

it('does not recreate a removed book when an in-flight rating save resolves', async () => {
  let resolve
  updateBookRating.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const change = vi.fn()
  render(<BookPersonalSpace userId="user-1" bookId="book-1" libraryBook={{ status: 'finished' }} onLibraryBookChange={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'bookPage.personal.starLabel-4' }))
  resolve()
  await waitFor(() => expect(change).toHaveBeenCalled())
  expect(change.mock.calls[0][0](null)).toBeNull()
})
