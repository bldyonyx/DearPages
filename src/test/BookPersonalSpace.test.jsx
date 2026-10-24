import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options?.count ? `${key}-${options.count}` : key }) }))
vi.mock('../components/books/BookNotesEditor.jsx', () => ({
  default: ({ value, onChange, disabled }) => <textarea aria-label="draft" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />,
}))

function Harness({ initial }) {
  const [book, setBook] = useState(initial)
  return <BookPersonalSpace userId="user-1" bookId="book-1" libraryBook={book} onLibraryBookChange={setBook} />
}

beforeEach(() => vi.resetAllMocks())

describe('personal drafts', () => {
  it.each(['to-read', 'reading', 'finished', 'abandoned'])('keeps current controls and saves the draft for %s', async (status) => {
    render(<Harness initial={{ status, note: 'Saved note', review: 'Saved review' }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New draft' } })
    fireEvent.click(screen.getByText('common.save'))
    const save = ['to-read', 'reading'].includes(status) ? updateBookNote : updateBookReview
    await waitFor(() => expect(save).toHaveBeenCalledWith('user-1', 'book-1', 'New draft'))
    expect(screen.queryAllByRole('button', { name: /starLabel/ })).toHaveLength(status === 'finished' ? 5 : 0)
  })

  it('preserves an unsaved review when a star updates the parent book', async () => {
    render(<Harness initial={{ status: 'finished', review: 'Saved review', rating: 1 }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved review' } })
    fireEvent.click(screen.getByRole('button', { name: 'bookPage.personal.starLabel-4' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled())
    expect(updateBookRating).toHaveBeenCalledWith('user-1', 'book-1', 4)
    expect(screen.getByRole('textbox')).toHaveValue('Unsaved review')
    expect(updateBookReview).not.toHaveBeenCalled()
  })

  it('keeps the draft when the rating save fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateBookRating.mockRejectedValueOnce(new Error('offline'))
    render(<Harness initial={{ status: 'finished', review: 'Saved review', rating: 1 }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved review' } })
    fireEvent.click(screen.getByRole('button', { name: 'bookPage.personal.starLabel-4' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('textbox')).toHaveValue('Unsaved review')
    vi.restoreAllMocks()
  })

  it.each(['to-read', 'finished'])('preserves the %s draft on unrelated note/review/rating prop changes', (status) => {
    const initial = { status, note: 'Saved note', review: 'Saved review', rating: 1 }
    const props = { userId: 'user-1', bookId: 'book-1', onLibraryBookChange: vi.fn() }
    const { rerender } = render(<BookPersonalSpace {...props} libraryBook={initial} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved draft' } })
    const otherField = status === 'to-read' ? 'review' : 'note'
    rerender(<BookPersonalSpace {...props} libraryBook={{ ...initial, [otherField]: 'Other saved field', rating: 5 }} />)
    expect(screen.getByRole('textbox')).toHaveValue('Unsaved draft')
    rerender(<BookPersonalSpace {...props} bookId="book-2" libraryBook={initial} />)
    expect(screen.getByRole('textbox')).toHaveValue(status === 'to-read' ? 'Saved note' : 'Saved review')
  })

  it('does not recreate a deleted parent book when an in-flight save resolves', async () => {
    let resolve
    updateBookReview.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const change = vi.fn()
    render(<BookPersonalSpace userId="user-1" bookId="book-1" libraryBook={{ status: 'finished' }} onLibraryBookChange={change} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByText('common.save'))
    resolve()
    await waitFor(() => expect(change).toHaveBeenCalled())
    expect(change.mock.calls[0][0](null)).toBeNull()
  })
})
