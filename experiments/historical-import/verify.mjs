import { createMigrationIdentity } from '../../src/utils/generationMigrationContracts.js'
import { createGenerationImport } from '../../src/utils/generationImportContracts.js'
import { createBookMutationContext } from '../../src/utils/bookMutationContext.js'
import { createCollectionContext } from '../../src/utils/generationCollectionContracts.js'
import { canonicalContract, contractData } from '../../src/utils/generationContractData.js'
import { hash, receiptKey, receiptFor } from './protocol.mjs'

// Independent raw mapping: NEVER calls the transformer, accepts its destinations,
// or trusts completed counts/checkpoints as evidence. The source and target must
// be server observations of the same frozen/sealed account. No approval write.
export function verifyHistoricalImport(userInput, migrationInput, { sealed = true } = {}) {
  const migration = createMigrationIdentity(migrationInput), failures = []
  const fail = (path, reason) => failures.push({ path, reason })
  let checked = 0
  try {
    const user = contractData(userInput), control = user.historicalImport
    const branches = ['library', 'bookNotes', 'bookNotesLegacy', 'bookReviewsLegacy', 'bookRatings', 'bookRatingsLegacy', 'collections']
    const generated = ['bookProtocol', 'bookMigration', 'historicalImport', 'importReceipts', 'bookData', 'bookLifecycle', 'collectionCatalog']
    for (const key of Object.keys(user)) if (![...branches, ...generated, 'profile', 'preferences'].includes(key)) fail(key, 'unmapped-root')
    const source = Object.fromEntries(branches.filter(key => Object.hasOwn(user, key)).map(key => [key, user[key]]))
    for (const value of Object.values(source)) if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Invalid historical branch')
    const fingerprint = hash(['dear-pages/historical-transform', 1, 'source', source])
    if (migration.transformVersion !== 1 || user.bookMigration?.id !== migration.migrationId || user.bookMigration?.version !== 1 ||
      canonicalContract(user.bookProtocol) !== canonicalContract({ version: 2, state: 'migrating' }) || control?.sourceVersion !== fingerprint ||
      control?.stage !== 'imported' || control?.phase !== (sealed ? 'sealed' : 'open')) fail('historicalImport', 'unbound-or-unsealed-source')
    const expected = { bookData: {}, bookLifecycle: {}, collectionCatalog: {}, importReceipts: {} }
    const book = id => createBookMutationContext({ uid: migration.uid, bookId: id, generation: 1 })
    const technicalId = (branch, id, payload, entry) => hash(['dear-pages/historical-transform', 1, 'technical-identity', {
      migration, sourcePath: `users/${migration.uid}/${branch}/${id}${entry === undefined ? '' : `/${entry}`}`, payload,
    }])
    const ones = fields => Object.fromEntries(fields.map(field => [field, 1]))
    const requireBook = id => { if (!source.library?.[id]) throw new Error('Orphan source') }
    function add(kind, context, entryId, payload, assign) {
      const intent = createGenerationImport({ migration, kind, profile: 'generation', context, entryId, payload })
      assign(intent.payload)
      expected.importReceipts[receiptKey(intent.unit.unitId)] = receiptFor(intent)
      checked++
    }
    for (const [id, record] of Object.entries(source.library || {})) {
      expected.bookLifecycle[id] = { generation: 1, state: 'creating' }
      expected.bookData[id] = { 1: {} }
      add('library', book(id), null, record, payload => { expected.bookData[id][1].library = payload })
    }
    const markers = { bookNotesLegacy: ['noteMarker', 'note', 'legacy-note-v1'], bookReviewsLegacy: ['reviewMarker', 'review', 'legacy-review-v1'], bookRatingsLegacy: ['ratingMarker', 'rating', 'legacy-rating-v1'] }
    for (const [branch, [kind, field]] of Object.entries(markers)) for (const [id, record] of Object.entries(source[branch] || {})) {
      requireBook(id)
      createGenerationImport({ migration, kind, profile: 'legacy', context: book(id), entryId: null, payload: record })
      const captured = kind === 'ratingMarker' ? record.sourceValue : record.sourceHtml
      if (source.library[id][field] !== captured && !(source.library[id][field] === undefined && captured === '')) throw new Error('Marker/source divergence')
      const payload = kind === 'ratingMarker' ? record : { ...record, intent: technicalId(branch, id, record) }
      add(kind, book(id), null, payload, value => { expected.bookData[id][1][branch] = value })
    }
    for (const branch of ['bookNotes', 'bookRatings']) for (const [id, entries] of Object.entries(source[branch] || {})) {
      requireBook(id)
      for (const [entryId, record] of Object.entries(entries)) {
        const isNote = branch === 'bookNotes'
        let creation = isNote ? technicalId(branch, id, record, entryId) : null
        for (const [markerBranch, [kind, , reserved]] of Object.entries(markers)) {
          if (entryId !== reserved || isNote !== (kind !== 'ratingMarker')) continue
          const marker = source[markerBranch]?.[id]
          if (!marker || isNote && marker.outcome !== 'copied') throw new Error('Reserved copy without marker')
          if (isNote) creation = technicalId(markerBranch, id, marker)
        }
        if (isNote && (record.deleted || Object.hasOwn(record, 'creation') || Object.hasOwn(record, 'fieldRevisions'))) throw new Error('Not a historical note')
        const payload = isNote ? { ...record, creation, fieldRevisions: ones(['title', 'contentHtml', 'date']) } : record
        add(isNote ? 'note' : 'rating', book(id), entryId, payload, value => { (expected.bookData[id][1][branch] ??= {})[entryId] = value })
      }
    }
    for (const [id, record] of Object.entries(source.collections || {})) {
      const { books, ...metadata } = record
      const context = createCollectionContext({ uid: migration.uid, collectionId: id, epoch: 1 })
      createGenerationImport({ migration, kind: 'collection', profile: 'legacy', context, entryId: null, payload: record })
      add('collection', context, null, { ...metadata, creation: technicalId('collections', id, record), membershipEpoch: 1, revision: 1, fieldRevisions: ones(['name', 'description', 'icon', 'pinned']) }, value => { expected.collectionCatalog[id] = value })
      for (const [bookId, present] of Object.entries(books || {})) {
        requireBook(bookId)
        if (present !== true) throw new Error('Incompatible membership')
        add('membership', book(bookId), id, { epoch: 1, present: true, revision: 1 }, value => { (expected.bookData[bookId][1].collectionMemberships ??= {})[id] = value })
      }
    }
    // RTDB renders the GENERATED numeric generation map {1: ...} as
    // [null, ...]. Preserve indices; normalize this container only, never a
    // historical list, payload, metadata or record. Extra generations still fail.
    const observedBookData = Object.fromEntries(Object.entries(user.bookData || {}).map(([id, generations]) => [id,
      Object.fromEntries(Object.entries(generations).filter(([, value]) => value !== null)),
    ]))
    for (const [branch, value] of Object.entries(expected)) {
      const observed = branch === 'bookData' ? observedBookData : user[branch] || {}
      if (canonicalContract(observed) !== canonicalContract(value)) fail(branch, 'missing-excess-or-altered-content-including-technical-metadata')
    }
  } catch {
    fail('source', 'incompatible-source-or-observation')
  }
  return contractData({ status: failures.length ? 'blocked' : 'verified-unfinalized', checkedUnits: checked, failures, canApprove: false, canReady: false })
}
