import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compose as baseline } from '../generation-feasibility/composeRules.mjs'

const all = (...parts) => parts.map(value => `(${value})`).join(' && ')
const any = (...parts) => parts.map(value => `(${value})`).join(' || ')
const user = "root.child('users').child($uid)"
const account = "root.child('accountControl').child($uid)"
const up = (value, count) => value + '.parent()'.repeat(count)
const after = depth => up('newData', depth)
const active = depth => all('auth != null && auth.uid === $uid', `${account}.child('state').val() === 'active'`, `${up('newData', depth + 2)}.child('accountControl').child($uid).child('state').val() === 'active'`)
const importing = depth => all(active(depth), ...[user, after(depth)].flatMap(value => [
  `${value}.child('bookProtocol/state').val() === 'migrating'`, `${value}.child('historicalImport/phase').val() === 'open'`,
  `${value}.child('historicalImport/stage').val() === 'planned'`,
]))
const book = depth => all(importing(depth), "$g === '1'", ...[user, after(depth)].flatMap(value => [
  `${value}.child('bookLifecycle').child($bookId).child('generation').val() === 1`,
  `${value}.child('bookLifecycle').child($bookId).child('state').val() === 'creating'`,
]))
const scalarCopy = (source, fields) => fields.flatMap(field => [
  `newData.child('${field}').exists() === ${source}.child('${field}').exists()`,
  `newData.child('${field}').val() === ${source}.child('${field}').val()`,
])
const integer = (min = 0, max = 9007199254740991) => `newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= ${min} && newData.val() <= ${max} && newData.getPriority() === null`
const fingerprint = "newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/) && newData.getPriority() === null"
const closed = (required, children, validate = 'true') => ({ '.validate': all(`newData.hasChildren(${JSON.stringify(required)})`, 'newData.getPriority() === null', validate), ...children, '$other': { '.validate': false } })
const leaf = validation => ({ '.validate': all(validation, 'newData.getPriority() === null') })
const legacy = ['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections']

/** Separate import-only Emulator profile. Existing validated profiles untouched.
 * No grant on a user, generation, catalog or legacy ancestor; all null deletes
 * forbidden. Existing CRUD validations remain for unused ready operations, but
 * this profile can NEVER initialize/transition to ready or activate a lifecycle.
 */
export async function compose() {
  const rules = JSON.parse(await baseline()), u = rules.rules.users.$uid, g = u.bookData.$bookId.$g
  u['.write'] = false // Also disable the baseline terminal user purge in this experiment.
  u.importWitness = { '.write': false }
  for (const branch of legacy) u[branch]['.write'] = all(active(1), `${account}.child('legacyClosed').val() === false`, `${up('newData', 3)}.child('accountControl').child($uid).child('legacyClosed').val() === false`, `!${user}.child('bookProtocol').exists()`, `!${after(1)}.child('bookProtocol').exists()`)
  const fresh = all(active(1), '!data.exists()', 'newData.exists()', `!${user}.child('bookProtocol').exists()`, `${after(1)}.child('bookProtocol/state').val() === 'migrating'`, `${after(1)}.child('historicalImport/stage').val() === 'frozen'`, `${after(1)}.child('historicalImport/phase').val() === 'open'`, `${up('newData', 3)}.child('accountControl').child($uid).child('legacyClosed').val() === true`, ...['bookData', 'bookLifecycle', 'collectionCatalog', 'importReceipts', 'batchHead', 'batchReceipts'].flatMap(branch => [`!${user}.child('${branch}').exists()`, `!${after(1)}.child('${branch}').exists()`]))
  u.bookProtocol['.write'] = all(fresh, "newData.child('version').val() === 2", "newData.child('state').val() === 'migrating'", `${after(1)}.child('bookMigration').exists()`)
  u.bookMigration['.write'] = all(fresh, `${after(1)}.child('bookMigration/version').val() === 1`)
  u.historicalImport = { '.write': any(
    all(fresh, `${after(1)}.child('bookMigration').exists()`),
    all(active(1), 'data.exists()', 'newData.exists()', `${user}.child('bookProtocol/state').val() === 'migrating'`, `${after(1)}.child('bookProtocol/state').val() === 'migrating'`,
      "newData.child('sourceVersion').val() === data.child('sourceVersion').val()", "newData.child('planDigest').val() === data.child('planDigest').val()",
      "data.child('phase').val() === 'open'", any(
        all("newData.child('phase').val() === 'open'", any(
          "newData.child('stage').val() === data.child('stage').val()",
          "data.child('stage').val() === 'frozen' && newData.child('stage').val() === 'inventoried'",
          "data.child('stage').val() === 'inventoried' && newData.child('stage').val() === 'planned'",
          "data.child('stage').val() === 'planned' && newData.child('stage').val() === 'imported'")),
        all("data.child('stage').val() === 'imported'", "newData.child('stage').val() === 'imported'", "newData.child('phase').val() === 'sealed'")))),
    ...closed(['sourceVersion', 'planDigest', 'phase', 'stage'], {
      sourceVersion: leaf(fingerprint), planDigest: leaf(fingerprint), phase: leaf("newData.val() === 'open' || newData.val() === 'sealed'"),
      stage: leaf("newData.val() === 'frozen' || newData.val() === 'inventoried' || newData.val() === 'planned' || newData.val() === 'imported'"),
    }),
  }
  u.importReceipts = { '$receipt': {
    '.write': all(importing(2), '!data.exists()', 'newData.exists()', "$receipt.matches(/^[a-f0-9]{64}$/)"),
    ...closed(['unitId', 'payloadDigest'], { unitId: leaf('newData.isString() && newData.val().length > 0 && newData.val().length <= 4096'), payloadDigest: leaf(fingerprint) }),
  } }
  u.bookLifecycle.$bookId['.write'] = all(importing(2), '!data.exists()', 'newData.exists()', "newData.child('generation').val() === 1", "newData.child('state').val() === 'creating'", `!${user}.child('bookData').child($bookId).exists()`, `${user}.child('library').child($bookId).exists()`)
  g['.write'] = false
  function grant(node, depth, source, fields, extra = 'true') {
    node['.write'] = all(book(depth), '!data.exists()', 'newData.exists()', `${source}.exists()`, ...scalarCopy(source, fields), extra)
  }
  const librarySource = `${user}.child('library').child($bookId)`
  const lists = ['authors', 'isbns', 'categories']
  grant(g.library, 4, librarySource, Object.keys(g.library).filter(key => !key.startsWith('.') && key !== '$other' && !lists.includes(key)))
  // Dynamic list leaves are checked against the same raw index. Exhaustiveness
  // (including omitted elements) is independently verified before local success.
  for (const field of lists) {
    g.library['.write'] = all(g.library['.write'], `newData.child('${field}').exists() === ${librarySource}.child('${field}').exists()`)
    g.library[field].$index['.validate'] = all(g.library[field].$index['.validate'], `newData.val() === ${librarySource}.child('${field}').child($index).val()`)
  }
  const note = g.bookNotes.$noteId, noteSource = `${user}.child('bookNotes').child($bookId).child($noteId)`
  grant(note, 5, noteSource, ['title', 'contentHtml', 'date', 'isPinned', 'createdAt', 'updatedAt'], all(
    '!newData.child(\'deleted\').exists()',
    ...['title', 'contentHtml', 'date'].map(field => `newData.child('fieldRevisions/${field}').val() === 1`),
    ...[['legacy-note-v1', 'bookNotesLegacy'], ['legacy-review-v1', 'bookReviewsLegacy']].map(([id, marker]) => `$noteId !== '${id}' || (${user}.child('${marker}').child($bookId).child('outcome').val() === 'copied' && newData.child('creation').val() === ${after(5)}.child('bookData').child($bookId).child('1/${marker}/intent').val())`)))
  note['.validate'] = "newData.hasChildren(['title','contentHtml','date','isPinned','createdAt','updatedAt','creation','fieldRevisions']) && newData.getPriority() === null"
  note.createdAt['.validate'] = integer(); note.updatedAt['.validate'] = all(integer(), "newData.val() >= newData.parent().child('createdAt').val()")
  const rating = g.bookRatings.$ratingId, ratingSource = `${user}.child('bookRatings').child($bookId).child($ratingId)`
  grant(rating, 5, ratingSource, ['value', 'date', 'revision', 'createdAt', 'updatedAt', 'impression', 'deleted'], "$ratingId.matches(/^-[A-Za-z0-9_-]{19}$/) || ($ratingId === 'legacy-rating-v1' && root.child('users').child($uid).child('bookRatingsLegacy').child($bookId).exists())")
  rating['.validate'] = all('newData.getPriority() === null', any(
    all("newData.child('deleted').val() === true", "newData.hasChildren(['deleted','createdAt','updatedAt','revision'])", "newData.child('revision').val() >= 2", ...['value', 'date', 'impression'].map(field => `!newData.child('${field}').exists()`)),
    all("!newData.child('deleted').exists()", "newData.hasChildren(['value','date','createdAt','updatedAt','revision'])")))
  rating.createdAt['.validate'] = integer(); rating.updatedAt['.validate'] = all(integer(), "newData.val() >= newData.parent().child('createdAt').val()")
  rating.revision['.validate'] = integer(1)
  rating.deleted['.validate'] = "newData.val() === true && newData.getPriority() === null"
  rating.impression['.validate'] = rating.impression['.validate'].replace(" && ($ratingId !== 'legacy-rating-v1' || data.parent().exists())", '')
  for (const [branch, ratingMarker] of [['bookNotesLegacy', false], ['bookReviewsLegacy', false], ['bookRatingsLegacy', true]]) {
    const node = g[branch], source = `${user}.child('${branch}').child($bookId)`
    const fields = ratingMarker ? ['version', 'sourceValue', 'processedAt'] : ['version', 'outcome', 'sourceHtml', 'processedAt']
    grant(node, 4, source, fields)
    node['.validate'] = all(`newData.hasChildren(${JSON.stringify(ratingMarker ? fields : [...fields, 'intent'])})`, 'newData.getPriority() === null', ratingMarker ? 'true' : "(newData.child('outcome').val() === 'empty') === (newData.child('sourceHtml').val() === '')")
    node.processedAt['.validate'] = integer()
  }
  const catalog = u.collectionCatalog.$collectionId, catalogSource = `${user}.child('collections').child($collectionId)`
  catalog['.write'] = all(importing(2), '!data.exists()', 'newData.exists()', `${catalogSource}.exists()`, ...scalarCopy(catalogSource, ['name', 'description', 'icon', 'pinned', 'createdAt', 'updatedAt']),
    "newData.child('membershipEpoch').val() === 1", "newData.child('revision').val() === 1", ...['name', 'description', 'icon', 'pinned'].map(field => `newData.child('fieldRevisions/${field}').val() === 1`), ...['deleted', 'lastClearId', 'lastClearFrom'].map(field => `!newData.child('${field}').exists()`))
  catalog['.validate'] = "newData.hasChildren(['name','description','icon','pinned','createdAt','updatedAt','membershipEpoch','revision','creation','fieldRevisions']) && newData.getPriority() === null"
  const membership = g.collectionMemberships.$collectionId
  membership['.write'] = all(book(5), '!data.exists()', 'newData.exists()', `${user}.child('collections').child($collectionId).child('books').child($bookId).val() === true`,
    ...[user, after(5)].map(value => `${value}.child('collectionCatalog').child($collectionId).child('membershipEpoch').val() === 1`),
    "newData.child('epoch').val() === 1", "newData.child('present').val() === true", "newData.child('revision').val() === 1")
  function noPriorities(node) {
    node['.validate'] = all(node['.validate'] ?? 'true', 'newData.getPriority() === null')
    for (const [key, child] of Object.entries(node)) if (!key.startsWith('.') && child && typeof child === 'object') noPriorities(child)
  }
  for (const node of [u.bookData, u.bookLifecycle, u.collectionCatalog, u.historicalImport, u.importReceipts]) noPriorities(node)
  // No readiness, approval or cleanup capability exists in this profile.
  assert.equal(u['.write'], false); assert.equal(g['.write'], false)
  return JSON.stringify(rules, null, 2) + '\n'
}
export async function verify() { assert.equal(await readFile(new URL('database.rules.json', import.meta.url), 'utf8'), await compose()) }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check') await verify()
  else { assert.equal(process.argv.length, 2); await writeFile(new URL('database.rules.json', import.meta.url), await compose()) }
}
