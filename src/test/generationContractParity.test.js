import { beforeEach, expect, it, vi } from 'vitest'
import { get, set, runTransaction } from 'firebase/database'
import * as legacyNotes from '../services/bookNotesService.js'
import * as legacyRatings from '../services/bookRatingsService.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createNoteCreateOperation, GENERATION_NOTE_LIMITS, GENERATION_LEGACY_NOTE_IDS } from '../utils/generationNoteContracts.js'
import { createRatingCreateOperation, GENERATION_LEGACY_RATING_ID } from '../utils/generationRatingContracts.js'

vi.mock('../services/firebase.js', () => ({ database: {}, isFirebaseEmulator: true }))
vi.mock('firebase/database', () => ({
  ref: vi.fn((_database, path) => path), get: vi.fn(), push: vi.fn(() => ({ key: '-1234567890123456789' })),
  set: vi.fn(), update: vi.fn(), remove: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
}))
const context = createBookMutationContext({ uid: 'u', bookId: 'b', generation: 1 })
const entryId = '-1234567890123456789'
let proposal
beforeEach(() => {
  vi.clearAllMocks()
  proposal = null
  get.mockImplementation(async path => ({ exists: () => true, val: () => path.includes('/bookRatings/')
    ? { ...proposal, createdAt: 1000, updatedAt: 1000 } : { status: 'finished' } }))
  runTransaction.mockImplementation(async (_reference, callback) => {
    proposal = callback(null)
    return { committed: true }
  })
})

it('pins historical IDs and note limits to the current services without runtime imports in contracts', () => {
  expect(GENERATION_NOTE_LIMITS).toEqual(legacyNotes.BOOK_NOTE_LIMITS)
  expect(GENERATION_LEGACY_NOTE_IDS).toEqual({ note: legacyNotes.LEGACY_BOOK_NOTE_ID, review: legacyNotes.LEGACY_BOOK_REVIEW_ID })
  expect(GENERATION_LEGACY_RATING_ID).toBe(legacyRatings.LEGACY_BOOK_RATING_ID)
})

it.each([
  { contentHtml: 'Text', date: '0001-01-01' },
  { title: '', contentHtml: '<b>Bold</b><font size="4">Big</font>', date: '2000-02-29' },
  { title: '🙂'.repeat(100), contentHtml: '<p onclick="bad()">Safe</p><img src=x>', date: '9999-12-31' },
  { title: 'Review', contentHtml: '', date: '2024-02-29' },
])('preserves current note validation/defaults/sanitization %#', async payload => {
  const operation = createNoteCreateOperation({ context, entryId, payload })
  await legacyNotes.createBookNote('u', 'b', payload)
  const sent = set.mock.calls.at(-1)[1]
  expect({ title: sent.title, contentHtml: sent.contentHtml, date: sent.date }).toEqual(operation.payload)
})

it.each([
  { contentHtml: null, date: '2024-01-01' }, { contentHtml: '', date: '' },
  { contentHtml: '', date: '1900-02-29' }, { contentHtml: 'A\u0001B', date: '2024-01-01' },
  { title: '<b>bad</b>', contentHtml: '', date: '2024-01-01' },
  { contentHtml: '', date: '2024-01-01', createdAt: 1 },
])('preserves rejected note business input %#', async payload => {
  expect(() => createNoteCreateOperation({ context, entryId, payload })).toThrow(TypeError)
  await expect(legacyNotes.createBookNote('u', 'b', payload)).rejects.toThrow()
  expect(set).not.toHaveBeenCalled()
})

it.each([
  { value: 1, date: '0001-01-01' }, { value: 5, date: '9999-12-31' },
  { value: 4, date: '2000-02-29', impression: '' },
  { value: 4, date: '2024-01-01', impression: '   ' },
  { value: 4, date: '2024-01-01', impression: '  Spacing kept  ' },
  { value: 4, date: '2024-01-01', impression: '🙂'.repeat(80) },
  { value: 4, date: '2024-01-01', impression: '<b>literal</b>' },
])('preserves current rating payload and initial revision %#', async payload => {
  const operation = createRatingCreateOperation({ context, entryId, payload })
  await legacyRatings.createBookRating('u', 'b', entryId, payload)
  const { revision, createdAt: _createdAt, updatedAt: _updatedAt, ...business } = proposal
  expect(business).toEqual(operation.payload)
  expect(revision).toBe(operation.initialRevision)
})

it.each([
  { value: 0, date: '2024-01-01' }, { value: 6, date: '2024-01-01' },
  { value: 1.5, date: '2024-01-01' }, { value: '4', date: '2024-01-01' },
  { value: 4, date: '' }, { value: 4, date: '2024-04-31' },
  { value: 4, date: '2024-01-01', impression: null },
  { value: 4, date: '2024-01-01', impression: 'a\nb' },
  { value: 4, date: '2024-01-01', impression: '🙂'.repeat(81) },
  { value: 4, date: '2024-01-01', revision: 1 },
])('preserves rejected rating business input %#', async payload => {
  expect(() => createRatingCreateOperation({ context, entryId, payload })).toThrow(TypeError)
  await expect(legacyRatings.createBookRating('u', 'b', entryId, payload)).rejects.toThrow()
  expect(runTransaction).not.toHaveBeenCalled()
})
