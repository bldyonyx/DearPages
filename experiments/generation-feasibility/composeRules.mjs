import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const MAX_ROWS = 32
export const RECEIPTS = 64
const both = (...clauses) => clauses.map(s => `(${s})`).join(' && ')
const either = clauses => clauses.map(s => `(${s})`).join(' || ')
const owner = 'auth != null && auth.uid === $uid'
const user = "root.child('users').child($uid)"
const control = "root.child('accountControl').child($uid)"
const up = (base, n) => base + '.parent()'.repeat(n)
const userAfter = depth => up('newData', depth)
const rootAfter = depth => up('newData', depth + 2)
const active = depth => both(owner, `${control}.child('state').val() === 'active'`, `${rootAfter(depth)}.child('accountControl').child($uid).child('state').val() === 'active'`)
const ready = depth => both(active(depth), `${user}.child('bookProtocol/state').val() === 'ready'`, `${userAfter(depth)}.child('bookProtocol/state').val() === 'ready'`)
const head = base => `${base}.child('batchHead')`
const receipt = base => `${base}.child('batchReceipts').child(${head(base)}.child('slot').val() + '')`
const advancing = after => both(`${head(after)}.child('sequence').val() === (${head(user)}.child('sequence').exists() ? ${head(user)}.child('sequence').val() : 0) + 1`, `${head(after)}.child('sequence').val() <= 2147483647`, `${head(after)}.child('slot').val() === ${head(after)}.child('sequence').val() % 64`, `${receipt(after)}.child('sequence').val() === ${head(after)}.child('sequence').val()`, `${receipt(after)}.child('intent').val() === ${head(after)}.child('intent').val()`)
// RTDB's regex parser does not interpret textual Unicode escapes like JS.
// Emit the control characters (JSON.stringify escapes them in the rules file),
// matching the validated catalog policy instead of accidentally banning f/7/u.
const key = "newData.isString() && newData.val().length > 0 && newData.val().length <= 128 && !newData.val().matches(/[.#$\\[\\]\\/\u0000- \u007f]/) && newData.val() !== '__proto__' && newData.val() !== 'constructor' && newData.val() !== 'prototype'"
const integer = (max = 2147483647, min = 1) => `newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= ${min} && newData.val() <= ${max}`
const closed = (required, fields, validate = 'true') => ({ '.validate': both(`newData.hasChildren(${JSON.stringify(required)})`, 'newData.getPriority() === null', validate), ...fields, '$other': { '.validate': false } })
const leaf = validate => ({ '.validate': both(validate, 'newData.getPriority() === null') })
const legacy = ['library', 'collections', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy']

export async function compose() {
  const rules = JSON.parse(await readFile(new URL('../generation-integration/database.rules.json', import.meta.url), 'utf8'))
  const u = rules.rules.users.$uid
  // Preserve each original authorization, additionally fencing the account both
  // before and after the write. Never add an ordinary user/ancestor write grant.
  function fence(node, depth) {
    for (const [name, value] of Object.entries(node)) {
      if (name === '.write') node[name] = both(value, active(depth))
      else if (!name.startsWith('.') && typeof value === 'object') fence(value, depth + 1)
    }
  }
  fence(u, 0)
  u['.read'] = owner // Test observer is owner-only; no ordinary ancestor write.
  u['.write'] = both(owner, `${control}.child('state').val() === 'deleting'`, `${rootAfter(0)}.child('accountControl').child($uid).child('state').val() === 'deleting'`, '!newData.exists()')
  for (const branch of legacy) {
    const post = userAfter(1)
    u[branch] = { '.write': both(active(1), either([
      both(`${control}.child('legacyClosed').val() === false`, `${rootAfter(1)}.child('accountControl').child($uid).child('legacyClosed').val() === false`, `!${user}.child('bookProtocol').exists()`, `!${post}.child('bookProtocol').exists()`),
      both(`${user}.child('bookProtocol/state').val() === 'migrating'`, `${post}.child('bookProtocol/state').val() === 'ready'`, '!newData.exists()'),
    ])) }
  }
  u.profile = { '.write': active(1) }
  u.preferences = { '.write': active(1) }
  u.bookProtocol = {
    '.write': both(active(1), 'newData.exists()', `${rootAfter(1)}.child('accountControl').child($uid).child('legacyClosed').val() === true`, either([
      both('!data.exists()', "newData.child('state').val() === 'migrating'", `${userAfter(1)}.child('bookMigration').exists()`),
      both("data.child('state').val() === 'migrating'", "newData.child('state').val() === 'ready'", ...legacy.map(b => `!${userAfter(1)}.child('${b}').exists()`)),
    ])),
    ...closed(['version', 'state'], { version: leaf('newData.val() === 2'), state: leaf("newData.val() === 'migrating' || newData.val() === 'ready'") }),
  }
  u.bookMigration = {
    '.write': both(active(1), '!data.exists()', 'newData.exists()', `!${user}.child('bookProtocol').exists()`, `${userAfter(1)}.child('bookProtocol/state').val() === 'migrating'`, `${rootAfter(1)}.child('accountControl').child($uid).child('legacyClosed').val() === true`),
    ...closed(['id', 'version'], { id: leaf(key), version: leaf('newData.val() === 1') }),
  }
  // Minimal import witness, deliberately NOT a migration engine or permission
  // to rewrite bookData. It proves imports stop at terminal account fencing.
  u.importWitness = { '.write': both(active(1), `${user}.child('bookProtocol/state').val() === 'migrating'`, `${userAfter(1)}.child('bookProtocol/state').val() === 'migrating'`, 'newData.exists()', '!data.exists()'), ...closed(['migrationId', 'value'], { migrationId: leaf(`newData.val() === ${user}.child('bookMigration/id').val()`), value: leaf('newData.isString()') }) }

  const guardUser = up('newData', 4)
  const beforeBook = `${user}.child('bookData').child(newData.child('bookId').val()).child(newData.child('generation').val() + '')`
  const afterBook = `${guardUser}.child('bookData').child(newData.child('bookId').val()).child(newData.child('generation').val() + '')`
  const member = base => `${base}.child('collectionMemberships').child(newData.child('collectionId').val())`
  const beforeMember = member(beforeBook), afterMember = member(afterBook)
  const life = base => `${base}.child('bookLifecycle').child(newData.child('bookId').val())`
  const cat = base => `${base}.child('collectionCatalog').child(newData.child('collectionId').val())`
  const equalState = (actual, expected) => both(`${actual}.exists() === ${expected}.child('exists').val()`, ...['epoch', 'present', 'revision'].map(f => `${actual}.child('${f}').val() === (${expected}.child('exists').val() === true ? ${expected}.child('${f}').val() : null)`))
  const before = "newData.child('before')", after = "newData.child('after')"
  const effective = both(`${before}.child('exists').val() === true`, `${before}.child('epoch').val() === newData.child('epoch').val()`, `${before}.child('present').val() === true`)
  const changed = `newData.child('desired').val() !== (${effective})`
  const identity = both(...[user, guardUser].flatMap(base => [
    `${life(base)}.child('generation').val() === newData.child('generation').val()`, `${life(base)}.child('state').val() === 'active'`,
    `${cat(base)}.exists()`, `${cat(base)}.child('deleted').val() !== true`, `${cat(base)}.child('createdAt').val() === newData.child('catalogCreatedAt').val()`, `${cat(base)}.child('membershipEpoch').val() === newData.child('epoch').val()`,
  ]), `${beforeBook}.child('library').exists()`, `${afterBook}.child('library').exists()`)
  const unchanged = equalState(afterMember, before)
  const changedState = both(`${after}.child('exists').val() === true`, `${after}.child('epoch').val() === newData.child('epoch').val()`, `${after}.child('present').val() === newData.child('desired').val()`, `${after}.child('revision').val() === (${before}.child('exists').val() === true && ${before}.child('epoch').val() === newData.child('epoch').val() ? ${before}.child('revision').val() + 1 : 1)`)
  const stateSchema = closed(['exists'], { exists: leaf('newData.isBoolean()'), epoch: leaf(integer()), present: leaf('newData.isBoolean()'), revision: leaf(integer()) }, "newData.child('exists').val() === true ? newData.hasChildren(['epoch','present','revision']) : !newData.child('epoch').exists() && !newData.child('present').exists() && !newData.child('revision').exists()")
  const guardFields = {
    enabled: leaf('newData.isBoolean()'), bookId: leaf(key), generation: leaf(integer()), collectionId: leaf(key),
    catalogCreatedAt: leaf(integer(9007199254740991, 0)), epoch: leaf(integer()), desired: leaf('newData.isBoolean()'), before: stateSchema, after: stateSchema,
  }
  const required = Object.keys(guardFields)
  const guard = closed(['enabled'], guardFields, `newData.child('enabled').val() === false ? ${required.filter(k => k !== 'enabled').map(k => `!newData.child('${k}').exists()`).join(' && ')} : ${both(
    `newData.hasChildren(${JSON.stringify(required)})`, identity, equalState(beforeMember, before), equalState(afterMember, after),
    `(${before}.child('exists').val() !== true || ${before}.child('epoch').val() <= newData.child('epoch').val())`,
    `${up('newData', 2)}.child('entries').child(newData.child('bookId').val()).child(newData.child('collectionId').val()).val() === $guard + ''`,
    `(${changed}) ? (${changedState}) : (${unchanged})`,
    `!(${changed}) || ${guardUser}.child('collectionActivity').child(newData.child('collectionId').val()).child('at').val() === now`,
  )}`)
  // Entries point back to fixed slots; guards point to entries. This prevents
  // duplicate tuples and hidden writes without adding metadata to memberships.
  const entries = { '$book': { '$collection': { '.validate': both("newData.isString() && newData.val().matches(/^(0|[1-9]|[12][0-9]|3[01])$/)", `${up('newData', 3)}.child('guards').child(newData.val()).child('enabled').val() === true`, `${up('newData', 3)}.child('guards').child(newData.val()).child('bookId').val() === $book`, `${up('newData', 3)}.child('guards').child(newData.val()).child('collectionId').val() === $collection`) } } }
  const activity = { '$collection': { '.validate': both("newData.isString() && newData.val().matches(/^(0|[1-9]|[12][0-9]|3[01])$/)", `${up('newData', 2)}.child('guards').child(newData.val()).child('enabled').val() === true`, `${up('newData', 2)}.child('guards').child(newData.val()).child('collectionId').val() === $collection`, `${up('newData', 2)}.child('guards').child(newData.val()).child('desired').val() !== (${up('newData', 2)}.child('guards').child(newData.val()).child('before/exists').val() === true && ${up('newData', 2)}.child('guards').child(newData.val()).child('before/epoch').val() === ${up('newData', 2)}.child('guards').child(newData.val()).child('epoch').val() && ${up('newData', 2)}.child('guards').child(newData.val()).child('before/present').val() === true)`) } }
  const postReceiptUser = userAfter(2)
  u.batchHead = { '.write': both(ready(1), 'newData.exists()', advancing(userAfter(1))), ...closed(['sequence', 'slot', 'intent'], { sequence: leaf(integer()), slot: leaf(integer(63, 0)), intent: leaf(key) }) }
  u.batchReceipts = {
    '.write': both(ready(1), '!newData.exists()', `${userAfter(1)}.child('purgeContext').exists()`, `${user}.child('bookLifecycle').child(${userAfter(1)}.child('purgeContext/bookId').val()).child('state').val() === 'deleting'`, `${userAfter(1)}.child('bookLifecycle').child(${userAfter(1)}.child('purgeContext/bookId').val()).child('state').val() === 'deleted'`),
    '$slot': {
      '.write': both(ready(2), 'newData.exists()', advancing(postReceiptUser), `$slot === ${head(postReceiptUser)}.child('slot').val() + ''`, "newData.child('sequence').val() === " + head(postReceiptUser) + ".child('sequence').val()", "newData.child('intent').val() === " + head(postReceiptUser) + ".child('intent').val()"),
      ...closed(['uid', 'sequence', 'intent', 'guards'], { uid: leaf('newData.val() === $uid'), sequence: leaf(integer()), intent: leaf(key), guards: { '.validate': `newData.hasChildren(${JSON.stringify(Array.from({ length: MAX_ROWS }, (_, i) => String(i)))})`, '$guard': { ...guard, '.validate': both("$guard.matches(/^(0|[1-9]|[12][0-9]|3[01])$/)", guard['.validate']) } }, entries, activity }),
    },
  }
  const memberPost = userAfter(5), candidate = receipt(memberPost)
  const memberGuard = `${candidate}.child('guards').child(${candidate}.child('entries').child($bookId).child($collectionId).val())`
  u.bookData.$bookId.$g.collectionMemberships.$collectionId['.write'] = both(ready(5), advancing(memberPost), 'newData.exists()', `${memberGuard}.child('enabled').val() === true`, `${memberGuard}.child('bookId').val() === $bookId`, `${memberGuard}.child('collectionId').val() === $collectionId`, `${memberGuard}.child('generation').val() + '' === $g`)
  u.collectionActivity = { '$collectionId': {
    '.write': both(ready(2), 'newData.exists()', advancing(userAfter(2)), `${receipt(userAfter(2))}.child('activity').child($collectionId).exists()`),
    ...closed(['at', 'catalogCreatedAt'], { at: leaf('newData.val() === now'), catalogCreatedAt: leaf(`newData.val() === ${user}.child('collectionCatalog').child($collectionId).child('createdAt').val()`) }),
  } }
  // A book purge clears the bounded receipt ring, including references to this
  // book. Sequence remains durable; evicted evidence never authorizes replay.
  const purgePost = userAfter(1)
  u.purgeContext = { '.write': both(ready(1), 'newData.exists()', `${user}.child('bookLifecycle').child(newData.child('bookId').val()).child('state').val() === 'deleting'`, `${user}.child('bookLifecycle').child(newData.child('bookId').val()).child('generation').val() === newData.child('generation').val()`, `${purgePost}.child('bookLifecycle').child(newData.child('bookId').val()).child('state').val() === 'deleted'`, `!${purgePost}.child('bookData').child(newData.child('bookId').val()).exists()`, `!${purgePost}.child('batchReceipts').exists()`), ...closed(['bookId', 'generation'], { bookId: leaf(key), generation: leaf(integer()) }) }
  u.bookData.$bookId.$g['.write'] = both(u.bookData.$bookId.$g['.write'], `!${userAfter(3)}.child('batchReceipts').exists()`)
  u.bookLifecycle.$bookId['.write'] = both(u.bookLifecycle.$bookId['.write'], `newData.child('state').val() !== 'deleted' || !${userAfter(2)}.child('batchReceipts').exists()`)
  // External fence survives the complete user purge.
  const newRoot = up('newData', 2)
  rules.rules.accountControl = { '$uid': {
    '.read': owner,
    '.write': both(owner, 'newData.exists()', either([
      both('!data.exists()', "newData.child('state').val() === 'active'", "newData.child('legacyClosed').val() === false"),
      both("data.child('state').val() === 'active'", "newData.child('state').val() === 'active'", "data.child('legacyClosed').val() === false", "newData.child('legacyClosed').val() === true", `${newRoot}.child('users').child($uid).child('bookProtocol/state').val() === 'migrating'`, `${newRoot}.child('users').child($uid).child('bookMigration').exists()`),
      both("data.child('state').val() === 'active'", "newData.child('state').val() === 'deleting'", "newData.child('legacyClosed').val() === true"),
      both("data.child('state').val() === 'deleting'", "newData.child('state').val() === 'deleted'", "newData.child('legacyClosed').val() === true", `!${newRoot}.child('users').child($uid).exists()`),
    ])),
    ...closed(['state', 'legacyClosed'], { state: leaf("newData.val() === 'active' || newData.val() === 'deleting' || newData.val() === 'deleted'"), legacyClosed: leaf('newData.isBoolean()') }),
  } }
  function forbidPriorities(node) {
    // Boolean false is a deliberate closed-schema denial, not a missing rule.
    node['.validate'] = both(node['.validate'] ?? 'true', 'newData.getPriority() === null')
    for (const [name, value] of Object.entries(node)) if (!name.startsWith('.') && typeof value === 'object') forbidPriorities(value)
  }
  forbidPriorities(u.batchReceipts)
  assert.equal(u.bookData['.write'], undefined)
  assert.equal(u.collectionCatalog['.write'], undefined)
  return JSON.stringify(rules, null, 2) + '\n'
}
export async function verify() {
  assert.equal(await readFile(new URL('database.rules.json', import.meta.url), 'utf8'), await compose())
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check') { await verify(); console.log('FEASIBILITY_RULES_VERIFIED') }
  else { assert.equal(process.argv.length, 2); await writeFile(new URL('database.rules.json', import.meta.url), await compose()) }
}
