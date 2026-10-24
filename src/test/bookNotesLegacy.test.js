import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { get, update } from 'firebase/database'
import { getBookNotesForDisplay, migrateLegacyBookNote, migrateLegacyBookReview } from '../services/bookNotesService.js'

const environment = vi.hoisted(() => ({ enabled: true }))
vi.mock('../services/firebase.js', () => ({ database: {}, get isFirebaseEmulator() { return environment.enabled } }))
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db, path) => path), get: vi.fn(), update: vi.fn(),
  push: vi.fn(), remove: vi.fn(), set: vi.fn(), serverTimestamp: () => ({ '.sv': 'timestamp' }),
}))
const snapshot = (value) => ({ exists: () => value !== null, val: () => value })
const marker = { version: 1, outcome: 'copied', sourceHtml: '<b>Old</b>', processedAt: 123 }
function prepare(book = { note: '<b>Old</b>', rating: 4, review: 'Review', updatedAt: 1 }) {
  get.mockResolvedValueOnce(snapshot(book)).mockResolvedValueOnce(snapshot(null))
    .mockResolvedValueOnce(snapshot(null)).mockResolvedValue(snapshot(marker))
}
beforeEach(() => { vi.resetAllMocks(); environment.enabled = true; vi.stubGlobal('crypto', webcrypto) })

describe('explicit legacy conversion', () => {
  it('also refuses review conversion outside the emulator before Firebase access', async () => {
    environment.enabled = false
    await expect(migrateLegacyBookReview('user', 'book')).rejects.toMatchObject({ code: 'book-notes/emulator-only' })
    expect(get).not.toHaveBeenCalled()
  })

  it('copies the review to its own destination and marker, preserving the allowed HTML', async () => {
    prepare({ note: '<b>Note</b>', review: '<i>Review</i><font size="4">Big</font><script>bad()</script>', rating: 4, updatedAt: 12 })
    await migrateLegacyBookReview('user', 'book')
    const [path, writes] = update.mock.calls[0]
    expect(path).toBe('users/user')
    expect(Object.keys(writes).sort()).toEqual(['bookNotes/book/legacy-review-v1', 'bookReviewsLegacy/book'])
    expect(writes['bookNotes/book/legacy-review-v1']).toMatchObject({ title: 'Mon avis sur le livre', contentHtml: '<i>Review</i><font size="4">Big</font>', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    expect(writes['bookReviewsLegacy/book']).toMatchObject({ version: 1, outcome: 'copied', sourceHtml: '<i>Review</i><font size="4">Big</font><script>bad()</script>' })
  })

  it.each([{}, { review: '' }, { review: null }])('marks a missing review once without creating a note: %j', async (book) => {
    prepare(book)
    await migrateLegacyBookReview('user', 'book')
    expect(update.mock.calls[0][1]).toEqual({ 'bookReviewsLegacy/book': { version: 1, outcome: 'empty', sourceHtml: '', processedAt: { '.sv': 'timestamp' } } })
  })

  it('keeps an existing review marker terminal even if the source changed or the destination was deleted', async () => {
    get.mockResolvedValueOnce(snapshot({ review: 'A later source' })).mockResolvedValueOnce(snapshot(marker))
    expect(await migrateLegacyBookReview('user', 'book')).toEqual(marker)
    expect(get).toHaveBeenCalledTimes(2)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a review ID collision without changing its occupant or either historical field', async () => {
    get.mockResolvedValueOnce(snapshot({ note: 'Note', review: 'Review' })).mockResolvedValueOnce(snapshot(null)).mockResolvedValueOnce(snapshot({ contentHtml: 'Occupied' }))
    await expect(migrateLegacyBookReview('user', 'book')).rejects.toMatchObject({ code: 'book-notes/legacy-conflict' })
    expect(update).not.toHaveBeenCalled()
  })

  it.each(['note', 'review'])('rejects a changed %s source since display, even if its sanitized content is identical', async (kind) => {
    let book = { [kind]: '<b>Text</b><img src=x>' }
    get.mockImplementation(async (path) => snapshot(path.includes('/library/') ? book : null))
    const displayed = await getBookNotesForDisplay('user', 'book')
    const expectedVersion = (kind === 'note' ? displayed.legacy : displayed.legacyReview).sourceVersion
    book = { [kind]: '<b>Text</b><script>bad()</script>' }
    await expect((kind === 'note' ? migrateLegacyBookNote : migrateLegacyBookReview)('user', 'book', { expectedVersion })).rejects.toMatchObject({ code: 'book-notes/legacy-source-changed' })
    expect(update).not.toHaveBeenCalled()
  })

  it('accepts the displayed source fingerprint and a localized initial review title', async () => {
    get.mockImplementation(async (path) => snapshot(path.includes('/library/') ? { review: '<b>Review</b>' } : null))
    const displayed = await getBookNotesForDisplay('user', 'book')
    await migrateLegacyBookReview('user', 'book', { expectedVersion: displayed.legacyReview.sourceVersion, title: 'My review of the book' })
    expect(update.mock.calls[0][1]['bookNotes/book/legacy-review-v1'].title).toBe('My review of the book')
  })

  it.each([null, { expectedVersion: 'stale' }, { expectedVersion: 123 }, { extra: true }])('rejects malformed confirmation options: %j', async (options) => {
    await expect(migrateLegacyBookReview('user', 'book', options)).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
    expect(update).not.toHaveBeenCalled()
  })

  it('never returns either raw marker source in the display contract', async () => {
    get.mockImplementation(async (path) => snapshot(path.includes('/library/') ? { note: 'Old note', review: 'Old review' } : path.includes('Legacy/') ? { sourceHtml: '<script>RAW_MARKER</script>' } : null))
    expect(await getBookNotesForDisplay('user', 'book')).toEqual({ notes: [], legacy: { status: 'processed' }, legacyReview: { status: 'processed' } })
    expect(update).not.toHaveBeenCalled()
  })

  it('fails closed if the independent review marker cannot be read', async () => {
    get.mockImplementation(async (path) => {
      if (path.includes('/bookReviewsLegacy/')) throw new Error('permission denied')
      return snapshot(path.includes('/library/') ? { note: 'Note', review: 'Review' } : null)
    })
    await expect(getBookNotesForDisplay('user', 'book')).rejects.toThrow('permission denied')
    expect(update).not.toHaveBeenCalled()
  })
  it('refuses production before any Firebase access', async () => {
    environment.enabled = false
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toMatchObject({ code: 'book-notes/emulator-only' })
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
  it('copies sanitized HTML with one atomic update and leaves every library field untouched', async () => {
    prepare({ note: '<b>Old</b><img src=x><script>bad()</script>', updatedAt: 1, review: 'Review', rating: 5 })
    await migrateLegacyBookNote('user', 'book')
    const [path, writes] = update.mock.calls[0]
    expect(path).toBe('users/user')
    expect(Object.keys(writes).sort()).toEqual(['bookNotes/book/legacy-note-v1', 'bookNotesLegacy/book'])
    expect(writes['bookNotes/book/legacy-note-v1']).toEqual({
      title: '', contentHtml: '<b>Old</b>', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      createdAt: { '.sv': 'timestamp' }, updatedAt: { '.sv': 'timestamp' },
    })
    expect(writes['bookNotesLegacy/book']).toMatchObject({ version: 1, outcome: 'copied', sourceHtml: '<b>Old</b><img src=x><script>bad()</script>' })
  })
  it.each([{}, { note: '' }, { note: null }])('marks an absent/empty source without a note: %j', async (book) => {
    prepare(book)
    await migrateLegacyBookNote('user', 'book')
    expect(update.mock.calls[0][1]).toEqual({ 'bookNotesLegacy/book': {
      version: 1, outcome: 'empty', sourceHtml: '', processedAt: { '.sv': 'timestamp' },
    } })
  })
  it('returns a persistent marker without inspecting or recreating the destination', async () => {
    get.mockResolvedValueOnce(snapshot({ note: 'Old' })).mockResolvedValueOnce(snapshot(marker))
    expect(await migrateLegacyBookNote('user', 'book')).toEqual(marker)
    expect(get).toHaveBeenCalledTimes(2)
    expect(update).not.toHaveBeenCalled()
  })
  it('reports a reserved ID collision without overwriting data', async () => {
    get.mockResolvedValueOnce(snapshot({ note: 'Old' })).mockResolvedValueOnce(snapshot(null)).mockResolvedValueOnce(snapshot({ contentHtml: 'Existing' }))
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toMatchObject({ code: 'book-notes/legacy-conflict' })
    expect(update).not.toHaveBeenCalled()
  })
  it.each([42, 'x'.repeat(200001), 'A\u0001B'])('leaves invalid historical data unprocessed: %#', async (note) => {
    prepare({ note })
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
    expect(update).not.toHaveBeenCalled()
  })
  it('returns the concurrent winner after a compare-and-set rejection', async () => {
    prepare()
    update.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }))
    expect(await migrateLegacyBookNote('user', 'book')).toEqual(marker)
    expect(update).toHaveBeenCalledTimes(1)
  })
  it('propagates a rejection when no concurrent marker exists', async () => {
    prepare()
    get.mockResolvedValue(snapshot(null))
    update.mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toThrow('PERMISSION_DENIED')
  })
  it('propagates network failure; a retry after a lost acknowledgement only reads the marker', async () => {
    prepare()
    update.mockRejectedValueOnce(new Error('network interruption'))
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toThrow('network interruption')
    get.mockReset()
    get.mockResolvedValueOnce(snapshot({ note: 'Old' })).mockResolvedValueOnce(snapshot(marker))
    expect(await migrateLegacyBookNote('user', 'book')).toEqual(marker)
    expect(update).toHaveBeenCalledTimes(1)
  })
  it('does not process a missing book', async () => {
    get.mockResolvedValue(snapshot(null))
    await expect(migrateLegacyBookNote('user', 'book')).rejects.toMatchObject({ code: 'book-notes/book-not-found' })
    expect(update).not.toHaveBeenCalled()
  })
})
