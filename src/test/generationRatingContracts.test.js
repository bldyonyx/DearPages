import { expect, it, vi } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import {
  createRatingConcurrencyToken, createRatingCreateOperation, createRatingUpdateOperation,
  createRatingDeleteOperation, createRatingSourceToken, createRatingConversionOperation,
  assertSameRatingCreationIntent,
} from '../utils/generationRatingContracts.js'

const context = createBookMutationContext({ uid: 'u', bookId: 'b', generation: 1 })
const entryId = '-1234567890123456789'
const payload = { value: 4, date: '2024-02-29', impression: 'Keep spacing  ' }
const token = (changes = {}) => createRatingConcurrencyToken({ context, entryId, createdAt: 0, revision: 1, date: payload.date, ...changes })

it('captures stable creation with revision one and unchanged nonempty impression whitespace', () => {
  const input = { ...payload }
  const op = createRatingCreateOperation({ context, entryId, payload: input })
  expect(op.initialRevision).toBe(1)
  expect(op.payload).toEqual(payload)
  input.value = 5
  expect(op.payload.value).toBe(4)
  for (const value of [op, op.context, op.payload]) expect(Object.isFrozen(value)).toBe(true)
  expect(() => { op.payload.value = 5 }).toThrow(TypeError)
})

it('accepts exactly the same normalized creation intent for a retry', () => {
  const a = createRatingCreateOperation({ context, entryId, payload: { value: 4, date: payload.date, impression: '  ' } })
  const b = createRatingCreateOperation({ context, entryId, payload: { value: 4, date: payload.date } })
  expect(a.payload.impression).toBeNull()
  expect(() => assertSameRatingCreationIntent(a, b)).not.toThrow()
  for (const changed of [{ ...payload, value: 5 }, { ...payload, date: '2025-01-01' }, payload]) {
    expect(() => assertSameRatingCreationIntent(a, createRatingCreateOperation({ context, entryId, payload: changed }))).toThrow(TypeError)
  }
  const next = createBookMutationContext({ ...context, generation: 2 })
  expect(() => assertSameRatingCreationIntent(a, createRatingCreateOperation({ context: next, entryId, payload: b.payload }))).toThrow(TypeError)
})

it('keeps fixed CAS tokens and computes update/delete revision without modifying them', () => {
  const expected = token({ revision: 7 })
  const update = createRatingUpdateOperation({ context, entryId, expected, payload })
  const deletion = createRatingDeleteOperation({ context, entryId, expected })
  expect(update.nextRevision).toBe(8)
  expect(deletion.nextRevision).toBe(8)
  expect(deletion.payload).toEqual({ deleted: true })
  expect(deletion.payload).not.toHaveProperty('impression')
  expect(expected.revision).toBe(7)
  expect(Object.isFrozen(update.expected.context)).toBe(true)
})

it.each([0, -1, 1.5, '1', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %#', revision => {
  expect(() => token({ revision })).toThrow(TypeError)
})

it('accepts the largest readable revision and refuses mutation overflow', () => {
  const expected = token({ revision: Number.MAX_SAFE_INTEGER })
  expect(() => createRatingUpdateOperation({ context, entryId, expected, payload })).toThrow(RangeError)
  expect(() => createRatingDeleteOperation({ context, entryId, expected })).toThrow(RangeError)
})

it.each([null, -1, 1.5, '1', { '.sv': 'timestamp' }])('refuses non-acknowledged creation timestamp %#', createdAt => {
  expect(() => token({ createdAt })).toThrow(TypeError)
})

it.each([0, 6, 2.5, '4', null])('preserves invalid star rejection %#', value => {
  expect(() => createRatingCreateOperation({ context, entryId, payload: { ...payload, value } })).toThrow(TypeError)
})

it.each([null, undefined, 42, true, {}, [], '\n', '\t', 'x'.repeat(161), '🙂'.repeat(81)].map(value => [value]))('preserves invalid impression rejection %#', impression => {
  expect(() => createRatingCreateOperation({ context, entryId, payload: { ...payload, impression } })).toThrow(TypeError)
})

it('preserves the UTF-16 impression boundary and plain-text markup', () => {
  for (const impression of ['🙂'.repeat(80), '<b>literal</b>', '', '  ']) {
    expect(() => createRatingCreateOperation({ context, entryId, payload: { ...payload, impression } })).not.toThrow()
  }
})

it.each(['', '0000-01-01', '1900-02-29', '2024-04-31', '2024-1-01'])('preserves invalid new-rating date rejection %s', date => {
  expect(() => createRatingCreateOperation({ context, entryId, payload: { ...payload, date } })).toThrow(TypeError)
})

it('preserves historical conversion with unknown date, reserved ID and no invented impression', () => {
  const expected = createRatingSourceToken({ context, sourceValue: 4 })
  const op = createRatingConversionOperation({ context, expected })
  expect(op.entryId).toBe('legacy-rating-v1')
  expect(op.payload).toEqual({ value: 4, date: '' })
  expect(op.initialRevision).toBe(1)
  const legacy = token({ entryId: op.entryId, date: '' })
  expect(createRatingUpdateOperation({ context, entryId: op.entryId, expected: legacy, payload: { value: 3, date: '' } }).payload.date).toBe('')
  const dated = token({ entryId: op.entryId, date: '2024-01-01' })
  expect(() => createRatingUpdateOperation({ context, entryId: op.entryId, expected: dated, payload: { value: 3, date: '' } })).toThrow(TypeError)
})

it('rejects cross-generation, cross-owner and cross-entry mutation tokens', () => {
  for (const changes of [{ generation: 2 }, { uid: 'other' }, { bookId: 'other' }]) {
    const expected = token({ context: createBookMutationContext({ ...context, ...changes }) })
    expect(() => createRatingUpdateOperation({ context, entryId, expected, payload })).toThrow(TypeError)
    expect(() => createRatingDeleteOperation({ context, entryId, expected })).toThrow(TypeError)
  }
  expect(() => createRatingDeleteOperation({ context, entryId: 'other', expected: token() })).toThrow(TypeError)
  expect(() => createRatingDeleteOperation({ context, entryId, expected: { ...token() } })).toThrow(TypeError)
  const other = createRatingSourceToken({ context: createBookMutationContext({ ...context, generation: 2 }), sourceValue: 4 })
  expect(() => createRatingConversionOperation({ context, expected: other })).toThrow(TypeError)
})

it('rejects malformed payloads and nested getters before invoking them', () => {
  const getter = vi.fn(() => 5)
  const evil = Object.defineProperty({ ...payload }, 'value', { get: getter, enumerable: true })
  expect(() => createRatingCreateOperation({ context, entryId, payload: evil })).toThrow(TypeError)
  const expected = Object.freeze(Object.defineProperty({ ...token() }, 'revision', { get: getter, enumerable: true }))
  expect(() => createRatingDeleteOperation({ context, entryId, expected })).toThrow(TypeError)
  expect(getter).not.toHaveBeenCalled()
  expect(() => createRatingCreateOperation({ context, entryId, payload: { ...payload, revision: 1 } })).toThrow(TypeError)
  expect(() => createRatingCreateOperation({ context, entryId: 'legacy-rating-v1', payload })).toThrow(TypeError)
})
