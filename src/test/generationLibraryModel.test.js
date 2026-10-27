import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createLibraryBook, updateBookStatus } from '../services/libraryService.js'
import { runTransaction } from 'firebase/database'
import {
  createGenerationLibraryBook, makeGenerationStatusPatch,
  validateGenerationLibraryRecord, validateGenerationLibraryPatch, validateGenerationLibraryExpected,
} from '../utils/generationLibraryModel.js'

vi.mock('../services/firebase.js', () => ({ database: {} }))
vi.mock('firebase/database', () => ({ ref: vi.fn(), runTransaction: vi.fn(), get: vi.fn(), update: vi.fn() }))
const catalog = { id: 'OL123W', title: 'Book', authors: ['Author'] }
const statuses = ['to-read', 'reading', 'finished', 'abandoned']
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(1700000000000)); vi.clearAllMocks() })
afterEach(() => vi.useRealTimers())

it.each(statuses)('preserves legacy catalog projection for %s', status => {
  expect(createGenerationLibraryBook(catalog, status)).toEqual(createLibraryBook(catalog, status))
})
it.each(statuses.flatMap(from => statuses.map(to => [from, to])))('preserves status/date behavior %s -> %s', async (from, to) => {
  const stored = { status: from, finishedAt: 10, abandonedAt: 20, note: 'Keep', startedAt: 5 }
  runTransaction.mockImplementation(async (_ref, callback) => {
    callback(stored)
    return { snapshot: { exists: () => true }, committed: true }
  })
  expect(makeGenerationStatusPatch(stored, to, Date.now())).toEqual(await updateBookStatus('u', 'b', to))
  expect(stored.startedAt).toBe(5)
})
it('copies metadata arrays and models RTDB absence without dropping unknown fields', () => {
  const input = createGenerationLibraryBook(catalog)
  const record = validateGenerationLibraryRecord({ bookId: catalog.id }, input)
  input.authors.push('Later')
  expect(record.authors).toEqual(['Author'])
  expect(record).not.toHaveProperty('googleBooksId')
  expect(() => validateGenerationLibraryRecord({ bookId: catalog.id }, { ...input, customMetadata: true })).toThrow(TypeError)
})
it.each([0, -1, 123, null])('accepts an explicit reading timestamp %#', value => {
  expect(validateGenerationLibraryPatch({ startedAt: value })).toEqual({ startedAt: value })
})
it.each([undefined, NaN, Infinity, 1.5, '123', 8640000000000001])('rejects malformed reading timestamps %#', value => {
  expect(() => validateGenerationLibraryPatch({ finishedAt: value })).toThrow(TypeError)
})
it.each([{ rating: 0 }, { rating: 6 }, { rating: null }, { status: 'finished' }, { title: 'Changed' },
  { updatedAt: 1 }, { extra: true }, {}, { note: null }])('rejects unsupported patches %#', patch => {
  expect(() => validateGenerationLibraryPatch(patch)).toThrow(TypeError)
})
it('reuses the existing HTML sanitizer', () => {
  expect(validateGenerationLibraryPatch({ note: '<b>Safe</b><img src=x onerror=alert(1)><script>bad()</script>' }).note)
    .toBe('<b>Safe</b>')
})
it('supports explicit absence CAS tokens without allowing null rating/note writes', () => {
  const expected = validateGenerationLibraryExpected({ rating: null, note: null, startedAt: null, status: 'reading' })
  expect(Object.isFrozen(expected)).toBe(true)
  expect(expected).toEqual({ rating: null, note: null, startedAt: null, status: 'reading' })
  expect(() => validateGenerationLibraryExpected({ status: 'unknown' })).toThrow(TypeError)
  expect(() => validateGenerationLibraryExpected({ id: 'other' })).toThrow(TypeError)
})
