import { createMigrationIdentity, createMigrationDiagnostic, createMigrationPlan } from './generationMigrationContracts.js'
import { createGenerationImport, validateImportedHtml } from './generationImportContracts.js'
import { createBookMutationContext } from './bookMutationContext.js'
import { createCollectionContext } from './generationCollectionContracts.js'
import { bookLibraryPath, bookNotesPath, bookRatingsPath, bookNotesLegacyPath, bookReviewsLegacyPath, bookRatingsLegacyPath, bookCollectionMembershipsPath, collectionCatalogPath } from './bookGenerationPaths.js'
import { validateGenerationLibraryRecord } from './generationLibraryModel.js'
import { canonicalContract, compareContractIds, contractData, contractBoolean, contractTimestamp, boundedCounter } from './generationContractData.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { isCivilDate } from './civilDateUtils.js'

export const HISTORICAL_TRANSFORM_VERSION = 1
export const HISTORICAL_BRANCHES = Object.freeze(['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections'])
const markerKinds = { bookNotesLegacy: 'noteMarker', bookReviewsLegacy: 'reviewMarker', bookRatingsLegacy: 'ratingMarker' }
const reserved = { noteMarker: 'legacy-note-v1', reviewMarker: 'legacy-review-v1', ratingMarker: 'legacy-rating-v1' }
const sourceFields = { noteMarker: 'note', reviewMarker: 'review', ratingMarker: 'rating' }
const markerPaths = { noteMarker: bookNotesLegacyPath, reviewMarker: bookReviewsLegacyPath, ratingMarker: bookRatingsLegacyPath }
const libraryRequired = ['id', 'title', 'status', 'addedAt']
const libraryOptional = ['updatedAt', 'googleBooksId', 'isbn', 'cover', 'publishedDate', 'description', 'source', 'openLibraryId', 'authors', 'isbns', 'categories', 'startedAt', 'finishedAt', 'abandonedAt', 'note', 'review', 'rating']
const noteRequired = ['title', 'contentHtml', 'date', 'createdAt', 'updatedAt', 'isPinned']
const collectionRequired = ['name', 'description', 'icon', 'pinned', 'createdAt', 'updatedAt']
const ones = fields => Object.fromEntries(fields.map(field => [field, 1]))
const text = value => { if (typeof value !== 'string') throw new TypeError('Expected stored text.') }
const nonblank = value => { text(value); if (!value.trim()) throw new TypeError('Expected nonblank stored text.') }
const civilDate = value => { if (!isCivilDate(value)) throw new TypeError('Invalid civil date.') }
const ratingValue = value => boundedCounter(value, 5)
const revision = value => boundedCounter(value, Number.MAX_SAFE_INTEGER)
// eslint-disable-next-line no-control-regex -- Same byte-preserving title policy as generationImportContracts.
const noteTitle = value => { text(value); if (value.length > 200 || /[\u0000-\u001f\u007f<>]/u.test(value)) throw new TypeError('Invalid note title.') }
// eslint-disable-next-line no-control-regex -- Same stored impression policy as generationImportContracts.
const impression = value => { text(value); if (value.length > 160 || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError('Invalid impression.') }
const path = segments => segments.join('/')

/** SHA-256 of domain-separated canonical JSON encoded as UTF-8. These local
 * preparation fingerprints are neither legacy source tokens nor attestations.
 * Web Crypto is deterministic computation only; no network/SDK/clock is used. */
async function digest(domain, value) {
  const bytes = new TextEncoder().encode(canonicalContract(['dear-pages/historical-transform', HISTORICAL_TRANSFORM_VERSION, domain, value]))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Transform a raw users/{uid} VALUE (not a Firebase Snapshot or display model).
 * Context is exactly {uid,migrationId,transformVersion}; only version 1 exists.
 * Input is captured synchronously before the first await. Missing roots are
 * inventoried as absent. Null means an absent user node, never a fabricated book.
 *
 * Returns prepared import envelopes + separate historical/technical provenance,
 * or blocked with plan:null and destinations:[]. 'prepared' is local structural
 * compatibility ONLY, not approval, verification, readiness or completion.
 * profile/preferences are retained in place. Unknown roots and pre-existing
 * generation state block. No lifecycle state, protocol, account, write map,
 * checkpoint, cleanup or deletion operation is emitted.
 */
export async function transformHistoricalSnapshot(snapshot, context) {
  const migration = createMigrationIdentity(context)
  if (migration.transformVersion !== HISTORICAL_TRANSFORM_VERSION) throw new RangeError('Unsupported historical transformation version.')
  const base = ['users', migration.uid], diagnostics = []
  function report(segments, code, reason, value) {
    const field = segments.at(-1)
    diagnostics.push({
      diagnostic: createMigrationDiagnostic({ migration, unitId: null, code, field: /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field) ? field : 'source' }),
      sourcePath: path(segments), sourceSegments: segments,
      reason, observedType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    })
  }
  // Inspect descriptors, including export priorities and unsafe keys, BEFORE
  // contractData. Never invoke getters/toJSON or filter/compact numeric arrays.
  function capture(value, segments, ancestors = new Set()) {
    if (value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value
    if (!value || typeof value !== 'object' || ancestors.has(value)) {
      report(segments, 'incompatible-source', 'Non-JSON value or cyclic source; consult the unchanged source at sourceSegments.', value); return null
    }
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value)
    if (prototype !== (array ? Array.prototype : Object.prototype)) {
      report(segments, 'incompatible-source', 'Only ordinary raw JSON records/arrays are supported.', value); return null
    }
    const next = new Set(ancestors).add(value), descriptors = Object.getOwnPropertyDescriptors(value), entries = []
    for (const key of Reflect.ownKeys(descriptors).sort((a, b) => compareContractIds(String(a), String(b)))) {
      if (array && key === 'length') continue
      const child = [...segments, String(key)], descriptor = descriptors[key]
      if (typeof key !== 'string') { report(child, 'invalid-field', 'Symbolic property is not RTDB data.', undefined); continue }
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        report(child, 'incompatible-source', 'Hidden/accessor source property; it was not evaluated.', undefined); continue
      }
      try { validateRtdbPathSegment(key) } catch {
        report(child, 'invalid-id', key === '.priority' || key === '.value' ? 'RTDB export priority/wrapper needs explicit treatment; never stripped.' : 'Unsupported source key; never renamed or omitted from a valid plan.', descriptor.value)
        capture(descriptor.value, child, next); continue
      }
      entries.push([key, capture(descriptor.value, child, next)])
    }
    if (array) {
      const length = descriptors.length.value
      if (entries.length !== length || entries.some(([key]) => !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) {
        report(segments, 'incompatible-source', 'Sparse/decorated array; numeric indices must not be compacted.', value); return null
      }
      const result = Array(length)
      for (const [key, item] of entries) result[Number(key)] = item
      return Object.freeze(result)
    }
    return Object.freeze(Object.fromEntries(entries))
  }
  const captured = snapshot === null ? null : capture(snapshot, base)
  const source = captured ?? {}
  function map(value, segments) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      report(segments, 'incompatible-source', 'Expected a stored record/map, not a scalar, array or null.', value); return null
    }
    return value
  }
  if (snapshot !== null) map(captured, base)
  const structurallyValid = diagnostics.length === 0
  // A structural error prevents hashing or returning a partially captured source.
  function result(sourceVersion, inventory, destinations, plan, retained, books) {
    diagnostics.sort((a, b) => compareContractIds(canonicalContract(a), canonicalContract(b)))
    return contractData({ type: 'historical.preparation', transformVersion: HISTORICAL_TRANSFORM_VERSION, migration,
      status: diagnostics.length ? 'blocked' : 'prepared', sourceVersion, inventory, diagnostics,
      // The raw captured source is retained for diagnosis, not a journal or write.
      source: structurallyValid ? captured : null,
      retained, books, destinations: diagnostics.length ? [] : destinations, plan: diagnostics.length ? null : plan })
  }
  if (diagnostics.length) return result(null, [], [], null, [], [])
  for (const key of Object.keys(source)) {
    if (![...HISTORICAL_BRANCHES, 'profile', 'preferences'].includes(key)) {
      report([...base, key], ['bookProtocol', 'bookData', 'bookLifecycle', 'collectionCatalog'].includes(key) ? 'identity-conflict' : 'unknown-field', 'Root outside the historical mapping; preserved, no implicit coverage or reset.', source[key])
    }
  }
  const inventory = HISTORICAL_BRANCHES.map(branch => ({ branch, sourcePath: path([...base, branch]), present: Object.hasOwn(source, branch) }))
  const historical = Object.fromEntries(HISTORICAL_BRANCHES.filter(branch => Object.hasOwn(source, branch)).map(branch => [branch, source[branch]]))
  const sourceVersion = await digest('source', historical)
  const roots = {}
  for (const branch of HISTORICAL_BRANCHES) roots[branch] = Object.hasOwn(source, branch) ? map(source[branch], [...base, branch]) : {}
  const retained = ['profile', 'preferences'].filter(branch => Object.hasOwn(source, branch)).map(branch => ({ sourcePath: path([...base, branch]), payload: source[branch] }))
  const destinations = [], books = [], validBooks = new Set(), markerUnits = new Map(), bookUnits = new Map()
  const bookContext = bookId => createBookMutationContext({ uid: migration.uid, bookId, generation: 1 })
  const technicalIdentity = (segments, payload) => digest('technical-identity', { migration, sourcePath: path(segments), payload })
  function shape(value, segments, required, optional = [], validators = {}) {
    const before = diagnostics.length
    if (!map(value, segments)) return false
    for (const key of required) if (!Object.hasOwn(value, key)) report([...segments, key], 'missing-required', 'Required stored value is absent; no default/backfill is permitted.', undefined)
    for (const key of Object.keys(value)) {
      if (![...required, ...optional].includes(key)) report([...segments, key], 'unknown-field', 'Field is outside the supported historical schema; never discarded.', value[key])
      else if (validators[key]) {
        try { validators[key](value[key]) } catch { report([...segments, key], 'invalid-field', 'Stored value is incompatible with the import contract; no normalization is permitted.', value[key]) }
      }
    }
    if (Object.hasOwn(value, 'createdAt') && Object.hasOwn(value, 'updatedAt') && value.updatedAt < value.createdAt) report([...segments, 'updatedAt'], 'contradictory-state', 'updatedAt precedes createdAt.', value.updatedAt)
    return diagnostics.length === before
  }
  function emit(kind, scope, entryId, segments, historicalPayload, technical, destinationPath, dependencies = []) {
    try {
      const intent = createGenerationImport({ migration, kind, profile: 'generation', context: scope, entryId, payload: kind === 'membership' ? { present: historicalPayload, ...technical } : { ...historicalPayload, ...technical } })
      destinations.push({ sourcePath: path(segments), sourceSegments: segments, destinationPath, historical: historicalPayload, technical, dependencies, intent })
      return intent.unit.unitId
    } catch {
      report(segments, 'incompatible-source', 'Record rejected by the existing generation import contract; source remains unchanged.', historicalPayload)
      return null
    }
  }
  for (const [bookId, record] of Object.entries(roots.library || {})) {
    const segments = [...base, 'library', bookId], scope = bookContext(bookId)
    const validators = Object.fromEntries([...libraryRequired, ...libraryOptional].filter(field => field !== 'id').map(field => [field, value => {
      const minimal = { id: bookId, title: '', status: 'to-read', addedAt: 0, [field]: value }
      const checked = validateGenerationLibraryRecord(scope, minimal)
      if (canonicalContract(minimal) !== canonicalContract(checked)) throw new TypeError('Would normalize source.')
      if (['authors', 'isbns', 'categories'].includes(field) && !Array.isArray(value)) throw new TypeError('Numeric object/list conversion is not approved.')
      if (['note', 'review'].includes(field)) validateImportedHtml(value)
    }]))
    if (!shape(record, segments, libraryRequired, libraryOptional, validators)) continue
    if (record.id !== bookId) { report([...segments, 'id'], 'identity-conflict', 'Stored library id differs from its key; never recalculated.', record.id); continue }
    const unitId = emit('library', scope, null, segments, record, {}, bookLibraryPath(scope))
    if (unitId) { validBooks.add(bookId); bookUnits.set(bookId, unitId); books.push({ sourcePath: path(segments), context: scope, requiresLifecycleInitialization: true }) }
  }
  function hasBook(bookId, segments) {
    if (validBooks.has(bookId)) return true
    report(segments, Object.hasOwn(roots.library || {}, bookId) ? 'incompatible-source' : 'orphan', 'No admissible source library record; no book is synthesized.', undefined)
    return false
  }
  // Markers are imported independently of surviving/edited copies. Divergent
  // current sources block pending an explicit policy; neither side is rewritten.
  for (const [branch, kind] of Object.entries(markerKinds)) {
    for (const [bookId, marker] of Object.entries(roots[branch] || {})) {
      const segments = [...base, branch, bookId], scope = bookContext(bookId)
      const isRating = kind === 'ratingMarker'
      const fields = isRating ? ['version', 'sourceValue', 'processedAt'] : ['version', 'outcome', 'sourceHtml', 'processedAt']
      const validators = { version: value => { if (value !== 1) throw new TypeError('Unsupported marker version.') }, processedAt: contractTimestamp,
        sourceValue: ratingValue, sourceHtml: validateImportedHtml, outcome: value => { if (!['empty', 'copied'].includes(value)) throw new TypeError('Invalid outcome.') } }
      const valid = shape(marker, segments, fields, [], validators), parent = hasBook(bookId, segments)
      if (!valid || !parent) continue
      if (!isRating && (marker.outcome === 'empty') !== (marker.sourceHtml === '')) {
        report([...segments, 'outcome'], 'marker-conflict', 'Marker outcome contradicts its captured source.', marker.outcome); continue
      }
      const field = sourceFields[kind], original = roots.library[bookId], prior = isRating ? marker.sourceValue : marker.sourceHtml
      if (original[field] !== prior && !(original[field] === undefined && prior === '')) {
        report(segments, 'marker-conflict', 'Current library source and captured marker source differ; both retained, divergence policy unresolved.', marker)
      }
      const technical = isRating ? {} : { intent: await technicalIdentity(segments, marker) }
      markerUnits.set(`${kind}:${bookId}`, emit(kind, scope, null, segments, marker, technical, markerPaths[kind](scope), [bookUnits.get(bookId)]))
    }
  }
  for (const branch of ['bookNotes', 'bookRatings']) {
    const isNote = branch === 'bookNotes'
    for (const [bookId, records] of Object.entries(roots[branch] || {})) {
      const parentPath = [...base, branch, bookId], parent = hasBook(bookId, parentPath)
      const entries = map(records, parentPath)
      if (!entries) continue
      for (const [entryId, record] of Object.entries(entries)) {
        const segments = [...parentPath, entryId], scope = bookContext(bookId)
        const deleted = record?.deleted === true
        const fields = isNote ? noteRequired : deleted ? ['deleted', 'createdAt', 'updatedAt', 'revision'] : ['value', 'date', 'revision', 'createdAt', 'updatedAt']
        const validators = { title: noteTitle, contentHtml: validateImportedHtml, date: value => {
          if (!isNote && entryId === reserved.ratingMarker && value === '') return
          civilDate(value)
        }, isPinned: contractBoolean, createdAt: contractTimestamp, updatedAt: contractTimestamp, value: ratingValue, revision, impression,
        deleted: value => { if (value !== true) throw new TypeError('Invalid tombstone.') } }
        const valid = shape(record, segments, fields, isNote ? [] : deleted ? [] : ['impression'], validators)
        if (isNote && deleted) report(segments, 'contradictory-state', 'Historical note storage has no persisted tombstone schema; it cannot be inferred or silently treated as generation data.', record)
        if (!isNote && !/^-[A-Za-z0-9_-]{19}$/.test(entryId) && entryId !== reserved.ratingMarker) report(segments, 'invalid-id', 'Rating identity is neither a push ID nor the reserved historical rating ID.', entryId)
        if (!isNote && deleted && record.revision < 2) report([...segments, 'revision'], 'invalid-field', 'A rating tombstone requires revision >= 2.', record.revision)
        if (!valid || !parent || isNote && deleted) continue
        let creation
        const dependencies = [bookUnits.get(bookId)]
        const kind = Object.keys(reserved).find(key => reserved[key] === entryId && (isNote ? key !== 'ratingMarker' : key === 'ratingMarker'))
        if (kind) {
          const markerBranch = Object.keys(markerKinds).find(key => markerKinds[key] === kind), marker = roots[markerBranch]?.[bookId]
          if (!marker || isNote && marker.outcome !== 'copied') {
            report(segments, 'marker-conflict', 'Reserved copy lacks its matching copied marker; no marker is fabricated.', record); continue
          }
          creation = await technicalIdentity([...base, markerBranch, bookId], marker)
          if (markerUnits.get(`${kind}:${bookId}`)) dependencies.push(markerUnits.get(`${kind}:${bookId}`))
        } else if (isNote) creation = await technicalIdentity(segments, record)
        const technical = isNote ? { creation, fieldRevisions: ones(['title', 'contentHtml', 'date']) } : {}
        emit(isNote ? 'note' : 'rating', scope, entryId, segments, record, technical, isNote ? bookNotesPath(scope, entryId) : bookRatingsPath(scope, entryId), dependencies)
      }
    }
  }
  for (const [collectionId, record] of Object.entries(roots.collections || {})) {
    const segments = [...base, 'collections', collectionId]
    if (!shape(record, segments, collectionRequired, ['books'], { name: nonblank, description: text, icon: value => { text(value); if (!value.length) throw new TypeError('Missing icon.') }, pinned: contractBoolean, createdAt: contractTimestamp, updatedAt: contractTimestamp })) continue
    const { books: members, ...metadata } = record
    const scope = createCollectionContext({ uid: migration.uid, collectionId, epoch: 1 })
    const technical = { creation: await technicalIdentity(segments, record), membershipEpoch: 1, revision: 1, fieldRevisions: ones(['name', 'description', 'icon', 'pinned']) }
    const unitId = emit('collection', scope, null, segments, metadata, technical, collectionCatalogPath(migration.uid, collectionId))
    if (members === undefined) continue // A stored empty Collection has no books child.
    if (!map(members, [...segments, 'books'])) continue
    for (const [bookId, present] of Object.entries(members)) {
      const memberPath = [...segments, 'books', bookId], parent = hasBook(bookId, memberPath)
      if (present !== true) { report(memberPath, 'invalid-field', 'Only a stored true membership is supported; false/objects/null are never normalized.', present); continue }
      if (!parent || !unitId) continue
      const book = bookContext(bookId)
      emit('membership', book, collectionId, memberPath, present, { epoch: 1, revision: 1 }, bookCollectionMembershipsPath(book, collectionId), [bookUnits.get(bookId), unitId])
    }
  }
  destinations.sort((a, b) => compareContractIds(a.destinationPath, b.destinationPath))
  const plan = createMigrationPlan({ migration, sourceVersion, units: destinations.map(item => item.intent.unit), diagnostics: diagnostics.map(item => item.diagnostic) })
  return result(sourceVersion, inventory, destinations, plan, retained, books)
}
