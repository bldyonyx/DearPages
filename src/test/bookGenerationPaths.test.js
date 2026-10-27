import { describe, expect, it, vi } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import {
  bookProtocolPath, bookLifecyclePath, bookDataPath, bookLibraryPath,
  bookNotesPath, bookRatingsPath, bookCollectionMembershipsPath,
} from '../utils/bookGenerationPaths.js'

vi.mock('firebase/database', () => { throw new Error('Unexpected Firebase import') })
vi.mock('../services/firebase.js', () => { throw new Error('Unexpected app Firebase import') })

const context = createBookMutationContext({ uid: 'owner', bookId: 'book-1', generation: 7 })
const root = 'users/owner/bookData/book-1/7'
const builders = [
  [bookProtocolPath, 'users/owner/bookProtocol'],
  [bookLifecyclePath, 'users/owner/bookLifecycle/book-1'],
  [bookDataPath, root], [bookLibraryPath, `${root}/library`],
  [bookNotesPath, `${root}/bookNotes`], [bookRatingsPath, `${root}/bookRatings`],
  [bookCollectionMembershipsPath, `${root}/collectionMemberships`],
]

describe('generation paths', () => {
  it.each(builders)('builds the exact %s path', (build, expected) => {
    expect(build(context)).toBe(expected)
  })

  it.each([
    [bookNotesPath, 'bookNotes'], [bookRatingsPath, 'bookRatings'],
    [bookCollectionMembershipsPath, 'collectionMemberships'],
  ])('validates optional record IDs for %s', (build, branch) => {
    expect(build(context, '-record_1')).toBe(`${root}/${branch}/-record_1`)
    expect(build(context, 'é'.repeat(128))).toBe(`${root}/${branch}/${'é'.repeat(128)}`)
    for (const id of [null, '', 1, {}, 'a/b', 'a.b', '#', '$', '[', ']', '\u0000', '\u007f',
      ' a', 'a ', 'a b', '\ud800', 'x'.repeat(129), '__proto__', 'prototype', 'constructor']) {
      expect(() => build(context, id)).toThrow(TypeError)
    }
  })

  it.each(builders)('rejects invalid or mutable contexts in %s', build => {
    for (const invalid of [undefined, null, {}, { ...context },
      Object.freeze({ ...context, generation: 0 }), Object.freeze({ ...context, uid: 'x/y' }),
      Object.freeze({ ...context, bookId: 'x/y' }), Object.freeze({ ...context, extra: true })]) {
      expect(() => build(invalid)).toThrow(TypeError)
    }
  })

  it.each([1, 2147483647])('uses the canonical decimal generation %s', generation => {
    const captured = createBookMutationContext({ uid: 'u', bookId: 'b', generation })
    expect(bookDataPath(captured)).toBe(`users/u/bookData/b/${generation}`)
  })

  it('keeps old contexts and deferred retries bound to their original generation', async () => {
    const input = { uid: 'owner', bookId: 'book-1', generation: 7 }
    const old = createBookMutationContext(input)
    const retry = async () => bookNotesPath(old, 'note-1')
    input.generation = 8
    const next = createBookMutationContext(input)
    expect(bookNotesPath(next, 'note-1')).toBe('users/owner/bookData/book-1/8/bookNotes/note-1')
    await expect(retry()).resolves.toBe(`${root}/bookNotes/note-1`)
    expect(old).toEqual({ uid: 'owner', bookId: 'book-1', generation: 7 })
    expect(Object.isFrozen(old)).toBe(true)
    expect(bookLibraryPath(old)).toBe(`${root}/library`)
    expect(bookLifecyclePath(old)).toBe(bookLifecyclePath(next))
    expect(bookProtocolPath(old)).toBe(bookProtocolPath(next))
  })
})
