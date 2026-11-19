import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import i18n from '../i18n/index.js'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import { getBookNote, getBookNotesForDisplay, migrateLegacyBookNote, migrateLegacyBookReview } from '../services/bookNotesService.js'

vi.mock('../config/legacyBookHistory.js', () => ({ productionBookHistoryEnabled: true }))
vi.mock('../services/bookNotesService.js', () => ({
  isBookNotesUiEnabled: true,
  getBookNotesForDisplay: vi.fn(async () => ({
    notes: [{ id: 'new-note', title: 'Nouvelle note', date: '2025-01-01', contentHtml: 'Contenu' }],
    legacy: { status: 'unprocessed', contentHtml: '<b>Ma note historique</b>', sourceVersion: 'a'.repeat(64) },
    legacyReview: { status: 'unprocessed', contentHtml: 'Mon ancien avis', sourceVersion: 'b'.repeat(64) },
  })),
  compareBookNotes: vi.fn(),
  createBookNote: vi.fn(), deleteBookNote: vi.fn(), getBookNote: vi.fn(), updateBookNote: vi.fn(), updateBookNotePinned: vi.fn(),
  migrateLegacyBookNote: vi.fn(), migrateLegacyBookReview: vi.fn(),
}))
vi.mock('../services/bookRatingsService.js', () => ({
  isBookRatingsUiEnabled: true,
  getBookRatingsForDisplay: vi.fn(async () => ({
    ratings: [{ id: 'new-rating', value: 5, date: '2025-01-02', impression: 'Très bien' }],
    legacy: { status: 'unprocessed', value: 4 },
  })),
  compareBookRatings: vi.fn(),
  newBookRatingId: vi.fn(), createBookRating: vi.fn(), updateBookRatingEntry: vi.fn(), deleteBookRatingEntry: vi.fn(), migrateLegacyBookRating: vi.fn(),
}))
vi.mock('../services/collectionsService.js', () => ({ getUserCollections: vi.fn(async () => []) }))
vi.mock('../components/collections/modals/BookCollectionsModal.jsx', () => ({ default: () => null }))

it('keeps both historical actions available and converts only the source confirmed with a title and explicit date', async () => {
  await i18n.changeLanguage('fr')
  migrateLegacyBookNote.mockResolvedValueOnce({ outcome: 'copied' })
  getBookNote.mockResolvedValueOnce({
    id: 'legacy-note-v1', title: 'Souvenir de lecture', date: '2024-02-29', contentHtml: '<b>Ma note historique</b>',
  })
  render(<BookPersonalSpace userId="owner" bookId="book" onLibraryBookChange={vi.fn()}
    libraryBook={{ status: 'finished', note: '<b>Ma note historique</b>', review: 'Mon ancien avis', rating: 4 }} />)

  const note = within(await screen.findByRole('article', { name: 'Ancienne note' }))
  fireEvent.click(note.getByRole('button', { name: /Ancienne note/ }))
  expect(note.getByText('Ma note historique')).toBeVisible()
  expect(note.getByRole('button', { name: 'Modifier' })).toBeEnabled()
  expect(screen.getAllByText('Ma note historique')).toHaveLength(1)
  expect(screen.getByRole('article', { name: 'Mon avis' })).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Nouvelle note' })).toBeInTheDocument()
  expect(screen.getByText('Très bien')).toBeVisible()
  expect(screen.getByRole('button', { name: '4 étoiles' })).toHaveAttribute('aria-pressed', 'true')
  const review = within(screen.getByRole('article', { name: 'Mon avis' }))
  fireEvent.click(review.getByRole('button', { name: /Mon avis/ }))
  expect(review.getByRole('button', { name: 'Convertir en note' })).toBeEnabled()
  fireEvent.click(note.getByRole('button', { name: /Ancienne note/ }))
  fireEvent.click(note.getByRole('button', { name: 'Convertir en note' }))
  const dialog = within(screen.getByRole('dialog'))
  const date = dialog.getByLabelText('Date de la note')
  const confirm = dialog.getByRole('button', { name: 'Confirmer la conversion' })
  expect(date).toHaveValue('')
  expect(confirm).toBeDisabled()
  expect(dialog.getByRole('region', { name: 'Contenu de la note' }).querySelector('b')).toHaveTextContent('Ma note historique')
  expect(migrateLegacyBookNote).not.toHaveBeenCalled()
  fireEvent.change(dialog.getByLabelText('Titre (facultatif)'), { target: { value: 'Souvenir de lecture' } })
  fireEvent.change(date, { target: { value: '2024-02-29' } })
  fireEvent.click(confirm)
  await screen.findByRole('article', { name: 'Souvenir de lecture' })
  expect(migrateLegacyBookNote).toHaveBeenCalledWith('owner', 'book', {
    expectedVersion: 'a'.repeat(64), title: 'Souvenir de lecture', date: '2024-02-29',
  })
  expect(migrateLegacyBookReview).not.toHaveBeenCalled()
  expect(screen.queryByRole('article', { name: 'Ancienne note' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Mon avis' })).toBeInTheDocument()
})

it('keeps the historical card when its original formatting cannot be copied', async () => {
  getBookNotesForDisplay.mockResolvedValueOnce({
    notes: [], legacy: { status: 'unprocessed', contentHtml: 'Texte historique', conversionUnavailable: true },
    legacyReview: { status: 'empty' },
  })
  render(<BookPersonalSpace userId="owner" bookId="book" onLibraryBookChange={vi.fn()}
    libraryBook={{ status: 'reading', note: '<a href="/book">Texte historique</a>' }} />)
  const note = within(await screen.findByRole('article', { name: 'Ancienne note' }))
  fireEvent.click(note.getByRole('button', { name: /Ancienne note/ }))
  await waitFor(() => expect(note.getByText(/ne peut pas être convertie/)).toBeVisible())
  expect(note.getByText('Texte historique')).toBeVisible()
  expect(note.queryByRole('button', { name: 'Convertir en note' })).not.toBeInTheDocument()
})
