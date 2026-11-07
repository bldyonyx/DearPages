import { webcrypto, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transformHistoricalSnapshot, HISTORICAL_BRANCHES, HISTORICAL_TRANSFORM_VERSION } from '../utils/historicalGenerationTransformer.js'
import { validateGenerationImport } from '../utils/generationImportContracts.js'
import { validateMigrationPlan } from '../utils/generationMigrationContracts.js'
import { canonicalContract, frozenContract } from '../utils/generationContractData.js'

// Raw legacy shapes from generationMigrationImportContracts.test.js. No display
// service fixtures (which add defaults/sanitize HTML) and no Firebase imports.
const context = { uid: 'owner', migrationId: 'migration', transformVersion: 1 }
const library = { id: 'book', title: 'Book', status: 'finished', addedAt: 17, finishedAt: -1000, authors: ['Author'], note: '<b>Old note</b>', review: 'Review', rating: 4 }
const note = { title: ' Note ', contentHtml: '<p>Exact</p>', date: '2024-02-29', createdAt: 10, updatedAt: 15, isPinned: true }
const rating = { value: 4, date: '2024-02-29', revision: 7, createdAt: 2, updatedAt: 8, impression: ' Exact ' }
const collection = { name: ' Name ', description: ' Description ', icon: 'library', pinned: true, createdAt: 1, updatedAt: 3 }
const ratingId = '-1234567890123456789'
const otherRatingId = '-abcdefghijklmnopqrs'
function fixture() {
  return structuredClone({
    library: { book: library, other: { id: 'other', title: 'Other', status: 'reading', addedAt: 9 } },
    bookNotes: { book: { n: note, second: { ...note, title: '', isPinned: false }, 'legacy-note-v1': { ...note, contentHtml: '<b>Edited copy</b>' } } },
    bookNotesLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: library.note, processedAt: 8 } },
    bookReviewsLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: library.review, processedAt: 7 } },
    bookRatings: { book: { [ratingId]: rating, [otherRatingId]: { deleted: true, createdAt: 2, updatedAt: 9, revision: 8 }, 'legacy-rating-v1': { ...rating, date: '', value: 2, revision: 9 } } },
    bookRatingsLegacy: { book: { version: 1, sourceValue: 4, processedAt: 6 } },
    collections: { empty: collection, first: { ...collection, books: { book: true, other: true } }, second: { ...collection, books: { book: true } } },
    profile: { displayName: ' Existing ', email: 'fixture@example.test', extra: 'unchanged' },
    preferences: { language: 'fr', annualGoal: 300, custom: { preserved: true } },
  })
}
const transform = source => transformHistoricalSnapshot(source, context)
const destination = (result, suffix) => result.destinations.find(item => item.destinationPath === `users/owner/${suffix}`)
const codes = result => result.diagnostics.map(item => item.diagnostic.code)
function blockedAt(result, suffix, code) {
  expect(result.status).toBe('blocked')
  expect(result.plan).toBeNull()
  expect(result.destinations).toEqual([])
  expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ sourcePath: `users/owner/${suffix}`, diagnostic: expect.objectContaining({ code, blocking: true }) })]))
}
beforeEach(() => { Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true }) })

describe('historical preparation v1', () => {
  it('inventories all seven branches and produces contract-valid destinations with exact historical provenance', async () => {
    const source = fixture(), result = await transform(source)
    expect(HISTORICAL_TRANSFORM_VERSION).toBe(1)
    expect(result.status).toBe('prepared')
    expect(result.inventory.map(item => item.branch)).toEqual(HISTORICAL_BRANCHES)
    expect(result.inventory.every(item => item.present)).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(validateMigrationPlan(result.plan)).toEqual(result.plan)
    expect(result.plan.units).toHaveLength(result.destinations.length)
    for (const item of result.destinations) {
      expect(validateGenerationImport(item.intent)).toEqual(item.intent)
      expect(item.intent.profile).toBe('generation')
      expect(item.intent.context.uid).toBe(context.uid)
      expect(item.dependencies.every(id => result.plan.units.some(unit => unit.unitId === id))).toBe(true)
      expect(item.intent.payload).toEqual(item.intent.unit.kind === 'membership' ? { present: item.historical, ...item.technical } : { ...item.historical, ...item.technical })
    }
    expect(new Set(result.destinations.map(item => item.destinationPath)).size).toBe(result.destinations.length)
    expect(destination(result, 'bookData/book/1/library').historical).toEqual(source.library.book)
    expect(destination(result, 'bookData/book/1/library').technical).toEqual({})
    expect(result.destinations.filter(item => item.intent.unit.kind === 'historicalSources')).toEqual([])
    expect(result.books).toEqual(expect.arrayContaining([expect.objectContaining({ context: { uid: 'owner', bookId: 'other', generation: 1 }, requiresLifecycleInitialization: true })]))
    expect(result.destinations.some(item => /bookProtocol|bookLifecycle|accountControl|collectionActivity/.test(item.destinationPath))).toBe(false)
  })
  it('preserves multiple edited notes, exact whitespace/HTML/date/pin/timestamps and declares only technical additions', async () => {
    const result = await transform(fixture())
    expect(result.destinations.filter(item => item.intent.unit.kind === 'note')).toHaveLength(3)
    const entry = destination(result, 'bookData/book/1/bookNotes/n')
    expect(entry.historical).toEqual(note)
    expect(entry.technical).toEqual({ creation: expect.stringMatching(/^[a-f0-9]{64}$/), fieldRevisions: { title: 1, contentHtml: 1, date: 1 } })
    const copy = destination(result, 'bookData/book/1/bookNotes/legacy-note-v1')
    const marker = destination(result, 'bookData/book/1/bookNotesLegacy')
    expect(copy.historical.contentHtml).toBe('<b>Edited copy</b>')
    expect(copy.historical.isPinned).toBe(true)
    expect(copy.technical.creation).toBe(marker.technical.intent)
    expect(copy.dependencies).toContain(marker.intent.unit.unitId)
  })
  it('keeps modified ratings and deleted rating tombstones, exact revisions, impressions and unknown-date reserved copy', async () => {
    const result = await transform(fixture())
    expect(result.destinations.filter(item => item.intent.unit.kind === 'rating')).toHaveLength(3)
    expect(destination(result, `bookData/book/1/bookRatings/${ratingId}`).intent.payload).toEqual(rating)
    expect(destination(result, `bookData/book/1/bookRatings/${otherRatingId}`).intent.payload).toEqual({ deleted: true, createdAt: 2, updatedAt: 9, revision: 8 })
    expect(destination(result, 'bookData/book/1/bookRatings/legacy-rating-v1').intent.payload).toMatchObject({ date: '', value: 2, revision: 9 })
    expect(destination(result, 'bookData/book/1/bookRatingsLegacy').technical).toEqual({})
  })
  it('retains markers of deleted copies without resurrection or deduplication', async () => {
    const source = fixture()
    delete source.bookNotes.book['legacy-note-v1']
    delete source.bookRatings.book['legacy-rating-v1']
    const result = await transform(source)
    expect(result.status).toBe('prepared')
    for (const branch of ['bookNotesLegacy', 'bookReviewsLegacy', 'bookRatingsLegacy']) expect(destination(result, `bookData/book/1/${branch}`).historical).toEqual(source[branch].book)
    expect(destination(result, 'bookData/book/1/bookNotes/legacy-note-v1')).toBeUndefined()
    expect(destination(result, 'bookData/book/1/bookNotes/legacy-review-v1')).toBeUndefined()
    expect(destination(result, 'bookData/book/1/bookRatings/legacy-rating-v1')).toBeUndefined()
  })
  it('keeps identical note/review sources and both edited reserved copies as independent entries', async () => {
    const source = fixture()
    source.library.book.review = source.library.book.note
    source.bookReviewsLegacy.book.sourceHtml = source.library.book.note
    source.bookNotes.book['legacy-review-v1'] = { ...note, contentHtml: '<p>Edited review</p>' }
    const result = await transform(source)
    expect(result.status).toBe('prepared')
    const first = destination(result, 'bookData/book/1/bookNotes/legacy-note-v1')
    const second = destination(result, 'bookData/book/1/bookNotes/legacy-review-v1')
    expect(first.technical.creation).not.toBe(second.technical.creation)
    expect(second.technical.creation).toBe(destination(result, 'bookData/book/1/bookReviewsLegacy').technical.intent)
    expect(second.historical.contentHtml).toBe('<p>Edited review</p>')
  })
  it('reconstructs all seven historical branches from destination provenance without losing any value', async () => {
    const source = fixture(), result = await transform(source), reconstructed = {}
    function restore(segments, value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value)) restore([...segments, key], child)
        return
      }
      let target = reconstructed
      for (const key of segments.slice(0, -1)) target = target[key] ??= {}
      expect(Object.hasOwn(target, segments.at(-1))).toBe(false)
      target[segments.at(-1)] = structuredClone(value)
    }
    for (const item of result.destinations) restore(item.sourceSegments.slice(2), item.historical)
    expect(reconstructed).toEqual(Object.fromEntries(HISTORICAL_BRANCHES.map(branch => [branch, source[branch]])))
  })
  it('preserves empty Collections and splits multiple memberships with library/catalog dependencies', async () => {
    const result = await transform(fixture())
    expect(result.destinations.filter(item => item.intent.unit.kind === 'collection')).toHaveLength(3)
    expect(result.destinations.filter(item => item.intent.unit.kind === 'membership')).toHaveLength(3)
    const empty = destination(result, 'collectionCatalog/empty')
    expect(empty.historical).toEqual(collection)
    expect(empty.technical).toEqual({ creation: expect.stringMatching(/^[a-f0-9]{64}$/), membershipEpoch: 1, revision: 1, fieldRevisions: { name: 1, description: 1, icon: 1, pinned: 1 } })
    const membership = destination(result, 'bookData/book/1/collectionMemberships/first')
    expect(membership.historical).toBe(true)
    expect(membership.technical).toEqual({ epoch: 1, revision: 1 })
    expect(membership.intent.payload).toEqual({ epoch: 1, present: true, revision: 1 })
    expect(membership.dependencies).toEqual([destination(result, 'bookData/book/1/library').intent.unit.unitId, destination(result, 'collectionCatalog/first').intent.unit.unitId])
    expect(empty.intent.payload).not.toHaveProperty('books')
  })
  it('retains arbitrary profile/preferences fields in place without defaults, validation or hashing into the book source version', async () => {
    const source = fixture(), first = await transform(source)
    expect(first.retained).toEqual([{ sourcePath: 'users/owner/profile', payload: source.profile }, { sourcePath: 'users/owner/preferences', payload: source.preferences }])
    source.preferences.annualGoal = 999
    source.profile.displayName = 'Another'
    const next = await transform(source)
    expect(next.sourceVersion).toBe(first.sourceVersion)
    expect(next.destinations).toEqual(first.destinations)
    expect(next.retained).not.toEqual(first.retained)
  })
  it.each([null, {}])('inventories absent roots without inventing personal values (%j)', async source => {
    const result = await transform(source)
    expect(result.status).toBe('prepared')
    expect(result.inventory.every(item => !item.present)).toBe(true)
    expect(result.destinations).toEqual([])
    expect(result.books).toEqual([])
    expect(result.retained).toEqual([])
    expect(result).not.toHaveProperty('checkpoint')
    expect(result).not.toHaveProperty('approved')
  })
  it('accepts an empty marker from an absent historical note without materializing a source or a copy', async () => {
    const source = { library: { book: { id: 'book', title: '', status: 'reading', addedAt: 0 } }, bookNotesLegacy: { book: { version: 1, outcome: 'empty', sourceHtml: '', processedAt: 0 } } }
    const result = await transform(source)
    expect(result.status).toBe('prepared')
    expect(destination(result, 'bookData/book/1/library').intent.payload).not.toHaveProperty('note')
    expect(result.destinations.filter(item => item.intent.unit.kind === 'note')).toHaveLength(0)
  })
  it('does not require finished status for already stored ratings', async () => {
    const source = fixture(); source.library.book.status = 'reading'
    expect((await transform(source)).status).toBe('prepared')
  })
  it('preserves rating revisions above the catalogue counter range', async () => {
    const source = fixture(); source.bookRatings.book[ratingId].revision = Number.MAX_SAFE_INTEGER
    const result = await transform(source)
    expect(destination(result, `bookData/book/1/bookRatings/${ratingId}`).historical.revision).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('blocking historical incompatibilities', () => {
  it.each(HISTORICAL_BRANCHES)('rejects malformed %s root rather than skipping it', async branch => {
    const source = fixture(); source[branch] = false
    blockedAt(await transform(source), branch, 'incompatible-source')
  })
  it.each(['bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy'])('diagnoses orphan %s outside the library inventory', async branch => {
    const source = fixture(); source[branch].orphan = source[branch].book
    const result = await transform(source)
    blockedAt(result, `${branch}/orphan`, 'orphan')
    expect(result.source[branch].orphan).toEqual(source[branch].orphan)
  })
  it('blocks orphan Collection membership without synthesizing a book or dropping the relation', async () => {
    const source = fixture(); source.collections.first.books.ghost = true
    blockedAt(await transform(source), 'collections/first/books/ghost', 'orphan')
  })
  it.each([
    ['library', 'book', 'id'], ['library', 'book', 'addedAt'],
    ['bookNotes', 'book', 'n', 'isPinned'], ['bookNotes', 'book', 'n', 'title'], ['bookNotes', 'book', 'n', 'date'],
    ['bookRatings', 'book', ratingId, 'revision'], ['collections', 'empty', 'description'], ['collections', 'empty', 'icon'], ['collections', 'empty', 'pinned'],
  ])('blocks missing required historical field %j', async (...segments) => {
    const source = fixture(); let record = source
    for (const key of segments.slice(0, -1)) record = record[key]
    delete record[segments.at(-1)]
    blockedAt(await transform(source), segments.join('/'), 'missing-required')
  })
  it.each([
    [['bookNotes', 'book', 'n', 'date'], '2023-02-29'],
    [['bookNotes', 'book', 'n', 'contentHtml'], '<script>bad</script>'],
    [['bookNotes', 'book', 'n', 'isPinned'], 'false'],
    [['bookNotes', 'book', 'n', 'createdAt'], -1],
    [['bookNotes', 'book', 'n', 'updatedAt'], 5],
    [['bookRatings', 'book', ratingId, 'value'], 6],
    [['bookRatings', 'book', ratingId, 'date'], ''],
    [['bookRatings', 'book', ratingId, 'impression'], 'x'.repeat(161)],
    [['bookRatings', 'book', otherRatingId, 'revision'], 1],
    [['library', 'book', 'authors'], { 0: 'Author' }],
    [['library', 'book', 'authors'], []],
    [['library', 'book', 'status'], 'unknown'],
    [['collections', 'empty', 'icon'], ''],
    [['collections', 'first', 'books', 'book'], false],
  ])('blocks incompatible value at %j without normalization', async (segments, value) => {
    const source = fixture(); let record = source
    for (const key of segments.slice(0, -1)) record = record[key]
    record[segments.at(-1)] = value
    const result = await transform(source)
    expect(result.status).toBe('blocked')
    expect(result.plan).toBeNull()
    expect(result.destinations).toEqual([])
    expect(result.diagnostics.some(item => item.sourcePath === `users/owner/${segments.join('/')}`)).toBe(true)
    expect(record[segments.at(-1)]).toEqual(value)
  })
  it('reports all independent field errors instead of stopping at the first record', async () => {
    const source = fixture(); source.bookNotes.book.n.extra = 1; source.bookNotes.book.second.date = 'bad'; delete source.collections.empty.createdAt
    const result = await transform(source)
    blockedAt(result, 'bookNotes/book/n/extra', 'unknown-field')
    blockedAt(result, 'bookNotes/book/second/date', 'invalid-field')
    blockedAt(result, 'collections/empty/createdAt', 'missing-required')
  })
  it.each(['customData', 'bookData', 'bookLifecycle', 'bookProtocol', 'collectionCatalog'])('retains and blocks unmapped/pre-existing root %s', async branch => {
    const source = fixture(); source[branch] = { retained: true }
    const result = await transform(source)
    blockedAt(result, branch, branch === 'customData' ? 'unknown-field' : 'identity-conflict')
    expect(result.source[branch]).toEqual(source[branch])
  })
  it.each(['noteMarker', 'reviewMarker', 'ratingMarker'])('blocks unresolved current source divergence for %s without changing either side', async kind => {
    const source = fixture(), branch = { noteMarker: 'bookNotesLegacy', reviewMarker: 'bookReviewsLegacy', ratingMarker: 'bookRatingsLegacy' }[kind]
    const field = kind === 'ratingMarker' ? 'sourceValue' : 'sourceHtml'
    source[branch].book[field] = kind === 'ratingMarker' ? 1 : 'Different captured source'
    const result = await transform(source)
    blockedAt(result, `${branch}/book`, 'marker-conflict')
    expect(result.source).toEqual(source)
  })
  it.each(['bookNotesLegacy', 'bookRatingsLegacy'])('blocks a reserved copy without its marker %s', async branch => {
    const source = fixture(); delete source[branch]
    const result = await transform(source)
    expect(codes(result)).toContain('marker-conflict')
    expect(result.plan).toBeNull()
  })
  it('blocks an empty marker with a surviving reserved copy and contradictory marker outcome', async () => {
    const source = fixture(); source.bookNotesLegacy.book.outcome = 'empty'
    blockedAt(await transform(source), 'bookNotesLegacy/book/outcome', 'marker-conflict')
    source.bookNotesLegacy.book.sourceHtml = ''; source.library.book.note = ''
    blockedAt(await transform(source), 'bookNotes/book/legacy-note-v1', 'marker-conflict')
  })
  it('blocks historical note tombstones instead of treating them as generation storage', async () => {
    const source = fixture(); source.bookNotes.book.n = { deleted: true, createdAt: 10 }
    blockedAt(await transform(source), 'bookNotes/book/n', 'contradictory-state')
  })
  it('blocks a rating tombstone carrying content rather than dropping it', async () => {
    const source = fixture(); source.bookRatings.book[otherRatingId].value = 3
    blockedAt(await transform(source), `bookRatings/book/${otherRatingId}/value`, 'unknown-field')
  })
  it('blocks unsupported rating identities and does not rename them', async () => {
    const source = fixture(); source.bookRatings.book.old = rating
    blockedAt(await transform(source), 'bookRatings/book/old', 'invalid-id')
  })
  it('blocks a conflicting library id instead of recomputing it from metadata', async () => {
    const source = fixture(); source.library.book.id = 'other'
    blockedAt(await transform(source), 'library/book/id', 'identity-conflict')
  })
})

describe('determinism, defensive capture and purity', () => {
  it('returns deeply frozen deterministic results, independent of object insertion order', async () => {
    const reverse = value => Array.isArray(value) ? value.map(reverse) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value
    const source = fixture(), first = await transform(source), second = await transform(reverse(source))
    expect(second).toEqual(first)
    expect(frozenContract(first)).toEqual(first)
    expect(Object.isFrozen(source)).toBe(false)
    expect(Object.isFrozen(source.bookNotes.book.n)).toBe(false)
  })
  it('computes domain-separated UTF-8 source and technical digests pinned by an independent SHA oracle', async () => {
    const source = fixture(), result = await transform(source)
    const historical = Object.fromEntries(HISTORICAL_BRANCHES.map(branch => [branch, source[branch]]))
    const hash = (domain, value) => createHash('sha256').update(canonicalContract(['dear-pages/historical-transform', 1, domain, value]), 'utf8').digest('hex')
    expect(result.sourceVersion).toBe(hash('source', historical))
    expect(destination(result, 'bookData/book/1/bookNotes/n').technical.creation).toBe(hash('technical-identity', { migration: context, sourcePath: 'users/owner/bookNotes/book/n', payload: note }))
  })
  it('captures before awaiting hashing and never mutates or freezes caller-owned data', async () => {
    const source = fixture(), before = structuredClone(source), inputContext = { ...context }
    const promise = transformHistoricalSnapshot(source, inputContext)
    expect(source).toEqual(before)
    source.bookNotes.book.n.title = 'Changed after call'; inputContext.uid = 'other'
    const result = await promise
    expect(result.migration.uid).toBe('owner')
    expect(result.source).toEqual(before)
    expect(destination(result, 'bookData/book/1/bookNotes/n').historical).toEqual(before.bookNotes.book.n)
  })
  it('accepts a frozen source and preserves exact Unicode, array order and empty strings', async () => {
    const source = fixture(); source.library.book.title = 'Été 🪴'; source.library.book.authors = [' Z ', 'A']; source.bookNotes.book.n.contentHtml = '<p>Été 🪴</p>'; source.bookNotes.book.n.title = ''
    const before = structuredClone(source)
    const result = await transform(contractDataForTest(source))
    expect(result.status).toBe('prepared')
    expect(result.source).toEqual(before)
    expect(destination(result, 'bookData/book/1/library').historical.authors).toEqual([' Z ', 'A'])
  })
  it.each(['.priority', '.value', '__proto__', 'constructor', 'bad/key', 'bad.key', 'x'.repeat(129)])('blocks unsafe/export key %s before hashing without renaming it', async key => {
    const source = fixture(); Object.defineProperty(source.bookNotes.book.n, key, { value: 'untouched', enumerable: true })
    const result = await transform(source)
    blockedAt(result, `bookNotes/book/n/${key}`, 'invalid-id')
    expect(result.diagnostics.some(item => item.sourceSegments.at(-1) === key)).toBe(true)
    expect(result.sourceVersion).toBeNull()
    expect(result.source).toBeNull()
    expect(Object.hasOwn(source.bookNotes.book.n, key)).toBe(true)
  })
  it('rejects accessors without invoking them, including in a retained profile', async () => {
    const getter = vi.fn(), source = fixture()
    Object.defineProperty(source.profile, 'secret', { get: getter, enumerable: true })
    blockedAt(await transform(source), 'profile/secret', 'incompatible-source')
    expect(getter).not.toHaveBeenCalled()
  })
  it.each([
    value => { value.bookNotes.book.n[Symbol('source')] = 1 },
    value => { Object.defineProperty(value.bookNotes.book.n, 'hidden', { value: 1 }) },
    value => { value.bookNotes.book.n = new Date(0) },
    value => { value.bookNotes.book.n.toJSON = () => { throw new Error('Must not execute') } },
    value => { value.library.book.authors = ['A', null, 'B'] },
  ])('blocks non-raw or lossy representations without invoking source code %#', async change => {
    const source = fixture(); change(source)
    const result = await transform(source)
    expect(result.status).toBe('blocked')
    expect(result.destinations).toEqual([])
    expect(result.plan).toBeNull()
  })
  it.each([
    value => { value.library.book.authors = ['A', 'removed', 'B']; delete value.library.book.authors[1] },
    value => { value.library.book.authors = Object.assign(['A'], { extra: 'B' }) },
    value => { value.library.book.authors = { 0: 'A', 2: 'B' } },
    value => { value.collections.empty.name = NaN },
    value => { value.bookNotes.book.n.self = value.bookNotes.book.n },
  ])('blocks sparse/decorated arrays, numeric maps and non-JSON sources %#', async change => {
    const source = fixture(); change(source)
    expect((await transform(source)).status).toBe('blocked')
  })
  it('rejects unsupported versions and malformed contexts rather than guessing', async () => {
    await expect(transformHistoricalSnapshot({}, { ...context, transformVersion: 2 })).rejects.toThrow('Unsupported historical transformation version')
    await expect(transformHistoricalSnapshot({}, { ...context, generation: 1 })).rejects.toThrow()
    await expect(transformHistoricalSnapshot({}, { ...context, uid: 'bad/id' })).rejects.toThrow()
  })
  it('does not depend on network, clocks, random IDs, Firebase or services', async () => {
    const forbidden = vi.fn(() => { throw new Error('Forbidden side effect') })
    const clock = vi.spyOn(Date, 'now').mockImplementation(forbidden), random = vi.spyOn(Math, 'random').mockImplementation(forbidden)
    vi.stubGlobal('fetch', forbidden)
    try { expect((await transform(fixture())).status).toBe('prepared'); expect(forbidden).not.toHaveBeenCalled() }
    finally { vi.unstubAllGlobals(); clock.mockRestore(); random.mockRestore() }
    const visited = new Set()
    function inspect(file) {
      if (visited.has(file)) return
      visited.add(file)
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/\bimport\s*\(/)
      for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
        expect(match[1]).not.toMatch(/^firebase(?:\/|$)|dompurify|services\//)
        if (match[1].startsWith('.')) inspect(resolve(dirname(file), match[1]))
      }
    }
    inspect(resolve('src/utils/historicalGenerationTransformer.js'))
  })
})
function contractDataForTest(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(contractDataForTest); Object.freeze(value) }
  return value
}
