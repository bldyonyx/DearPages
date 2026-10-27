import { expect, it, vi } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import {
  createCollectionContext, nextCollectionContext, createCollectionMembership,
  createMembershipConcurrencyToken, createMembershipOperation,
  createCollectionSelection, assertCollectionSelectionCurrent,
} from '../utils/generationCollectionContracts.js'

const context = createBookMutationContext({ uid: 'u', bookId: 'b', generation: 1 })
const collection = createCollectionContext({ uid: 'u', collectionId: 'favorites', epoch: 1 })
const membership = createCollectionMembership({ epoch: 1, present: true, revision: 1 })
const token = (record = membership, book = context, group = collection) => createMembershipConcurrencyToken({ context: book, collection: group, membership: record })
const selection = (group = collection, book = context, expected = null) => createCollectionSelection({ collection: group, entries: [{ context: book, expected }] })

it('keeps collection epoch separate from book generation and clones mutable source records', () => {
  const input = { uid: 'u', collectionId: 'favorites', epoch: 1 }
  const captured = createCollectionContext(input)
  input.epoch = 9
  expect(captured.epoch).toBe(1)
  expect(nextCollectionContext(captured)).toEqual({ uid: 'u', collectionId: 'favorites', epoch: 2 })
  expect(nextCollectionContext(captured).epoch).toBe(2)
  expect(context.generation).toBe(1)
  expect(() => { captured.epoch = 2 }).toThrow(TypeError)
})

it.each([undefined, null, 0, -1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid epochs and revisions %#', value => {
  expect(() => createCollectionContext({ uid: 'u', collectionId: 'c', epoch: value })).toThrow(TypeError)
  expect(() => createCollectionMembership({ epoch: 1, present: true, revision: value })).toThrow(TypeError)
  expect(() => createCollectionMembership({ epoch: value, present: true, revision: 1 })).toThrow(TypeError)
})

it('accepts maximum counters as snapshots and refuses rollover', () => {
  const last = createCollectionContext({ uid: 'u', collectionId: 'c', epoch: Number.MAX_SAFE_INTEGER })
  expect(() => nextCollectionContext(last)).toThrow(RangeError)
  const expected = token(createCollectionMembership({ epoch: 1, present: true, revision: Number.MAX_SAFE_INTEGER }))
  expect(() => createMembershipOperation({ context, collection, intent: 'remove', expected })).toThrow(RangeError)
})

it('models an explicit add, versioned remove and readd without reusing a revision', () => {
  const add = createMembershipOperation({ context, collection, intent: 'add', expected: null })
  expect(add.payload).toEqual({ epoch: 1, present: true, revision: 1 })
  expect(add.entryId).toBe('favorites')
  const remove = createMembershipOperation({ context, collection, intent: 'remove', expected: token(add.payload) })
  expect(remove.payload).toEqual({ epoch: 1, present: false, revision: 2 })
  const readd = createMembershipOperation({ context, collection, intent: 'add', expected: token(remove.payload) })
  expect(readd.payload).toEqual({ epoch: 1, present: true, revision: 3 })
  expect(add.payload.revision).toBe(1)
  for (const value of [readd, readd.context, readd.collection, readd.payload, readd.expected, readd.expected.membership]) {
    expect(Object.isFrozen(value)).toBe(true)
  }
  expect(() => { readd.collection.epoch = 2 }).toThrow(TypeError)
  expect(() => { readd.payload.present = false }).toThrow(TypeError)
})

it('does not increment or toggle an already matching captured membership', () => {
  const op = createMembershipOperation({ context, collection, intent: 'add', expected: token() })
  expect(op.changes).toBe(false)
  expect(op.payload).toEqual(membership)
  expect(() => createMembershipOperation({ context, collection, intent: 'toggle', expected: token() })).toThrow(TypeError)
  expect(() => createMembershipOperation({ context, collection, intent: 'remove', expected: null })).toThrow(TypeError)
})

it('rejects another epoch, collection, owner or book generation in tokens', () => {
  for (const group of [nextCollectionContext(collection), createCollectionContext({ ...collection, collectionId: 'other' })]) {
    expect(() => createMembershipOperation({ context, collection: group, intent: 'remove', expected: token() })).toThrow(TypeError)
  }
  const next = createBookMutationContext({ ...context, generation: 2 })
  expect(() => createMembershipOperation({ context: next, collection, intent: 'remove', expected: token() })).toThrow(TypeError)
  expect(() => token(membership, createBookMutationContext({ ...context, uid: 'other' }))).toThrow(TypeError)
  expect(() => token(createCollectionMembership({ epoch: 2, present: true, revision: 1 }))).toThrow(TypeError)
})

it('freezes selection arrays/rows and is unaffected by edits to the source array', () => {
  const entries = [{ context, expected: token() }]
  const captured = createCollectionSelection({ collection, entries })
  entries.length = 0
  expect(captured.entries).toHaveLength(1)
  expect(Object.isFrozen(captured.entries[0])).toBe(true)
  expect(() => captured.entries.push({ context, expected: null })).toThrow(TypeError)
  expect(() => { captured.entries[0].expected.membership.revision = 99 }).toThrow(TypeError)
  expect(assertCollectionSelectionCurrent(captured, selection(collection, context, token()))).toBe(captured)
})

it('detects selections stale after clear even when the book generation did not change', () => {
  const captured = selection(collection, context, token())
  const afterClear = selection(nextCollectionContext(collection), context, null)
  expect(() => assertCollectionSelectionCurrent(captured, afterClear)).toThrow(TypeError)
  expect(captured.collection.epoch).toBe(1)
})

it('detects a readded book and changed membership revisions without retargeting a snapshot', () => {
  const captured = selection()
  const next = createBookMutationContext({ ...context, generation: 2 })
  expect(() => assertCollectionSelectionCurrent(captured, selection(collection, next))).toThrow(TypeError)
  expect(() => assertCollectionSelectionCurrent(selection(collection, context, token()),
    selection(collection, context, token(createCollectionMembership({ epoch: 1, present: true, revision: 3 }))))).toThrow(TypeError)
  expect(() => assertCollectionSelectionCurrent(captured, selection(collection, context, token()))).toThrow(TypeError)
})

it('rejects duplicate/missing/cross-owner rows and malformed record shapes', () => {
  expect(() => createCollectionSelection({ collection, entries: [{ context, expected: null }, { context, expected: null }] })).toThrow(TypeError)
  expect(() => assertCollectionSelectionCurrent(selection(), createCollectionSelection({ collection, entries: [] }))).toThrow(TypeError)
  expect(() => createCollectionContext({ ...collection, generation: 1 })).toThrow(TypeError)
  expect(() => createCollectionMembership({ epoch: 1, present: 'true', revision: 1 })).toThrow(TypeError)
  expect(() => createMembershipOperation({ context, collection: { ...collection }, intent: 'add', expected: null })).toThrow(TypeError)
})

it('rejects sparse arrays, custom iterators and malicious record/row/index getters without invoking them', () => {
  const getter = vi.fn(() => 1)
  const bad = Object.defineProperty({ ...collection }, 'epoch', { get: getter, enumerable: true })
  expect(() => createCollectionContext(bad)).toThrow(TypeError)
  const row = Object.defineProperty({ context, expected: null }, 'context', { get: getter, enumerable: true })
  expect(() => createCollectionSelection({ collection, entries: [row] })).toThrow(TypeError)
  const indexed = [null]
  Object.defineProperty(indexed, '0', { get: getter, enumerable: true })
  expect(() => createCollectionSelection({ collection, entries: indexed })).toThrow(TypeError)
  const iterated = [{ context, expected: null }]
  Object.defineProperty(iterated, Symbol.iterator, { get: getter })
  expect(() => createCollectionSelection({ collection, entries: iterated })).toThrow(TypeError)
  expect(() => createCollectionSelection({ collection, entries: new Array(1) })).toThrow(TypeError)
  expect(getter).not.toHaveBeenCalled()
})
