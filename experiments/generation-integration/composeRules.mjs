import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const stages = ['book-lifecycle', 'generation-library', 'generation-notes', 'generation-ratings', 'generation-collection-catalog', 'generation-collection-memberships']
const owner = rules => rules.rules.users.$uid
const generation = rules => owner(rules).bookData.$bookId.$g
const sha = text => createHash('sha256').update(text).digest('hex')
function changes(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a === undefined) return [{ path, change: 'added' }]
  if (b === undefined) return [{ path, change: 'removed' }]
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => changes(a[key], b[key], `${path}/${key}`))
  return [{ path, change: 'changed' }]
}
export async function composeRules() {
  const texts = await Promise.all(stages.map(stage => readFile(new URL(`../${stage}/database.rules.json`, import.meta.url), 'utf8')))
  const sources = Object.fromEntries(stages.map((stage, i) => [stage, JSON.parse(texts[i])]))
  const base = sources['book-lifecycle'], lib = sources['generation-library'], notes = sources['generation-notes'], ratings = sources['generation-ratings'], catalog = sources['generation-collection-catalog'], members = sources['generation-collection-memberships']
  for (const rules of Object.values(sources)) {
    assert.deepEqual(owner(rules).bookProtocol, owner(base).bookProtocol)
    assert.deepEqual(owner(rules).bookLifecycle, owner(base).bookLifecycle)
    assert.equal(generation(rules)['.write'], generation(base)['.write'])
    assert.equal(generation(rules)['.validate'], generation(base)['.validate'])
    assert.equal(owner(rules)['.write'], undefined)
    assert.equal(owner(rules).bookData['.write'], undefined)
    assert.equal(owner(rules).bookData.$bookId['.write'], undefined)
  }
  const rules = structuredClone(base), target = generation(rules)
  // Compose each authoritative branch; never grant active writes at ancestors.
  target.library = structuredClone(generation(lib).library)
  const oldLibrary = structuredClone(generation(lib).library), noteLibrary = structuredClone(generation(notes).library)
  delete oldLibrary['.write']; delete noteLibrary['.write']; assert.deepEqual(oldLibrary, noteLibrary)
  target.library['.write'] = generation(notes).library['.write']
  for (const name of ['bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy']) target[name] = structuredClone(generation(notes)[name])
  for (const name of ['bookRatings', 'bookRatingsLegacy']) target[name] = structuredClone(generation(ratings)[name])
  owner(rules).collectionCatalog = structuredClone(owner(catalog).collectionCatalog)
  target.collectionMemberships = structuredClone(generation(members).collectionMemberships)
  // Strongest accumulated policy must match all branches of the newest file.
  assert.deepEqual(rules, members)
  for (const name of ['bookNotes', 'bookRatings', 'collectionMemberships']) assert.equal(target[name]['.write'], undefined)
  assert.equal(owner(rules).collectionCatalog['.write'], undefined)
  const output = JSON.stringify(rules, null, 2) + '\n'
  const report = {
    project: 'demo-dear-pages', sources: stages.map((stage, i) => ({ path: `experiments/${stage}/database.rules.json`, sha256: sha(texts[i]) })),
    comparisons: stages.slice(1).map((stage, i) => ({ from: stages[i], to: stage, changes: changes(sources[stages[i]], sources[stage]) })),
    branchSources: { protocol: 'book-lifecycle', lifecycle: 'book-lifecycle', purge: 'book-lifecycle', librarySchema: 'generation-library', libraryWrite: 'generation-notes', notes: 'generation-notes', ratings: 'generation-ratings', catalog: 'generation-collection-catalog', memberships: 'generation-collection-memberships' },
    contractConflicts: [{ path: 'library/.write', api: ['updateBookNote', 'updateBookReview', 'updateLibraryFields({note|review})'], advertisedBy: 'experiments/generation-library/README.md', frozenBy: 'experiments/generation-notes/README.md', resolution: 'resolved: library patches and compatibility setters reject locally with generation-library/historical-source-readonly; creating-only initialization and explicit conversions preserved' }],
    ancestorAudit: { userWrite: false, bookDataWrite: false, bookWrite: false, collectionCatalogWrite: false, childCollectionWrite: false, generationWrite: 'unchanged durable deleting lock + full null purge only' },
    combinedRulesSha256: sha(output),
  }
  return { output, report: JSON.stringify(report, null, 2) + '\n' }
}
export async function verifyComposition() {
  const generated = await composeRules()
  assert.equal(await readFile(new URL('database.rules.json', import.meta.url), 'utf8'), generated.output)
  assert.equal(await readFile(new URL('composition-report.json', import.meta.url), 'utf8'), generated.report)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--check') { await verifyComposition(); console.log('RULE_COMPOSITION_VERIFIED') }
  else {
    assert.equal(process.argv.length, 2, 'Only --check or no arguments accepted')
    const generated = await composeRules()
    await writeFile(new URL('database.rules.json', import.meta.url), generated.output)
    await writeFile(new URL('composition-report.json', import.meta.url), generated.report)
    console.log('RULE_COMPOSITION_GENERATED')
  }
}
