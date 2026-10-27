import { expect, it, vi } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import {
  createNoteConcurrencyToken, createNoteCreateOperation, createNotePatchOperation, createNoteSaveOperation,
  createNotePinOperation, createNoteDeleteOperation, createNoteSourceToken, createNoteConversionOperation,
} from '../utils/generationNoteContracts.js'

const context = createBookMutationContext({ uid: 'u', bookId: 'b', generation: 1 })
const fields = { title: 'Title', contentHtml: '<b>Body</b>', date: '2024-02-29' }
const token = (scope = context, entryId = 'n') => createNoteConcurrencyToken({ context: scope, entryId, createdAt: 0, fields })

it('captures a stable creation identity and normalized immutable payload without altering input', () => {
  const input = { contentHtml: '<b>Safe</b><img src=x>', date: '2024-02-29' }
  const op = createNoteCreateOperation({ context, entryId: 'n', payload: input })
  expect(op).toMatchObject({ type: 'note.create', context, entryId: 'n', expected: null,
    payload: { title: '', contentHtml: '<b>Safe</b>', date: input.date } })
  input.contentHtml = 'Changed'
  expect(op.payload.contentHtml).toBe('<b>Safe</b>')
  for (const value of [op, op.context, op.payload]) expect(Object.isFrozen(value)).toBe(true)
  expect(() => { op.context.generation = 2 }).toThrow(TypeError)
  expect(() => { op.entryId = 'other' }).toThrow(TypeError)
  expect(() => { op.payload.title = 'Other' }).toThrow(TypeError)
})

it('does not retarget deferred work when a new context is constructed', async () => {
  const old = createNoteCreateOperation({ context, entryId: 'stable', payload: fields })
  const retry = async () => old
  const next = createBookMutationContext({ ...context, generation: 2 })
  createNoteCreateOperation({ context: next, entryId: 'stable', payload: fields })
  expect(await retry()).toBe(old)
  expect(old.context.generation).toBe(1)
})

it('keeps exact CAS snapshots, selects only patched fields and distinguishes complete saves', () => {
  const snapshot = { ...fields, contentHtml: '<p>Byte-exact</p>' }
  const expected = createNoteConcurrencyToken({ context, entryId: 'n', createdAt: 17, fields: snapshot })
  snapshot.title = 'Caller mutation'
  const patch = createNotePatchOperation({ context, entryId: 'n', expected, payload: { title: 'New' } })
  const other = createNotePatchOperation({ context, entryId: 'n', expected, payload: { date: '2025-01-01' } })
  const save = createNoteSaveOperation({ context, entryId: 'n', expected, payload: fields })
  expect(patch.comparisonFields).toEqual(['title'])
  expect(other.comparisonFields).toEqual(['date'])
  expect(save.comparisonFields).toEqual(['title', 'contentHtml', 'date'])
  expect(patch.expected.fields).toEqual({ ...fields, contentHtml: '<p>Byte-exact</p>' })
  expect(patch).not.toHaveProperty('revision')
  expect(Object.isFrozen(save.comparisonFields)).toBe(true)
  expect(Object.isFrozen(save.expected.fields)).toBe(true)
  expect(() => { save.expected.fields.title = 'Changed' }).toThrow(TypeError)
})

it('captures explicit pin assignments and terminal deletion without a global content revision', () => {
  const expected = token()
  const pin = createNotePinOperation({ context, entryId: 'n', expected, isPinned: false })
  expect(pin.payload).toEqual({ isPinned: false })
  expect(pin.comparisonFields).toEqual([])
  expect(createNoteDeleteOperation({ context, entryId: 'n', expected }).payload).toEqual({ deleted: true })
  expect(() => createNotePinOperation({ context, entryId: 'n', expected, isPinned: 'toggle' })).toThrow(TypeError)
})

it.each([
  createBookMutationContext({ ...context, generation: 2 }),
  createBookMutationContext({ ...context, uid: 'other' }),
  createBookMutationContext({ ...context, bookId: 'other' }),
])('rejects another context in every note mutation token: %#', other => {
  const expected = token(other)
  for (const call of [
    () => createNotePatchOperation({ context, entryId: 'n', expected, payload: { title: 'New' } }),
    () => createNoteSaveOperation({ context, entryId: 'n', expected, payload: fields }),
    () => createNotePinOperation({ context, entryId: 'n', expected, isPinned: true }),
    () => createNoteDeleteOperation({ context, entryId: 'n', expected }),
  ]) expect(call).toThrow(TypeError)
})

it('rejects entry mismatches, mutable tokens, server timestamp estimates and extra technical fields', () => {
  expect(() => createNoteDeleteOperation({ context, entryId: 'different', expected: token() })).toThrow(TypeError)
  expect(() => createNoteDeleteOperation({ context, entryId: 'n', expected: { ...token() } })).toThrow(TypeError)
  expect(() => createNoteConcurrencyToken({ context, entryId: 'n', createdAt: { '.sv': 'timestamp' }, fields })).toThrow(TypeError)
  expect(() => createNoteCreateOperation({ context, entryId: 'n', payload: { ...fields, revision: 1 } })).toThrow(TypeError)
})

it.each(['note', 'review'])('captures independent historical %s conversions', kind => {
  const expected = createNoteSourceToken({ context, kind, sourceVersion: 'a'.repeat(64) })
  const op = createNoteConversionOperation({ context, expected, date: '2024-02-29' })
  expect(op.entryId).toBe(kind === 'note' ? 'legacy-note-v1' : 'legacy-review-v1')
  expect(op.payload.kind).toBe(kind)
  expect(op.payload.date).toBe('2024-02-29')
  expect(op).not.toHaveProperty('processedAt')
  expect(() => createNoteCreateOperation({ context, entryId: op.entryId, payload: fields })).toThrow(TypeError)
  const next = createBookMutationContext({ ...context, generation: 2 })
  expect(() => createNoteConversionOperation({ context: next, expected, date: '2024-02-29' })).toThrow(TypeError)
})

it.each([null, undefined, 0, 'bad', 'A'.repeat(64), 'a'.repeat(63)])('rejects invalid source fingerprint %#', sourceVersion => {
  expect(() => createNoteSourceToken({ context, kind: 'note', sourceVersion })).toThrow(TypeError)
})

it.each([
  {}, { title: '<b>Title</b>' }, { contentHtml: null }, { date: '1900-02-29' },
  { title: 'x'.repeat(201) }, { contentHtml: 'x'.repeat(200001) }, { date: '0000-01-01' },
])('rejects malformed targeted note patches %#', payload => {
  expect(() => createNotePatchOperation({ context, entryId: 'n', expected: token(), payload })).toThrow(TypeError)
})

it('rejects getters at the envelope, payload, token and token-content boundaries without invoking them', () => {
  const getter = vi.fn(() => 'malicious')
  const access = (base, key) => Object.defineProperty({ ...base }, key, { get: getter, enumerable: true })
  const cases = [
    () => createNoteCreateOperation(access({ context, entryId: 'n', payload: fields }, 'context')),
    () => createNoteCreateOperation({ context, entryId: 'n', payload: access(fields, 'contentHtml') }),
    () => createNoteDeleteOperation({ context, entryId: 'n', expected: Object.freeze(access(token(), 'createdAt')) }),
    () => createNoteConcurrencyToken({ context, entryId: 'n', createdAt: 1, fields: access(fields, 'title') }),
  ]
  for (const call of cases) expect(call).toThrow(TypeError)
  expect(getter).not.toHaveBeenCalled()
})
