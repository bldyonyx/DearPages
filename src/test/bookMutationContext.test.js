import { describe, expect, it, vi } from 'vitest'
import {
  createBookMutationContext, MAX_BOOK_GENERATION, validateBookMutationContext,
} from '../utils/bookMutationContext.js'

// Importing/using these primitives must not load the SDK or app connection.
vi.mock('firebase/database', () => { throw new Error('Unexpected Firebase import') })
vi.mock('../services/firebase.js', () => { throw new Error('Unexpected app Firebase import') })

const valid = { uid: 'owner-1', bookId: 'OL123W', generation: 1 }

describe('book mutation context', () => {
  it('copies exactly the supplied fields, freezes the copy and preserves the input', () => {
    const input = { ...valid }
    const context = createBookMutationContext(input)
    expect(context).toEqual(valid)
    expect(context).not.toBe(input)
    expect(Object.isFrozen(context)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(validateBookMutationContext(context)).toBe(context)
    expect(() => { context.generation = 2 }).toThrow(TypeError)
    expect(() => { context.uid = 'other' }).toThrow(TypeError)
    expect(() => { delete context.bookId }).toThrow(TypeError)
    expect(() => { context.extra = true }).toThrow(TypeError)
    expect(context).toEqual(valid)
    input.uid = 'changed'
    input.generation = 2
    expect(context).toEqual(valid)
  })

  it.each([1, MAX_BOOK_GENERATION])('accepts generation boundary %s unchanged', generation => {
    expect(createBookMutationContext({ ...valid, generation }).generation).toBe(generation)
  })

  it.each([undefined, null, 0, -0, -1, 1.5, MAX_BOOK_GENERATION + 1,
    Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity, '1', '01', 1n, true, {}, []])(
    'rejects invalid generation %#', generation => {
      expect(() => createBookMutationContext({ ...valid, generation })).toThrow(TypeError)
      expect(() => validateBookMutationContext(Object.freeze({ ...valid, generation }))).toThrow(TypeError)
    },
  )

  const unsafeIds = [undefined, null, 1, true, {}, [], '', ' ', ' owner', 'owner ', 'a b',
    '.', '..', 'a.b', '#', '$', '[', ']', '/', 'a/b', '\u0000', '\n', '\t', '\u001f', '\u007f',
    '\ud800', '\udfff', 'x'.repeat(129), '__proto__', 'constructor', 'prototype']
  for (const field of ['uid', 'bookId']) {
    it.each(unsafeIds.map(value => [value]))(`rejects unsafe ${field} %# without normalization`, value => {
      expect(() => createBookMutationContext({ ...valid, [field]: value })).toThrow(TypeError)
    })
  }

  it('accepts supported Unicode, push IDs and the identifier length boundary', () => {
    expect(createBookMutationContext({ uid: 'écrivain_日本', bookId: '-abc_DEF-123🙂', generation: 1 }))
      .toEqual({ uid: 'écrivain_日本', bookId: '-abc_DEF-123🙂', generation: 1 })
    expect(createBookMutationContext({ uid: 'u'.repeat(128), bookId: 'b'.repeat(128), generation: 1 }).uid)
      .toHaveLength(128)
  })

  it.each([undefined, null, false, 'context', [], new Date(), {},
    { uid: 'u', bookId: 'b' }, { uid: 'u', generation: 1 }, { bookId: 'b', generation: 1 },
    { ...valid, latestGeneration: 2 }, { ...valid, [Symbol('extra')]: true },
    Object.assign(Object.create(null), valid), Object.create(valid)].map(input => [input]))('rejects unsupported shape %#', input => {
    expect(() => createBookMutationContext(input)).toThrow(TypeError)
  })

  it('rejects hidden fields and accessors without invoking them', () => {
    const getter = vi.fn(() => 'owner')
    const input = { bookId: 'b', generation: 1 }
    Object.defineProperty(input, 'uid', { get: getter, enumerable: true })
    expect(() => createBookMutationContext(input)).toThrow(TypeError)
    expect(getter).not.toHaveBeenCalled()
    const hidden = { ...valid }
    Object.defineProperty(hidden, 'uid', { value: 'owner', enumerable: false })
    expect(() => createBookMutationContext(hidden)).toThrow(TypeError)
  })

  it('validates frozen structural contexts but refuses mutable or malformed ones', () => {
    const structural = Object.freeze({ ...valid })
    expect(validateBookMutationContext(structural)).toBe(structural)
    expect(() => validateBookMutationContext({ ...valid })).toThrow(TypeError)
    expect(() => validateBookMutationContext(Object.freeze({ ...valid, extra: true }))).toThrow(TypeError)
    expect(() => validateBookMutationContext(Object.freeze({ ...valid, uid: 'a/b' }))).toThrow(TypeError)
  })

  it('neither coerces values nor accesses the network', () => {
    const convert = vi.fn(() => 'owner')
    const network = vi.fn(() => { throw new Error('Unexpected network') })
    vi.stubGlobal('fetch', network)
    try {
      expect(createBookMutationContext(valid)).toEqual(valid)
      expect(() => createBookMutationContext({ ...valid, uid: { toString: convert } })).toThrow(TypeError)
      expect(convert).not.toHaveBeenCalled()
      expect(network).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
})
