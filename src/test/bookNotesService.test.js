import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import * as notes from '../services/bookNotesService.js'

vi.mock('firebase/database', () => ({
  get: vi.fn(), ref: vi.fn((_db, path) => path), push: vi.fn(() => ({ key: '-stable-id' })),
  remove: vi.fn(), serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })), set: vi.fn(), update: vi.fn(),
}))
vi.mock('../services/firebase.js', () => ({ database: {}, isFirebaseEmulator: false }))
const snapshot = (value) => ({ exists: () => value !== null, val: () => value })
const input = { contentHtml: '<p><b>Texte</b><font size="4">grand</font><br></p>', date: '2024-02-29' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('crypto', webcrypto)
  get.mockImplementation(async (path) => snapshot(path.includes('/bookReviewsLegacy/') ? null : { title: 'Book' }))
})

describe('book notes service', () => {
  it('reads display state without returning raw marker content or writing anything', async () => {
    get.mockResolvedValueOnce(snapshot({ note: '<b>Historical</b>' }))
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot({ sourceHtml: '<script>RAW_MARKER</script>', version: 1 }))
    expect(await notes.getBookNotesForDisplay('owner', 'book')).toEqual({ notes: [], legacy: { status: 'processed' }, legacyReview: { status: 'empty' } })
    expect(set).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
  it('sanitizes the unprocessed source and reads the marker last', async () => {
    get.mockResolvedValueOnce(snapshot({ note: '<b>Historical</b><img src=x><script>bad()</script>' }))
      .mockResolvedValueOnce(snapshot(null)).mockResolvedValueOnce(snapshot(null))
    expect(await notes.getBookNotesForDisplay('owner', 'book')).toEqual({ notes: [], legacy: { status: 'unprocessed', contentHtml: '<b>Historical</b>', sourceVersion: expect.stringMatching(/^[a-f0-9]{64}$/) }, legacyReview: { status: 'empty' } })
    expect(get.mock.calls.map(([path]) => path)).toEqual(['users/owner/library/book', 'users/owner/bookNotes/book', 'users/owner/bookNotesLegacy/book', 'users/owner/bookReviewsLegacy/book'])
  })
  it('reports an ID collision once without showing the source a second time', async () => {
    get.mockResolvedValueOnce(snapshot({ note: '<b>Historical</b>' }))
      .mockResolvedValueOnce(snapshot({ 'legacy-note-v1': { date: '2026-01-01', contentHtml: '<b>Existing</b>' } })).mockResolvedValueOnce(snapshot(null))
    const result = await notes.getBookNotesForDisplay('owner', 'book')
    expect(result.legacy).toEqual({ status: 'conflict' })
    expect(result.notes).toHaveLength(1)
  })
  it.each([42, 'A\u0001B', 'x'.repeat(200001)])('reports invalid historical content without writes: %#', async (note) => {
    get.mockResolvedValueOnce(snapshot({ note })).mockResolvedValueOnce(snapshot(null)).mockResolvedValueOnce(snapshot(null))
    expect(await notes.getBookNotesForDisplay('owner', 'book')).toEqual({ notes: [], legacy: { status: 'invalid' }, legacyReview: { status: 'empty' } })
    expect(update).not.toHaveBeenCalled()
  })
  it('fails closed when marker access fails', async () => {
    get.mockResolvedValueOnce(snapshot({ note: 'Historical' })).mockResolvedValueOnce(snapshot(null)).mockRejectedValueOnce(new Error('permission denied'))
    await expect(notes.getBookNotesForDisplay('owner', 'book')).rejects.toThrow('permission denied')
  })
  it('creates a stable ID with optional title, allowed HTML and server timestamps only at the note path', async () => {
    await expect(notes.createBookNote('owner', 'book', input)).resolves.toBe('-stable-id')
    expect(push).toHaveBeenCalledWith('users/owner/bookNotes/book')
    expect(set).toHaveBeenCalledWith({ key: '-stable-id' }, {
      ...input, title: '', isPinned: false, createdAt: { '.sv': 'timestamp' }, updatedAt: { '.sv': 'timestamp' },
    })
    expect(serverTimestamp).toHaveBeenCalledTimes(2)
  })

  it('sanitizes hostile HTML without losing permitted formatting', async () => {
    await notes.createBookNote('owner', 'book', { ...input, contentHtml: '<p onclick="bad()"><b>OK</b><font size="5">large</font><img src=x onerror=bad()><script>bad()</script></p>' })
    expect(set.mock.calls[0][1].contentHtml).toBe('<p><b>OK</b><font size="5">large</font></p>')
  })

  it('patches only requested fields and updatedAt; title can be cleared', async () => {
    await notes.updateBookNote('owner', 'book', 'note', { title: '' })
    expect(update).toHaveBeenCalledWith('users/owner/bookNotes/book/note', { title: '', updatedAt: { '.sv': 'timestamp' } })
    expect(set).not.toHaveBeenCalled()
  })

  it('deletes only the specified note', async () => {
    await notes.deleteBookNote('owner', 'book', 'note')
    expect(remove).toHaveBeenCalledWith('users/owner/bookNotes/book/note')
  })

  it('reads and sorts notes by civil date then creation timestamp and ID, sanitizing untrusted content', async () => {
    get.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot({
      a: { date: '2024-02-29', createdAt: 2, contentHtml: '<b>A</b>' },
      b: { date: '2025-01-01', createdAt: 1, contentHtml: '<img src=x><i>B</i>' },
    }))
    expect(await notes.getBookNotes('owner', 'book')).toEqual([
      { id: 'b', isPinned: false, date: '2025-01-01', createdAt: 1, contentHtml: '<i>B</i>' },
      { id: 'a', isPinned: false, date: '2024-02-29', createdAt: 2, contentHtml: '<b>A</b>' },
    ])
    get.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot(null))
    expect(await notes.getBookNote('owner', 'book', 'missing')).toBeNull()
    get.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot(null))
    expect(await notes.getBookNotes('owner', 'book')).toEqual([])
  })

  it.each(['', ' ', 'bad/id', 'bad.id', 'bad#id', 'bad$id', 'bad[id]', '\n', 42, null, 'x'.repeat(129)])('rejects invalid identifiers %j before accessing Firebase', async (id) => {
    await expect(notes.createBookNote(id, 'book', input)).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
    await expect(notes.createBookNote('owner', id, input)).rejects.toThrow()
    await expect(notes.deleteBookNote('owner', 'book', id)).rejects.toThrow()
    expect(ref).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it.each([null, [], {}, { ...input, title: null }, { ...input, title: '<b>Title</b>' },
    { ...input, title: 'x'.repeat(201) }, { ...input, contentHtml: 12 },
    { ...input, contentHtml: 'x'.repeat(200001) }, { ...input, contentHtml: '\u0000' },
    { ...input, createdAt: 3 }, { ...input, updatedAt: 3 }, { ...input, rating: 4 },
    { ...input, date: '2025-02-29' }])('rejects invalid fields %#', async (value) => {
    await expect(notes.createBookNote('owner', 'book', value)).rejects.toMatchObject({ code: 'book-notes/invalid-argument' })
    expect(set).not.toHaveBeenCalled()
  })

  it.each(['0000-01-01', '1900-02-29', '2100-02-29', '2024-04-31', '2024-00-12', '2024-13-01', '2024-01-00', '2024-1-01', '2024-01-01T00:00:00Z', null])('rejects invalid civil date %j', (date) => {
    expect(notes.isBookNoteDate(date)).toBe(false)
  })
  it.each(['0001-01-01', '2000-02-29', '2024-02-29', '2025-02-28', '9999-12-31'])('accepts civil date %s', (date) => {
    expect(notes.isBookNoteDate(date)).toBe(true)
  })

  it('rejects empty patches, caller timestamps and missing note identifiers', async () => {
    for (const patch of [{}, { createdAt: 1 }, { updatedAt: 1 }]) {
      await expect(notes.updateBookNote('owner', 'book', 'note', patch)).rejects.toThrow()
    }
    await expect(notes.updateBookNote('owner', 'book', undefined, { title: 'X' })).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('reports missing books for every operation without writing', async () => {
    get.mockResolvedValue(snapshot(null))
    for (const operation of [
      () => notes.getBookNotes('owner', 'book'), () => notes.getBookNote('owner', 'book', 'note'),
      () => notes.createBookNote('owner', 'book', input),
      () => notes.updateBookNote('owner', 'book', 'note', { title: 'X' }),
      () => notes.deleteBookNote('owner', 'book', 'note'),
    ]) await expect(operation()).rejects.toMatchObject({ code: 'book-notes/book-not-found' })
    expect(set).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not recreate a missing note when updating or deleting', async () => {
    get.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot(null))
    await expect(notes.updateBookNote('owner', 'book', 'missing', { title: 'X' })).rejects.toMatchObject({ code: 'book-notes/note-not-found' })
    get.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot(null))
    await expect(notes.deleteBookNote('owner', 'book', 'missing')).rejects.toMatchObject({ code: 'book-notes/note-not-found' })
  })

  it('propagates Firebase permission/network errors without retries or fallback writes', async () => {
    const error = Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' })
    set.mockRejectedValueOnce(error)
    await expect(notes.createBookNote('owner', 'book', input)).rejects.toBe(error)
    update.mockRejectedValueOnce(error)
    await expect(notes.updateBookNote('owner', 'book', 'note', { title: 'X' })).rejects.toBe(error)
    remove.mockRejectedValueOnce(error)
    await expect(notes.deleteBookNote('owner', 'book', 'note')).rejects.toBe(error)
    get.mockRejectedValueOnce(error)
    await expect(notes.getBookNotes('owner', 'book')).rejects.toBe(error)
  })
})
it('refuses pin writes outside the emulator before accessing Firebase', async () => {
  await expect(notes.updateBookNotePinned('owner', 'book', 'note', true)).rejects.toMatchObject({ code: 'book-notes/emulator-only' })
  expect(ref).not.toHaveBeenCalled()
  expect(get).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})
