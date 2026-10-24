import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n/index.js'
import BookNotesSection from '../components/books/BookNotesSection.jsx'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import * as service from '../services/bookNotesService.js'
import * as library from '../services/libraryService.js'

const fixture = vi.hoisted(() => ({ enabled: true, notes: [], legacy: { status: 'empty' }, legacyReview: { status: 'empty' } }))
vi.mock('../services/bookNotesService.js', () => ({
  get isBookNotesUiEnabled() { return fixture.enabled },
  compareBookNotes: (a, b) => Number(b.isPinned === true) - Number(a.isPinned === true) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  updateBookNotePinned: vi.fn(), getBookNotesForDisplay: vi.fn(), getBookNote: vi.fn(), createBookNote: vi.fn(), updateBookNote: vi.fn(), deleteBookNote: vi.fn(), migrateLegacyBookNote: vi.fn(), migrateLegacyBookReview: vi.fn(),
}))
vi.mock('../services/libraryService.js', () => ({
  BOOK_STATUSES: { TO_READ: 'to-read', READING: 'reading', FINISHED: 'finished', ABANDONED: 'abandoned' },
  updateBookNote: vi.fn(), updateBookReview: vi.fn(), updateBookRating: vi.fn(), updateBookFinishedAt: vi.fn(), updateBookAbandonedAt: vi.fn(),
}))
vi.mock('../services/collectionsService.js', () => ({ getUserCollections: vi.fn(async () => []) }))
vi.mock('../components/collections/modals/BookCollectionsModal.jsx', () => ({ default: () => null }))
vi.mock('../components/books/BookFinalStatusDate.jsx', () => ({ default: () => null }))

const note = (id, title = 'Première pensée') => ({ id, title, date: '2026-10-20', contentHtml: `<b>Contenu ${id}</b>`, createdAt: 100 })
const change = (input, value) => fireEvent.change(input, { target: { value } })
const content = (root, html) => fireEvent.input(within(root).getByRole('textbox', { name: 'Contenu de la note' }), { target: { innerHTML: html } })
const addButton = () => screen.getByRole('button', { name: 'Ajouter une note' })
const card = (title = 'Première pensée') => screen.getByRole('article', { name: title })
function expand(root) { const trigger = root.querySelector('h4 > button'); if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger) }
function clickCard(name, title) { const root = card(title); expand(root); fireEvent.click(within(root).getByRole('button', { name })) }
function selectDate(root, date) {
  fireEvent.click(within(root).getByLabelText('Date de la note'))
  const dialog = screen.getByRole('dialog')
  const [year, month, day] = date.split('-').map(Number)
  change(within(dialog).getByRole('spinbutton', { name: 'Année' }), String(year))
  change(within(dialog).getByRole('combobox', { name: 'Mois' }), String(month))
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  fireEvent.click(within(dialog).getByRole('button', { name: day + ' ' + months[month - 1] + ' ' + year }))
}
const pending = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
async function open() {
  await waitFor(() => expect(addButton()).toBeEnabled())
  fireEvent.click(addButton())
  return screen.getByRole('textbox', { name: 'Titre (facultatif)' }).closest('form')
}
beforeEach(async () => {
  vi.resetAllMocks()
  fixture.enabled = true; fixture.notes = []; fixture.legacy = { status: 'empty' }; fixture.legacyReview = { status: 'empty' }
  service.getBookNotesForDisplay.mockImplementation(async () => ({ notes: structuredClone(fixture.notes), legacy: { sourceVersion: 'a'.repeat(64), ...structuredClone(fixture.legacy) }, legacyReview: { sourceVersion: 'b'.repeat(64), ...structuredClone(fixture.legacyReview) } }))
  service.createBookNote.mockResolvedValue('created')
  service.migrateLegacyBookNote.mockResolvedValue({ outcome: 'copied' })
  service.migrateLegacyBookReview.mockResolvedValue({ outcome: 'copied' })
  await i18n.changeLanguage('fr')
})
afterEach(() => vi.useRealTimers())

describe('multiple notes UI', () => {
  it('loads an empty list without calling the migration', async () => {
    render(<BookNotesSection userId="user" bookId="book" />)
    expect(screen.getByRole('status')).toHaveTextContent('Chargement')
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.getByText(/Tes prochaines pensées/)).toBeInTheDocument()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookReview).not.toHaveBeenCalled()
  })

  it('shows several independently editable notes with safe rich text and dates', async () => {
    fixture.notes = [note('a'), { ...note('b', ''), contentHtml: '<i>Italique</i><img src=x onerror=bad()><script>bad()</script>' }]
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expand(card())
    expect(card().querySelector('b')).toHaveTextContent('Contenu a')
    expand(card('Note sans titre'))
    expect(card('Note sans titre').querySelector('i')).toHaveTextContent('Italique')
    expect(document.querySelector('article img, article script')).toBeNull()
    expect(card().querySelector('time')).toHaveAttribute('datetime', '2026-10-20')
  })

  it.each(['', 'Un souvenir'])('creates with optional title "%s" and initializes today’s civil date', async (title) => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 24, 12))
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    expect(within(form).getByLabelText('Date de la note')).toHaveTextContent('24 octobre 2026')
    expect(within(form).getByLabelText('Titre (facultatif)')).not.toBeRequired()
    change(within(form).getByLabelText('Titre (facultatif)'), title)
    content(form, '<b>Nouvelle pensée</b>')
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(service.createBookNote).toHaveBeenCalledWith('user', 'book', { title, contentHtml: '<b>Nouvelle pensée</b>', date: '2026-10-24' }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Contenu de la note' })).not.toBeInTheDocument())
    expand(card(title || 'Note sans titre'))
    expect(card(title || 'Note sans titre')).toHaveTextContent('Nouvelle pensée')
  })

  it('creates with a manually selected date', async () => {
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    selectDate(form, '2024-02-29')
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(service.createBookNote).toHaveBeenCalledWith('user', 'book', expect.objectContaining({ date: '2024-02-29' })))
  })

  it('edits only one note, including its date, and keeps another draft', async () => {
    fixture.notes = [note('a'), note('b', 'Deuxième pensée')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    clickCard('Modifier', 'Deuxième pensée')
    content(card('Deuxième pensée'), '<i>Brouillon B</i>')
    clickCard('Modifier')
    change(within(card()).getByLabelText('Titre (facultatif)'), '')
    selectDate(card(), '2025-01-01')
    content(card(), '<b>Modification A</b>')
    clickCard('Enregistrer')
    await waitFor(() => expect(service.updateBookNote).toHaveBeenCalledWith('user', 'book', 'a', { title: '', date: '2025-01-01', contentHtml: '<b>Modification A</b>' }))
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Deuxième pensée')
    expand(card('Deuxième pensée'))
    expect(within(card('Deuxième pensée')).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Brouillon B')
    expect(service.createBookNote).not.toHaveBeenCalled()
  })

  it('closes and resumes an unsaved new draft without a write', async () => {
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    change(within(form).getByLabelText('Titre (facultatif)'), 'Brouillon')
    content(form, '<i>À garder</i>')
    fireEvent.click(within(form).getByRole('button', { name: 'Annuler' }))
    const resumed = await open()
    expect(within(resumed).getByLabelText('Titre (facultatif)')).toHaveValue('Brouillon')
    expect(within(resumed).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('À garder')
    expect(service.createBookNote).not.toHaveBeenCalled()
  })

  it('cancels an edit and deletion without losing its draft', async () => {
    fixture.notes = [note('a')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    clickCard('Modifier')
    content(card(), '<b>Brouillon</b>')
    clickCard('Annuler')
    clickCard('Supprimer')
    expect(service.deleteBookNote).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    clickCard('Modifier')
    expand(card())
    expect(within(card()).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Brouillon')
    expect(service.updateBookNote).not.toHaveBeenCalled()
    expect(service.deleteBookNote).not.toHaveBeenCalled()
  })

  it('deletes only after confirmation, preserves other notes and never resurrects the historical source', async () => {
    fixture.notes = [note('legacy-note-v1'), note('b', 'À garder')]
    fixture.legacy = { status: 'processed', sourceHtml: '<b>RAW_MARKER_MUST_NOT_RENDER</b>' }
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.queryByText(/RAW_MARKER/)).not.toBeInTheDocument()
    clickCard('Supprimer')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Première pensée' })).not.toBeInTheDocument())
    expect(service.deleteBookNote).toHaveBeenCalledWith('user', 'book', 'legacy-note-v1')
    expect(card('À garder')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Ancienne note' })).not.toBeInTheDocument()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
  })

  it('keeps a failed save draft and allows an independent note to save', async () => {
    fixture.notes = [note('a'), note('b', 'Deuxième pensée')]
    service.updateBookNote.mockRejectedValueOnce(new Error('offline'))
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    clickCard('Modifier')
    content(card(), '<b>Non enregistré</b>')
    clickCard('Enregistrer')
    await waitFor(() => expect(within(card()).getByRole('alert')).toHaveTextContent('brouillon est conservé'))
    clickCard('Modifier', 'Deuxième pensée')
    clickCard('Enregistrer', 'Deuxième pensée')
    await waitFor(() => expect(service.updateBookNote).toHaveBeenCalledTimes(2))
    expand(card())
    expect(within(card()).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Non enregistré')
  })

  it('keeps a failed creation and a failed deletion available for retry', async () => {
    fixture.notes = [note('a')]
    service.createBookNote.mockRejectedValueOnce(new Error('offline'))
    service.deleteBookNote.mockRejectedValueOnce(new Error('offline'))
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    content(form, '<i>Création conservée</i>')
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(within(form).getByRole('alert')).toBeInTheDocument())
    clickCard('Supprimer')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Impossible de supprimer'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    const resumed = await open()
    expect(within(resumed).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Création conservée')
    expect(card()).toBeInTheDocument()
  })

  it('locks only the pending operation and prevents repeated submission', async () => {
    const deferred = pending()
    service.createBookNote.mockReturnValueOnce(deferred.promise)
    fixture.notes = [note('a')]
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(within(form).getByRole('button', { name: 'Enregistrement...' })).toBeDisabled()
    fireEvent.submit(form)
    expect(service.createBookNote).toHaveBeenCalledTimes(1)
    expand(card())
    expect(within(card()).getByRole('button', { name: 'Modifier' })).toBeEnabled()
    await act(async () => deferred.resolve('created'))
  })

  it('fails closed on load failure and can retry', async () => {
    service.getBookNotesForDisplay.mockRejectedValueOnce(new Error('permission denied'))
    render(<BookNotesSection userId="user" bookId="book" />)
    await screen.findByRole('alert')
    expect(addButton()).toBeDisabled()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(addButton()).toBeEnabled())
  })

  it('shows a sanitized historical note only in read-only form without a marker', async () => {
    fixture.legacy = { status: 'unprocessed', contentHtml: '<b>Ancien texte</b><script>bad()</script>' }
    render(<BookNotesSection userId="user" bookId="book" />)
    const historical = await screen.findByRole('article', { name: 'Ancienne note' })
    expand(historical)
    expect(historical).toHaveTextContent('lecture seule')
    expect(historical.querySelector('b')).toHaveTextContent('Ancien texte')
    expect(historical.querySelector('script')).toBeNull()
    expect(within(historical).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
  })

  it.each(['invalid', 'conflict'])('shows explicit historical %s without automatic writes', async (status) => {
    fixture.legacy = { status }
    if (status === 'conflict') fixture.notes = [note('legacy-note-v1')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('article', { name: 'Ancienne note' })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(status === 'conflict' ? 1 : 0)
    if (status === 'conflict') expect(within(card()).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
    expect(service.updateBookNote).not.toHaveBeenCalled()
  })

  it('never falls back to the source once a marker has been observed, even after refreshing', async () => {
    fixture.legacy = { status: 'processed' }
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    fixture.legacy = { status: 'unprocessed', contentHtml: '<b>Should stay hidden</b>' }
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() => expect(service.getBookNotesForDisplay).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.queryByText('Should stay hidden')).not.toBeInTheDocument()
  })

  it('does not access Firebase when this UI is disabled outside the emulator', () => {
    fixture.enabled = false
    render(<BookNotesSection userId="user" bookId="book" />)
    expect(screen.getByText(/environnement local de test/)).toBeInTheDocument()
    expect(service.getBookNotesForDisplay).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument()
  })

  it('ignores a late response from a previous book and resets its drafts on navigation', async () => {
    const deferred = pending()
    service.getBookNotesForDisplay.mockReturnValueOnce(deferred.promise)
    const { rerender } = render(<BookNotesSection key="a" userId="user" bookId="a" />)
    await waitFor(() => expect(service.getBookNotesForDisplay).toHaveBeenCalledWith('user', 'a'))
    fixture.notes = [note('b', 'Nouveau livre')]
    rerender(<BookNotesSection key="b" userId="user" bookId="b" />)
    await screen.findByRole('article', { name: 'Nouveau livre' })
    await act(async () => deferred.resolve({ notes: [note('a', 'Ancien livre')], legacy: { status: 'empty' } }))
    expect(screen.queryByRole('article', { name: 'Ancien livre' })).not.toBeInTheDocument()
  })
})

describe('compact accordion and historical reviews', () => {
  it('starts closed, opens only one note, closes on a second click and retains its editor draft', async () => {
    fixture.notes = [note('a'), note('b', 'Deuxième pensée')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.queryByText('Contenu a')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    const first = card().querySelector('h4 > button')
    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(within(card()).getByRole('region')).toBeVisible()
    clickCard('Modifier')
    content(card(), '<b>À reprendre</b>')
    expand(card('Deuxième pensée'))
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Contenu de la note' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
    expand(card())
    expect(within(card()).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('À reprendre')
    fireEvent.click(first)
    expect(within(card()).queryByRole('region')).not.toBeInTheDocument()
    expect(service.updateBookNote).not.toHaveBeenCalled()
  })

  it('removes an open calendar when its note is collapsed and keeps its civil date draft', async () => {
    fixture.notes = [note('a'), note('b', 'Deuxième pensée')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    clickCard('Modifier')
    selectDate(card(), '1900-01-01')
    fireEvent.click(within(card()).getByLabelText('Date de la note'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expand(card('Deuxième pensée'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expand(card())
    expect(within(card()).getByLabelText('Date de la note')).toHaveTextContent('1 janvier 1900')
    expect(service.updateBookNote).not.toHaveBeenCalled()
  })

  it('preserves a safe historical review in exactly one read-only card without a migration', async () => {
    fixture.legacyReview = { status: 'unprocessed', contentHtml: '<b>Avis conservé</b><script>bad()</script><img src=x onerror=bad()>' }
    render(<BookNotesSection userId="user" bookId="book" historicalReview={'<b>Avis conservé</b><script>bad()</script><img src=x onerror=bad()>'} />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    const review = card('Ancien avis')
    expand(review)
    expect(review).toHaveTextContent('lecture seule')
    expect(review.querySelector('b')).toHaveTextContent('Avis conservé')
    expect(review.querySelector('script, img')).toBeNull()
    expect(within(review).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(within(review).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Avis conservé')).toHaveLength(1)
    expect(library.updateBookReview).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
  })

  it('combines identical read-only historical note/review sources without creating a note', async () => {
    fixture.legacy = { status: 'unprocessed', contentHtml: '<b>Même texte</b>' }
    fixture.legacyReview = { status: 'unprocessed', contentHtml: '<b>Même texte</b>' }
    render(<BookNotesSection userId="user" bookId="book" historicalReview="<b>Même texte</b>" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    const combined = card('Ancienne note et ancien avis')
    expand(combined)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getAllByText('Même texte')).toHaveLength(1)
    expect(service.createBookNote).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
  })

  it('preserves review compatibility when a processed legacy note is absent, including outside the emulator', () => {
    fixture.enabled = false
    render(<BookNotesSection userId="user" bookId="book" historicalReview="<i>Avis intact</i>" />)
    expand(card('Ancien avis'))
    expect(screen.getByText('Avis intact')).toBeInTheDocument()
    expect(service.getBookNotesForDisplay).not.toHaveBeenCalled()
    expect(library.updateBookReview).not.toHaveBeenCalled()
  })

  it('signals an invalid review without unsafe coercion or writes', () => {
    fixture.enabled = false
    render(<BookNotesSection userId="user" bookId="book" historicalReview={{ html: '<script>bad()</script>' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('ancien avis a un format invalide')
    expect(screen.queryByRole('article', { name: 'Ancien avis' })).not.toBeInTheDocument()
    expect(library.updateBookReview).not.toHaveBeenCalled()
  })
})

describe('manual confirmed historical conversions', () => {
  function historical(kind) {
    fixture[kind === 'note' ? 'legacy' : 'legacyReview'] = { status: 'unprocessed', contentHtml: '<b>Texte historique</b>' }
  }
  function converted(kind) {
    return { id: kind === 'note' ? 'legacy-note-v1' : 'legacy-review-v1', title: kind === 'note' ? '' : 'Mon avis sur le livre', date: '2026-10-24', contentHtml: '<b>Texte historique</b>', createdAt: 10 }
  }
  function request(kind) {
    const root = card(kind === 'note' ? 'Ancienne note' : 'Ancien avis')
    expand(root)
    fireEvent.click(within(root).getByRole('button', { name: kind === 'note' ? 'Convertir l’ancienne note' : 'Convertir l’ancien avis' }))
    return screen.getByRole('dialog')
  }
  function confirm() { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmer la conversion' })) }

  it.each(['note', 'review'])('converts %s only after confirmation, then allows ordinary editing and deletion without fallback', async (kind) => {
    historical(kind)
    service.getBookNote.mockResolvedValue(converted(kind))
    const method = kind === 'note' ? service.migrateLegacyBookNote : service.migrateLegacyBookReview
    render(<BookNotesSection userId="user" bookId="book" historicalReview="STALE_PROP_MUST_STAY_HIDDEN" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookReview).not.toHaveBeenCalled()
    const dialog = request(kind)
    expect(method).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent('date technique de conversion')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(method).not.toHaveBeenCalled()
    request(kind); confirm()
    const title = kind === 'note' ? 'Note sans titre' : 'Mon avis sur le livre'
    await screen.findByRole('article', { name: title })
    expect(method).toHaveBeenCalledWith('user', 'book', kind === 'note' ? { expectedVersion: 'a'.repeat(64) } : { expectedVersion: 'b'.repeat(64), title: 'Mon avis sur le livre' })
    expect(screen.queryByRole('article', { name: kind === 'note' ? 'Ancienne note' : 'Ancien avis' })).not.toBeInTheDocument()
    expect(screen.queryByText('STALE_PROP_MUST_STAY_HIDDEN')).not.toBeInTheDocument()
    clickCard('Modifier', title)
    change(within(card(title)).getByLabelText('Titre (facultatif)'), 'Renommée')
    selectDate(card(title), '1900-01-01')
    content(card(title), '<i>Texte modifié</i>')
    clickCard('Enregistrer', title)
    await screen.findByRole('article', { name: 'Renommée' })
    expect(service.updateBookNote).toHaveBeenCalledWith('user', 'book', converted(kind).id, { title: 'Renommée', date: '1900-01-01', contentHtml: '<i>Texte modifié</i>' })
    clickCard('Supprimer', 'Renommée')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Renommée' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() => expect(service.getBookNotesForDisplay).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(addButton()).toBeEnabled())
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(method).toHaveBeenCalledTimes(1)
    expect(library.updateBookReview).not.toHaveBeenCalled()
    expect(library.updateBookNote).not.toHaveBeenCalled()
    expect(library.updateBookRating).not.toHaveBeenCalled()
  })

  it.each(['book-notes/legacy-source-changed', 'book-notes/legacy-conflict'])('reports %s and requires a refreshed confirmation', async (code) => {
    historical('review')
    service.migrateLegacyBookReview.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { code }))
    service.getBookNote.mockResolvedValue(converted('review'))
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('source a changé'))
    expect(service.getBookNote).not.toHaveBeenCalled()
    expect(card('Ancien avis')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    fixture.legacyReview.sourceVersion = 'c'.repeat(64)
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() => expect(service.getBookNotesForDisplay).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    await screen.findByRole('article', { name: 'Mon avis sur le livre' })
    expect(service.migrateLegacyBookReview).toHaveBeenLastCalledWith('user', 'book', { expectedVersion: 'c'.repeat(64), title: 'Mon avis sur le livre' })
  })

  it('keeps pending conversion locked without changing the parent book or historical metadata', async () => {
    historical('review')
    const deferred = pending()
    service.migrateLegacyBookReview.mockReturnValueOnce(deferred.promise)
    service.getBookNote.mockResolvedValue(converted('review'))
    const book = Object.freeze({ status: 'finished', rating: 4, review: 'Historical review', note: 'Historical note', updatedAt: 123, addedAt: 7 })
    const changed = vi.fn()
    render(<BookPersonalSpace userId="user" bookId="book" libraryBook={book} onLibraryBookChange={changed} />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Conversion…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Annuler' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(dialog).toBeInTheDocument()
    expect(service.migrateLegacyBookReview).toHaveBeenCalledTimes(1)
    await act(async () => deferred.resolve({ outcome: 'copied' }))
    await screen.findByRole('article', { name: 'Mon avis sur le livre' })
    expect(changed).not.toHaveBeenCalled()
    expect(book).toMatchObject({ rating: 4, review: 'Historical review', note: 'Historical note', updatedAt: 123, status: 'finished', addedAt: 7 })
  })

  it('preserves existing and new drafts while converting an independent historical source', async () => {
    historical('review'); fixture.notes = [note('a')]
    service.getBookNote.mockResolvedValue(converted('review'))
    render(<BookNotesSection userId="user" bookId="book" />)
    const form = await open()
    content(form, '<i>Nouveau brouillon</i>')
    fireEvent.click(within(form).getByRole('button', { name: 'Annuler' }))
    clickCard('Modifier'); content(card(), '<b>Brouillon existant</b>')
    request('review'); confirm()
    await screen.findByRole('article', { name: 'Mon avis sur le livre' })
    expand(card())
    expect(within(card()).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Brouillon existant')
    const resumed = await open()
    expect(within(resumed).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Nouveau brouillon')
    expect(service.createBookNote).not.toHaveBeenCalled()
    expect(service.updateBookNote).not.toHaveBeenCalled()
  })

  it('merges the converted card without replacing an independent in-flight edit', async () => {
    historical('review'); fixture.notes = [note('a')]
    const deferred = pending()
    service.getBookNote.mockReturnValueOnce(deferred.promise)
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    await waitFor(() => expect(service.getBookNote).toHaveBeenCalled())
    // Independent programmatic interaction while the read awaits its server result.
    clickCard('Modifier'); content(card(), '<b>Édition indépendante</b>'); clickCard('Enregistrer')
    await waitFor(() => expect(service.updateBookNote).toHaveBeenCalled())
    await act(async () => deferred.resolve(converted('review')))
    expand(card())
    expect(card()).toHaveTextContent('Édition indépendante')
    expect(card('Mon avis sur le livre')).toBeInTheDocument()
  })

  it('recovers a lost acknowledgement without recreating an already deleted converted review', async () => {
    historical('review')
    service.migrateLegacyBookReview.mockRejectedValueOnce(new Error('lost acknowledgement'))
    service.getBookNote.mockResolvedValue(null)
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('n’a pas pu être confirmée'))
    confirm()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(service.createBookNote).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookReview).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('ne sera pas recréée')
  })

  it('treats a post-acknowledgement read failure as a saved conversion and offers refresh without fallback', async () => {
    historical('review')
    service.getBookNote.mockRejectedValueOnce(new Error('read offline'))
    render(<BookNotesSection userId="user" bookId="book" historicalReview="Historical prop" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    request('review'); confirm()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Conversion enregistrée')
    expect(screen.queryByRole('article', { name: 'Ancien avis' })).not.toBeInTheDocument()
    fixture.notes = [converted('review')]
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
    await screen.findByRole('article', { name: 'Mon avis sur le livre' })
    expect(service.migrateLegacyBookReview).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Historical prop')).not.toBeInTheDocument()
  })

  it('keeps note and review conversions independent even when read-only contents are identical', async () => {
    historical('note'); historical('review')
    service.getBookNote.mockResolvedValue(converted('review'))
    render(<BookNotesSection userId="user" bookId="book" />)
    await waitFor(() => expect(addButton()).toBeEnabled())
    expand(card('Ancienne note et ancien avis'))
    fireEvent.click(screen.getByRole('button', { name: 'Convertir l’ancien avis' })); confirm()
    await screen.findByRole('article', { name: 'Mon avis sur le livre' })
    expect(card('Ancienne note')).toBeInTheDocument()
    expect(service.migrateLegacyBookNote).not.toHaveBeenCalled()
    expect(service.migrateLegacyBookReview).toHaveBeenCalledTimes(1)
  })

  it.each(['invalid', 'conflict'])('does not convert a review in %s state', async (status) => {
    fixture.legacyReview = { status }
    if (status === 'conflict') fixture.notes = [converted('review')]
    render(<BookNotesSection userId="user" bookId="book" />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Convertir l’ancien avis' })).not.toBeInTheDocument()
    if (status === 'conflict') {
      expand(card('Mon avis sur le livre'))
      expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    }
    expect(service.migrateLegacyBookReview).not.toHaveBeenCalled()
  })
})

describe('independence from book ratings and reviews', () => {
  function Harness({ changed }) {
    const [book, setBook] = useState({ status: 'finished', rating: 1, review: 'Avis enregistré', note: 'Historique', updatedAt: 123 })
    return <><BookPersonalSpace userId="user" bookId="book" libraryBook={book} onLibraryBookChange={(next) => { changed(next); setBook(next) }} /><output data-testid="book">{JSON.stringify(book)}</output></>
  }
  it('keeps the note draft and historical review when a star is saved', async () => {
    const changed = vi.fn()
    render(<Harness changed={changed} />)
    const form = await open()
    content(form, '<b>Brouillon indépendant</b>')
    expect(screen.queryByRole('textbox', { name: /Écris quelque chose/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '4 étoiles' }))
    await waitFor(() => expect(library.updateBookRating).toHaveBeenCalledWith('user', 'book', 4))
    expect(within(form).getByRole('textbox', { name: 'Contenu de la note' })).toHaveTextContent('Brouillon indépendant')
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(card('Note sans titre')).toBeInTheDocument())
    expect(changed).toHaveBeenCalledTimes(1)
    expect(library.updateBookReview).not.toHaveBeenCalled()
    expect(library.updateBookNote).not.toHaveBeenCalled()
    expect(screen.getByTestId('book')).toHaveTextContent('"review":"Avis enregistré"')
  })

  it('creates, edits and deletes without any library callback or mutation', async () => {
    const changed = vi.fn()
    render(<Harness changed={changed} />)
    const before = screen.getByTestId('book').textContent
    const form = await open()
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(card('Note sans titre')).toBeInTheDocument())
    clickCard('Modifier', 'Note sans titre')
    content(card('Note sans titre'), '<b>Modifié</b>')
    clickCard('Enregistrer', 'Note sans titre')
    await waitFor(() => expect(within(card('Note sans titre')).getByRole('button', { name: 'Supprimer' })).toBeEnabled())
    clickCard('Supprimer', 'Note sans titre')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Note sans titre' })).not.toBeInTheDocument())
    expect(screen.getByTestId('book').textContent).toBe(before)
    expect(changed).not.toHaveBeenCalled()
    expect(library.updateBookRating).not.toHaveBeenCalled()
    expect(library.updateBookReview).not.toHaveBeenCalled()
    expect(library.updateBookNote).not.toHaveBeenCalled()
  })
})

it('pins without toggling the accordion, disables during writing, and preserves the open card', async () => {
  fixture.notes = [note('a'), note('b', 'Deuxième')]
  const writing = pending()
  service.updateBookNotePinned.mockReturnValueOnce(writing.promise)
  render(<BookNotesSection userId="user" bookId="book" />)
  await waitFor(() => expect(addButton()).toBeEnabled())
  expand(card('Deuxième'))
  const pin = within(card('Deuxième')).getByRole('button', { name: 'Épingler la note' })
  pin.focus()
  expect(pin).toHaveFocus()
  expect(pin.tagName).toBe('BUTTON')
  fireEvent.click(pin)
  expect(pin).toBeDisabled()
  expect(card('Deuxième').querySelector('[aria-expanded]')).toHaveAttribute('aria-expanded', 'true')
  await act(async () => writing.resolve())
  expect(screen.getAllByRole('article')[0]).toBe(card('Deuxième'))
  expect(within(card('Deuxième')).getByRole('button', { name: 'Désépingler la note' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(within(card('Deuxième')).getByRole('button', { name: 'Désépingler la note' }))
  await waitFor(() => expect(service.updateBookNotePinned).toHaveBeenLastCalledWith('user', 'book', 'b', false))
})
it('reports a pin error on a collapsed card and allows retry without altering its content', async () => {
  fixture.notes = [note('a')]
  service.updateBookNotePinned.mockRejectedValueOnce(new Error('network'))
  render(<BookNotesSection userId="user" bookId="book" />)
  await waitFor(() => expect(addButton()).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Épingler la note' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de modifier l’épinglage')
  expect(card().querySelector('[aria-expanded]')).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Épingler la note' })).toBeEnabled()
})
