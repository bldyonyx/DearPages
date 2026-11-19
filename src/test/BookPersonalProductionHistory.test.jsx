import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import i18n from '../i18n/index.js'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'

vi.mock('../config/legacyBookHistory.js', () => ({ productionBookHistoryEnabled: true }))
vi.mock('../services/bookNotesService.js', () => ({
  isBookNotesUiEnabled: true,
  getBookNotesForDisplay: vi.fn(async () => ({
    notes: [{ id: 'new-note', title: 'Nouvelle note', date: '2025-01-01', contentHtml: 'Contenu' }],
    legacy: { status: 'unprocessed', contentHtml: 'Ma note historique' },
    legacyReview: { status: 'unprocessed', contentHtml: 'Mon ancien avis' },
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

it('shows modern entries and original values once, with separate editing and no conversion actions', async () => {
  await i18n.changeLanguage('fr')
  render(<BookPersonalSpace userId="owner" bookId="book" onLibraryBookChange={vi.fn()}
    libraryBook={{ status: 'finished', note: 'Ma note historique', review: 'Mon ancien avis', rating: 4 }} />)

  const note = within(await screen.findByRole('article', { name: 'Ancienne note' }))
  fireEvent.click(note.getByRole('button', { name: /Ancienne note/ }))
  expect(note.getByText('Ma note historique')).toBeVisible()
  expect(note.getByRole('button', { name: 'Modifier' })).toBeEnabled()
  expect(screen.getAllByText('Ma note historique')).toHaveLength(1)
  expect(screen.getByRole('article', { name: 'Mon avis' })).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Nouvelle note' })).toBeInTheDocument()
  expect(screen.getByText('Très bien')).toBeVisible()
  expect(screen.getByRole('button', { name: '4 étoiles' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /Convertir|Copier/ })).not.toBeInTheDocument()
})
