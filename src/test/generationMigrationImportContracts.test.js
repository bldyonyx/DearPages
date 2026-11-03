import { describe, expect, it } from 'vitest'
import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { createCollectionContext } from '../utils/generationCollectionContracts.js'
import { createMigrationIdentity, createMigrationUnit, createMigrationDiagnostic, createMigrationPlan, validateMigrationPlan, createMigrationCheckpoint, advanceMigrationCheckpoint, createMigrationTransition, reconcileMigrationTransition, assertMigrationReady, validateMigrationUnit, assertSameMigrationPlan } from '../utils/generationMigrationContracts.js'
import { createGenerationImport, validateGenerationImport, reconcileGenerationImport, validateImportedHtml } from '../utils/generationImportContracts.js'

const hash = 'a'.repeat(64)
const migration = createMigrationIdentity({ uid: 'owner', migrationId: 'migration', transformVersion: 1 })
const context = createBookMutationContext({ uid: 'owner', bookId: 'book', generation: 1 })
const collection = createCollectionContext({ uid: 'owner', collectionId: 'collection', epoch: 1 })
const unit = createMigrationUnit({ migration, kind: 'library', scope: ['book'] })
const library = { id: 'book', title: 'Book', status: 'finished', addedAt: 17, finishedAt: -1000, authors: ['Author'], note: '<b>Old note</b>', review: 'Review', rating: 4 }
const note = { title: ' Note ', contentHtml: '<p>Exact</p>', date: '2024-02-29', createdAt: 10, updatedAt: 15, isPinned: true }
const generationNote = { ...note, creation: hash, fieldRevisions: { title: 3, contentHtml: 4, date: 1 } }
const rating = { value: 4, date: '2024-02-29', revision: 7, createdAt: 2, updatedAt: 8, impression: ' Exact ' }
const legacyCollection = { name: ' Name ', description: ' Description ', icon: 'library', pinned: true, createdAt: 1, updatedAt: 3, books: { book: true } }
const generationCollection = { name: 'Name', description: '', icon: 'library', pinned: true, createdAt: 1, updatedAt: 3, membershipEpoch: 1, revision: 4, creation: hash, fieldRevisions: { name: 1, description: 1, icon: 1, pinned: 2 } }
const entryId = '-1234567890123456789'
const envelope = (kind, payload, profile = 'legacy', id = null, scope = context) => createGenerationImport({ migration, kind, profile, context: scope, entryId: id, payload })
const plan = () => createMigrationPlan({ migration, sourceVersion: hash, units: [unit], diagnostics: [] })

describe('migration identities, plans and transitions', () => {
  it('refuses to replace a frozen plan with another source version on retry', () => {
    expect(assertSameMigrationPlan(plan(), plan())).toEqual(plan())
    const changed = createMigrationPlan({ migration, sourceVersion: 'b'.repeat(64), units: [unit], diagnostics: [] })
    expect(() => assertSameMigrationPlan(plan(), changed)).toThrow()
  })
  it('uses unambiguous deterministic unit identities without a clock or hash computation', () => {
    expect(createMigrationUnit({ migration, kind: 'library', scope: ['book'] })).toEqual(unit)
    expect(unit.unitId).not.toBe(createMigrationUnit({ migration, kind: 'note', scope: ['book', 'n'] }).unitId)
    expect(Object.isFrozen(unit.scope)).toBe(true)
    expect(() => validateMigrationUnit(Object.freeze({ ...unit, unitId: 'forged' }))).toThrow()
  })
  it('captures a plan defensively and refuses cross-migration or unknown diagnostic units', () => {
    const units = [unit], captured = createMigrationPlan({ migration, sourceVersion: hash, units, diagnostics: [] })
    units.length = 0
    expect(captured.units).toHaveLength(1)
    expect(validateMigrationPlan(captured)).toEqual(captured)
    const other = createMigrationUnit({ migration: createMigrationIdentity({ ...migration, migrationId: 'other' }), kind: 'library', scope: ['book'] })
    expect(() => createMigrationPlan({ migration, sourceVersion: hash, units: [other], diagnostics: [] })).toThrow()
    const diagnostic = createMigrationDiagnostic({ migration, unitId: 'unknown', code: 'orphan', field: 'bookId' })
    expect(() => createMigrationPlan({ migration, sourceVersion: hash, units: [unit], diagnostics: [diagnostic] })).toThrow()
  })
  it.each(['invalid-id', 'unknown-field', 'incompatible-source', 'orphan', 'marker-conflict'])('keeps %s blocking without a silent repair', code => {
    const diagnostic = createMigrationDiagnostic({ migration, unitId: unit.unitId, code, field: 'title' })
    const blocked = createMigrationPlan({ migration, sourceVersion: hash, units: [unit], diagnostics: [diagnostic] })
    expect(blocked.status).toBe('blocked')
    expect(() => createMigrationDiagnostic({ migration, unitId: null, code, field: '<private content>' })).toThrow()
    const checkpoint = createMigrationCheckpoint({ migration, stage: 'complete', completedUnits: [unit] })
    expect(() => assertMigrationReady(blocked, checkpoint, { source: 'server', legacyClosed: true, legacyPurged: true, accountActive: true })).toThrow()
  })
  it('advances adjacent stages and completed sets monotonically', () => {
    const before = createMigrationCheckpoint({ migration, stage: 'planned', completedUnits: [] })
    const next = createMigrationCheckpoint({ migration, stage: 'imported', completedUnits: [unit] })
    expect(advanceMigrationCheckpoint(before, next)).toEqual(next)
    expect(advanceMigrationCheckpoint(next, next)).toEqual(next)
    expect(() => advanceMigrationCheckpoint(next, before)).toThrow()
    expect(() => advanceMigrationCheckpoint(before, createMigrationCheckpoint({ migration, stage: 'verified', completedUnits: [unit] }))).toThrow()
    expect(() => advanceMigrationCheckpoint(next, createMigrationCheckpoint({ migration, stage: 'verified', completedUnits: [] }))).toThrow()
  })
  it('requires complete matching units and explicit supplied server evidence for ready', () => {
    const complete = createMigrationCheckpoint({ migration, stage: 'complete', completedUnits: [unit] })
    const evidence = { source: 'server', legacyClosed: true, legacyPurged: true, accountActive: true }
    expect(assertMigrationReady(plan(), complete, evidence)).toBe(true)
    for (const key of ['legacyClosed', 'legacyPurged', 'accountActive']) expect(() => assertMigrationReady(plan(), complete, { ...evidence, [key]: false })).toThrow()
    expect(() => assertMigrationReady(plan(), complete, { ...evidence, source: 'cache' })).toThrow()
    expect(() => assertMigrationReady(plan(), createMigrationCheckpoint({ migration, stage: 'complete', completedUnits: [] }), evidence)).toThrow()
  })
  it.each([['ready', 'migrating'], ['ready', 'absent'], ['migrating', 'absent'], ['absent', 'ready']])('rejects transition %s to %s', (from, to) => {
    expect(() => createMigrationTransition({ migration, intentId: 'intent', from, to })).toThrow()
  })
  it('never retargets a retry to another migration or transformation version', () => {
    const intent = createMigrationTransition({ migration, intentId: 'intent', from: 'absent', to: 'migrating' })
    const observed = { source: 'server', migration, state: 'migrating', legacyClosed: true }
    expect(reconcileMigrationTransition(intent, observed)).toMatchObject({ status: 'confirmed', canRetry: false })
    for (const other of [createMigrationIdentity({ ...migration, migrationId: 'other' }), createMigrationIdentity({ ...migration, transformVersion: 2 })]) expect(reconcileMigrationTransition(intent, { ...observed, migration: other })).toMatchObject({ status: 'stale', canRetry: false })
    expect(reconcileMigrationTransition(intent, { ...observed, source: 'unavailable' })).toMatchObject({ status: 'uncertain', canRetry: false })
    expect(reconcileMigrationTransition(intent, { source: 'server', migration: null, state: 'absent', legacyClosed: false })).toMatchObject({ status: 'pending', canRetry: true })
  })
  it.each([0, -1, 1.5, 2147483648, NaN])('rejects invalid transformation version %s', transformVersion => {
    expect(() => createMigrationIdentity({ ...migration, transformVersion })).toThrow()
  })
})

describe('faithful import envelopes (no CRUD, normalization or conversion)', () => {
  it.each([
    ['library', library, 'legacy', null, context],
    ['note', note, 'legacy', 'n', context],
    ['note', generationNote, 'generation', 'n', context],
    ['note', { deleted: true, createdAt: 5 }, 'generation', 'n', context],
    ['rating', rating, 'legacy', entryId, context],
    ['rating', { deleted: true, createdAt: 2, updatedAt: 9, revision: 8 }, 'generation', entryId, context],
    ['rating', { ...rating, date: '' }, 'legacy', 'legacy-rating-v1', context],
    ['historicalSources', { note: '<b>Source</b>', review: '', rating: 3 }, 'legacy', null, context],
    ['noteMarker', { version: 1, outcome: 'copied', sourceHtml: '<b>Original</b>', processedAt: 12 }, 'legacy', null, context],
    ['reviewMarker', { version: 1, outcome: 'empty', sourceHtml: '', processedAt: 12, intent: hash }, 'generation', null, context],
    ['ratingMarker', { version: 1, sourceValue: 4, processedAt: 12 }, 'legacy', null, context],
    ['collection', legacyCollection, 'legacy', null, collection],
    ['collection', generationCollection, 'generation', null, collection],
    ['collection', { deleted: true, createdAt: 1, membershipEpoch: 1, revision: 8 }, 'generation', null, collection],
    ['membership', { epoch: 1, present: false, revision: 9 }, 'generation', 'collection', context],
  ])('preserves exact %s payload, profile %s', (kind, payload, profile, id, scope) => {
    const result = envelope(kind, payload, profile, id, scope)
    expect(result.payload).toEqual(payload)
    expect(Object.isFrozen(result.payload)).toBe(true)
    expect(validateGenerationImport(result)).toEqual(result)
    expect(envelope(kind, payload, profile, id, scope)).toEqual(result)
  })
  it('preserves a previously processed marker without recreating a missing copy', () => {
    const marker = envelope('noteMarker', { version: 1, outcome: 'copied', sourceHtml: 'Source', processedAt: 4 })
    expect(marker).not.toHaveProperty('destination')
    expect(marker.payload).not.toHaveProperty('intent')
    expect(marker.type).toBe('migration.import')
  })
  it('preserves maximum revisions and counters rather than initializing them again', () => {
    expect(envelope('rating', { ...rating, revision: Number.MAX_SAFE_INTEGER }, 'generation', entryId).payload.revision).toBe(Number.MAX_SAFE_INTEGER)
    expect(envelope('membership', { epoch: 2147483647, present: true, revision: 2147483647 }, 'generation', 'collection').payload.epoch).toBe(2147483647)
  })
  it.each([
    ['library', { ...library, authors: [] }, 'legacy', null],
    ['library', { ...library, cover: null }, 'legacy', null],
    ['library', { ...library, id: 'other' }, 'legacy', null],
    ['library', { ...library, title: 'x'.repeat(201) }, 'legacy', null],
    ['library', { ...library, unexpected: 1 }, 'legacy', null],
    ['note', { ...note, contentHtml: '<img src=x>keep' }, 'legacy', 'n'],
    ['note', { ...note, date: '2023-02-29' }, 'legacy', 'n'],
    ['note', { ...generationNote, fieldRevisions: { title: 0, contentHtml: 1, date: 1 } }, 'generation', 'n'],
    ['note', { deleted: true, createdAt: 1, contentHtml: 'deleted content' }, 'generation', 'n'],
    ['rating', { ...rating, revision: 0 }, 'legacy', entryId],
    ['rating', { ...rating, date: '' }, 'legacy', entryId],
    ['rating', { ...rating, updatedAt: 0 }, 'legacy', entryId],
    ['noteMarker', { version: 1, outcome: 'empty', sourceHtml: 'nonempty', processedAt: 1 }, 'legacy', null],
    ['noteMarker', { version: 1, outcome: 'copied', sourceHtml: 'text', processedAt: 1 }, 'generation', null],
    ['historicalSources', {}, 'legacy', null],
    ['historicalSources', { note: 4 }, 'legacy', null],
    ['membership', true, 'legacy', 'collection'],
  ])('refuses incompatible %s data without changing the input', (kind, payload, profile, id) => {
    const before = structuredClone(payload)
    expect(() => envelope(kind, payload, profile, id)).toThrow()
    expect(payload).toEqual(before)
  })
  it('refuses silent catalog defaults and bad legacy relationships', () => {
    for (const payload of [{ ...legacyCollection, name: ' ' }, { ...legacyCollection, icon: '' }, { ...legacyCollection, books: { book: false } }, { ...legacyCollection, extra: true }]) expect(() => envelope('collection', payload, 'legacy', null, collection)).toThrow()
    const epoch2 = { ...generationCollection, membershipEpoch: 2, lastClearFrom: 1, lastClearId: entryId }
    expect(() => envelope('collection', epoch2, 'generation', null, collection)).toThrow()
    expect(envelope('collection', epoch2, 'generation', null, createCollectionContext({ ...collection, epoch: 2 })).payload.membershipEpoch).toBe(2)
  })
  it('does not accept retargeting to another user or readded generation', () => {
    expect(() => envelope('library', library, 'legacy', null, createBookMutationContext({ ...context, uid: 'other' }))).toThrow()
    expect(() => envelope('library', library, 'legacy', null, createBookMutationContext({ ...context, generation: 2 }))).toThrow()
  })
  it('reconciles only the original unit and supplied server state', () => {
    const intent = envelope('library', library)
    const observed = { source: 'server', migration, unit: intent.unit, payload: library, accountActive: true, protocolState: 'migrating' }
    expect(reconcileGenerationImport(intent, observed)).toMatchObject({ status: 'confirmed', canRetry: false })
    expect(reconcileGenerationImport(intent, { ...observed, payload: null })).toMatchObject({ status: 'not-committed', canRetry: true })
    expect(reconcileGenerationImport(intent, { ...observed, payload: { ...library, addedAt: 18 } })).toMatchObject({ status: 'conflict', canRetry: false })
    expect(reconcileGenerationImport(intent, { ...observed, source: 'unavailable' })).toMatchObject({ status: 'uncertain', canRetry: false })
    expect(reconcileGenerationImport(intent, { ...observed, accountActive: false })).toMatchObject({ status: 'blocked', canRetry: false })
    expect(reconcileGenerationImport(intent, { ...observed, protocolState: 'ready' })).toMatchObject({ status: 'blocked', canRetry: false })
    expect(reconcileGenerationImport(intent, { ...observed, unit: createMigrationUnit({ migration, kind: 'library', scope: ['other'] }) })).toMatchObject({ status: 'stale', canRetry: false })
  })
  it.each(['<script>bad</script>', '<p style="color:red">text</p>', '<BR>', 'x'.repeat(200001), '\u0000'])('does not sanitize unsupported HTML %#', input => {
    expect(() => validateImportedHtml(input)).toThrow()
  })
})
