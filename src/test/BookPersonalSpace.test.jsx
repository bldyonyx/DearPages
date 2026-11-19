import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
vi.mock('../services/bookNotesService.js', () => ({ isBookNotesUiEnabled: false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options?.count ? key + '-' + options.count : key }) }))

function Harness({ initial }) {
  const [book, setBook] = useState(initial)
  return <><BookPersonalSpace userId="user-1" bookId="book-1" libraryBook={book} onLibraryBookChange={setBook} /><output data-testid="book">{JSON.stringify(book)}</output></>
}
beforeEach(() => vi.resetAllMocks())

function openCard(title) {
  const card = within(screen.getByRole('article', { name: title }))
  fireEvent.click(card.getByRole('button', { name: title + ' · bookPage.date.unknown' }))
  return card
}

it.each(['to-read', 'reading', 'finished', 'abandoned'])('shows both historical fields for %s without writing', (status) => {
  render(<Harness initial={{ status, note: 'Saved note', review: 'Saved review' }} />)
  expect(screen.queryByText('Saved note')).not.toBeInTheDocument()
  expect(openCard('bookPage.notes.legacyTitle').getByText('Saved note')).toBeVisible()
  expect(openCard('bookPage.personal.reviewTitle').getByText('Saved review')).toBeVisible()
  expect(screen.queryByText('Saved note')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('button', { name: /starLabel/ })).toHaveLength(status === 'finished' ? 5 : 0)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(updateBookNote).not.toHaveBeenCalled()
  expect(updateBookReview).not.toHaveBeenCalled()
  for (const name of ['bookPage.notes.add', 'bookPage.notes.pin', 'bookPage.ratings.add']) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  }
})

it('puts the rating before notes and preserves both historical fields on a star change', async () => {
  render(<Harness initial={{ status: 'finished', note: 'Saved note', review: 'Saved review', rating: 1 }} />)
  expect(screen.getByText('bookPage.personal.ratingTitle').compareDocumentPosition(screen.getByText('bookPage.personal.notesTitle')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
  expect(openCard('bookPage.notes.legacyTitle').getByText('Saved note')).toBeVisible()
  expect(openCard('bookPage.personal.reviewTitle').getByText('Saved review')).toBeVisible()
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

it.each([
  ['note', 'bookPage.notes.legacyTitle', updateBookNote, updateBookReview],
  ['review', 'bookPage.personal.reviewTitle', updateBookReview, updateBookNote],
])('saves only the historical %s after an explicit edit', async (field, title, write, otherWrite) => {
  render(<Harness initial={{ status: 'finished', note: 'Saved note', review: 'Saved review', rating: 4 }} />)
  const panel = openCard(title)
  fireEvent.click(panel.getByRole('button', { name: 'bookPage.notes.edit' }))
  expect(panel.getByRole('button', { name: 'common.save' })).toBeDisabled()
  fireEvent.input(panel.getByRole('textbox'), { target: { innerHTML: '<b>Edited</b>' } })
  fireEvent.click(panel.getByRole('button', { name: 'common.cancel' }))
  expect(write).not.toHaveBeenCalled()
  fireEvent.click(panel.getByRole('button', { name: 'bookPage.notes.edit' }))
  fireEvent.input(panel.getByRole('textbox'), { target: { innerHTML: '<b>Saved edit</b>' } })
  fireEvent.click(panel.getByRole('button', { name: 'common.save' }))
  await waitFor(() => expect(screen.getByTestId('book')).toHaveTextContent(`"${field}":"<b>Saved edit</b>"`))
  expect(write).toHaveBeenCalledExactlyOnceWith('user-1', 'book-1', '<b>Saved edit</b>')
  expect(otherWrite).not.toHaveBeenCalled()
  expect(updateBookRating).not.toHaveBeenCalled()
})
