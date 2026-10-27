import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createNoteCreateOperation } from '../utils/generationNoteContracts.js'
import { createRatingCreateOperation } from '../utils/generationRatingContracts.js'
import { createCollectionContext, createMembershipOperation } from '../utils/generationCollectionContracts.js'
import { bookNotesLegacyPath, bookReviewsLegacyPath, bookRatingsLegacyPath, collectionCatalogPath } from '../utils/bookGenerationPaths.js'

vi.mock('firebase/app', () => { throw new Error('Unexpected Firebase import') })
vi.mock('firebase/auth', () => { throw new Error('Unexpected Firebase import') })
vi.mock('firebase/database', () => { throw new Error('Unexpected Firebase import') })
vi.mock('../services/firebase.js', () => { throw new Error('Unexpected app singleton import') })

const context = createBookMutationContext({ uid: 'owner', bookId: 'b?%2F+&\\', generation: 7 })

it('constructs raw SDK paths with no URL encoding or duplicate book ID', () => {
  const root = 'users/owner/bookData/b?%2F+&\\/7'
  expect(bookNotesLegacyPath(context)).toBe(`${root}/bookNotesLegacy`)
  expect(bookReviewsLegacyPath(context)).toBe(`${root}/bookReviewsLegacy`)
  expect(bookRatingsLegacyPath(context)).toBe(`${root}/bookRatingsLegacy`)
  expect(collectionCatalogPath('owner')).toBe('users/owner/collectionCatalog')
  expect(collectionCatalogPath('owner', 'c?%2F+&\\')).toBe('users/owner/collectionCatalog/c?%2F+&\\')
})

it.each(['bad/id', 'bad.id', '', 'x'.repeat(129), '__proto__'])('rejects invalid catalog segments %s', value => {
  expect(() => collectionCatalogPath(value)).toThrow(TypeError)
  expect(() => collectionCatalogPath('owner', value)).toThrow(TypeError)
})

it.each([undefined, null, 42, 'bad/id'])('requires explicit valid stable IDs instead of allocating replacements: %#', entryId => {
  expect(() => createNoteCreateOperation({ context, entryId, payload: { contentHtml: 'Text', date: '2024-01-01' } })).toThrow(TypeError)
  expect(() => createRatingCreateOperation({ context, entryId, payload: { value: 4, date: '2024-01-01' } })).toThrow(TypeError)
  expect(() => createCollectionContext({ uid: 'owner', collectionId: entryId, epoch: 1 })).toThrow(TypeError)
})

it('builds without Firebase, clock, random ID allocation or network access', () => {
  const network = vi.fn(() => { throw new Error('Unexpected network') })
  const clock = vi.spyOn(Date, 'now'), random = vi.spyOn(Math, 'random')
  vi.stubGlobal('fetch', network)
  try {
    const note = createNoteCreateOperation({ context, entryId: 'stable', payload: { contentHtml: '<b>Note</b>', date: '2024-01-01' } })
    const rating = createRatingCreateOperation({ context, entryId: '-1234567890123456789', payload: { value: 4, date: '2024-01-01' } })
    const collection = createCollectionContext({ uid: 'owner', collectionId: 'c', epoch: 1 })
    const membership = createMembershipOperation({ context, collection, intent: 'add', expected: null })
    expect([note, rating, membership].every(Object.isFrozen)).toBe(true)
    expect(network).not.toHaveBeenCalled()
    expect(clock).not.toHaveBeenCalled()
    expect(random).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals(); clock.mockRestore(); random.mockRestore() }
})

it('has no Firebase, service, dynamic import or re-export hidden in the local import graph', () => {
  const visited = new Set()
  function inspect(file) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    expect(source).not.toMatch(/\bimport\s*\(/)
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      expect(specifier).not.toMatch(/^firebase(?:\/|$)|services\//)
      if (specifier.startsWith('.')) inspect(resolve(dirname(file), specifier))
    }
  }
  for (const name of ['generationNoteContracts', 'generationRatingContracts', 'generationCollectionContracts', 'bookGenerationPaths']) {
    inspect(resolve('src/utils', `${name}.js`))
  }
})

it('rejects hidden, inherited, symbolic and decorated envelope properties', () => {
  const valid = { context, entryId: 'n', payload: { contentHtml: 'Text', date: '2024-01-01' } }
  for (const input of [Object.create(valid), Object.assign(Object.create(null), valid),
    { ...valid, [Symbol('extra')]: true }, { ...valid, extra: true },
    Object.defineProperty({ ...valid }, 'entryId', { value: 'n', enumerable: false })]) {
    expect(() => createNoteCreateOperation(input)).toThrow(TypeError)
  }
  expect(() => bookNotesLegacyPath({ ...context })).toThrow(TypeError)
})
