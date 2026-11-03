/* eslint-disable no-control-regex -- Byte-preserving validation matching RTDB. */
import { contractArray, contractRecord, captureBookContext } from './generationOperationUtils.js'
import { captureCatalogContext, CATALOG_FIELDS, CATALOG_MAX_COUNTER, CATALOG_LAST_LIVE_REVISION } from './generationCollectionCatalogModel.js'
import { validateGenerationLibraryRecord } from './generationLibraryModel.js'
import { createCollectionMembership } from './generationCollectionContracts.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { isCivilDate } from './civilDateUtils.js'
import { boundedCounter, contractBoolean, contractData, contractEnum, contractFingerprint, contractTimestamp, frozenContract, sameContract } from './generationContractData.js'
import { captureMigrationIdentity, createMigrationUnit, validateMigrationUnit } from './generationMigrationContracts.js'

const legacyIds = { noteMarker: 'legacy-note-v1', reviewMarker: 'legacy-review-v1', ratingMarker: 'legacy-rating-v1' }
const string = (value, max = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'string' || value.length > max) throw new TypeError('Invalid import text.')
  return value
}
const title = value => {
  string(value, 200)
  if (/[\u0000-\u001f\u007f<>]/u.test(value)) throw new TypeError('Invalid import note title.')
}
export function validateImportedHtml(value) {
  string(value, 200000)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || !/^([^<]|<(b|strong|i|em|div|p)>|<\/(b|strong|i|em|font|div|p)>|<br>|<font( size="[2-5]")?>)*$/.test(value)) throw new TypeError('Incompatible historical HTML; no implicit sanitization.')
  return value
}
const rating = value => boundedCounter(value, 5)
function dates(record, updated = true) {
  contractTimestamp(record.createdAt)
  if (updated && contractTimestamp(record.updatedAt) < record.createdAt) throw new TypeError('Import dates out of order.')
}
function revisions(input, fields, max) {
  const value = contractRecord(input, fields)
  for (const field of fields) boundedCounter(value[field], max)
}
function library(context, input) {
  const payload = contractData(input)
  const validated = validateGenerationLibraryRecord(context, payload)
  if (!sameContract(payload, validated)) throw new TypeError('Import would normalize null/empty data; explicit treatment required.')
  for (const field of ['authors', 'isbns', 'categories']) if (Object.hasOwn(payload, field)) contractArray(payload[field])
  for (const field of ['note', 'review']) if (Object.hasOwn(payload, field)) validateImportedHtml(payload[field])
  return payload
}
function note(profile, input) {
  const source = contractData(input)
  if (source.deleted === true) {
    if (profile !== 'generation') throw new TypeError('Legacy note schema has no persisted tombstones.')
    const record = contractRecord(source, ['deleted', 'createdAt'])
    dates(record, false)
    return record
  }
  const required = ['title', 'contentHtml', 'date', 'createdAt', 'updatedAt']
  const record = profile === 'generation' ? contractRecord(source, [...required, 'isPinned', 'creation', 'fieldRevisions']) : contractRecord(source, required, ['isPinned'])
  title(record.title); validateImportedHtml(record.contentHtml)
  if (!isCivilDate(record.date)) throw new TypeError('Invalid imported note civil date.')
  dates(record)
  if (Object.hasOwn(record, 'isPinned')) contractBoolean(record.isPinned)
  if (profile === 'generation') { contractFingerprint(record.creation); revisions(record.fieldRevisions, ['title', 'contentHtml', 'date'], Number.MAX_SAFE_INTEGER) }
  return record
}
function ratingEntry(entryId, input) {
  if (entryId !== legacyIds.ratingMarker && !/^-[A-Za-z0-9_-]{19}$/.test(entryId)) throw new TypeError('Unsupported rating identity.')
  const source = contractData(input)
  const record = source.deleted === true ? contractRecord(source, ['deleted', 'createdAt', 'updatedAt', 'revision']) : contractRecord(source, ['value', 'date', 'revision', 'createdAt', 'updatedAt'], ['impression'])
  dates(record); boundedCounter(record.revision, Number.MAX_SAFE_INTEGER, source.deleted === true ? 2 : 1)
  if (source.deleted !== true) {
    rating(record.value)
    if (!isCivilDate(record.date) && !(entryId === legacyIds.ratingMarker && record.date === '')) throw new TypeError('Invalid imported rating date.')
    if (Object.hasOwn(record, 'impression')) {
      string(record.impression, 160)
      if (/[\u0000-\u001f\u007f]/u.test(record.impression)) throw new TypeError('Invalid imported impression.')
    }
  }
  return record
}
export function validateImportedCollectionRecord(profileInput, input) {
  const profile = contractEnum(profileInput, ['legacy', 'generation']), source = contractData(input)
  if (source.deleted === true) {
    if (profile !== 'generation') throw new TypeError('Legacy collections have no persisted tombstones.')
    const record = contractRecord(source, ['deleted', 'createdAt', 'membershipEpoch', 'revision'])
    dates(record, false); boundedCounter(record.membershipEpoch); boundedCounter(record.revision, CATALOG_MAX_COUNTER, 2)
    return contractData(record)
  }
  const metadata = ['name', 'description', 'icon', 'pinned', 'createdAt', 'updatedAt']
  const record = profile === 'generation'
    ? contractRecord(source, [...metadata, 'membershipEpoch', 'revision', 'creation', 'fieldRevisions'], ['lastClearFrom', 'lastClearId'])
    : contractRecord(source, metadata, ['books'])
  string(record.name); string(record.description); string(record.icon)
  if (!record.name.trim() || !record.icon.length) throw new TypeError('Invalid collection metadata; no trimming/defaults during import.')
  contractBoolean(record.pinned); dates(record)
  if (profile === 'legacy' && Object.hasOwn(record, 'books')) {
    const books = contractData(record.books)
    if (Array.isArray(books) || !books || typeof books !== 'object') throw new TypeError('Invalid legacy book map.')
    for (const [id, present] of Object.entries(books)) { validateRtdbPathSegment(id); if (present !== true) throw new TypeError('Obsolete/invalid relationship requires diagnosis.') }
  }
  if (profile === 'generation') {
    boundedCounter(record.membershipEpoch); boundedCounter(record.revision, CATALOG_LAST_LIVE_REVISION)
    contractFingerprint(record.creation); revisions(record.fieldRevisions, CATALOG_FIELDS, CATALOG_MAX_COUNTER)
    if (record.membershipEpoch === 1) {
      if (Object.hasOwn(record, 'lastClearFrom') || Object.hasOwn(record, 'lastClearId')) throw new TypeError('Unexpected clear provenance.')
    } else if (record.lastClearFrom !== record.membershipEpoch - 1 || typeof record.lastClearId !== 'string' || !/^-[A-Za-z0-9_-]{19}$/.test(record.lastClearId)) throw new TypeError('Missing clear provenance.')
  }
  return contractData(record)
}
function marker(kind, profile, input) {
  const source = contractData(input)
  if (kind === 'ratingMarker') {
    const record = contractRecord(source, ['version', 'sourceValue', 'processedAt'])
    if (record.version !== 1) throw new TypeError('Unsupported conversion marker version.')
    rating(record.sourceValue); contractTimestamp(record.processedAt)
    return record
  }
  const fields = ['version', 'outcome', 'sourceHtml', 'processedAt']
  const record = contractRecord(source, profile === 'generation' ? [...fields, 'intent'] : fields)
  if (record.version !== 1) throw new TypeError('Unsupported conversion marker version.')
  contractEnum(record.outcome, ['empty', 'copied']); validateImportedHtml(record.sourceHtml); contractTimestamp(record.processedAt)
  if ((record.outcome === 'empty') !== (record.sourceHtml === '')) throw new TypeError('Historical marker/source contradiction.')
  if (profile === 'generation') contractFingerprint(record.intent)
  return record
}

/** Import intent/provenance, NOT a CRUD operation or Firebase write map. Legacy
 * profiles preserve missing generation metadata; they do not synthesize it.
 * Their eventual storage adaptation and pair validation remain migration work. */
export function createGenerationImport(input) {
  const value = contractRecord(input, ['migration', 'kind', 'profile', 'context', 'entryId', 'payload'])
  const migration = captureMigrationIdentity(value.migration)
  const profile = contractEnum(value.profile, ['legacy', 'generation'])
  const kind = contractEnum(value.kind, ['library', 'note', 'rating', 'historicalSources', 'noteMarker', 'reviewMarker', 'ratingMarker', 'collection', 'membership'])
  const context = kind === 'collection' ? captureCatalogContext(value.context) : captureBookContext(value.context)
  if (context.uid !== migration.uid || kind !== 'collection' && context.generation !== 1) throw new TypeError('Import scope mismatch or noninitial generation.')
  if (kind === 'collection' && profile === 'legacy' && context.epoch !== 1) throw new TypeError('Initial legacy catalog epoch required.')
  const hasEntry = ['note', 'rating', 'membership'].includes(kind)
  const entryId = hasEntry ? validateRtdbPathSegment(value.entryId) : null
  if (!hasEntry && value.entryId !== null) throw new TypeError('Unexpected import entry identity.')
  let payload
  switch (kind) {
    case 'library': payload = library(context, value.payload); break
    case 'note': payload = note(profile, value.payload); break
    case 'rating': payload = ratingEntry(entryId, value.payload); break
    case 'collection':
      payload = validateImportedCollectionRecord(profile, value.payload)
      if (profile === 'generation' && payload.membershipEpoch !== context.epoch) throw new TypeError('Catalog import epoch mismatch.')
      break
    case 'membership': {
      if (profile !== 'generation') throw new TypeError('Legacy boolean relationships need explicit epoch/revision preparation.')
      payload = createCollectionMembership(value.payload)
      boundedCounter(payload.epoch); boundedCounter(payload.revision)
      break
    }
    case 'historicalSources': {
      payload = contractRecord(value.payload, [], ['note', 'review', 'rating'])
      if (!Object.keys(payload).length) throw new TypeError('Empty historical source import.')
      for (const field of ['note', 'review']) if (Object.hasOwn(payload, field)) validateImportedHtml(payload[field])
      if (Object.hasOwn(payload, 'rating')) rating(payload.rating)
      break
    }
    default: payload = marker(kind, profile, value.payload)
  }
  const scope = kind === 'collection' ? [context.collectionId] : hasEntry ? [context.bookId, entryId] : [context.bookId]
  const unit = createMigrationUnit({ migration, kind, scope })
  return contractData({ type: 'migration.import', migration, unit, profile, context, entryId, payload })
}
export function validateGenerationImport(input) {
  frozenContract(input)
  const value = contractRecord(input, ['type', 'migration', 'unit', 'profile', 'context', 'entryId', 'payload'])
  const unit = validateMigrationUnit(value.unit)
  const rebuilt = createGenerationImport({ migration: value.migration, kind: unit.kind, profile: value.profile, context: value.context, entryId: value.entryId, payload: value.payload })
  if (!sameContract(input, rebuilt)) throw new TypeError('Noncanonical/retargeted import envelope.')
  return rebuilt
}
export function reconcileGenerationImport(intentInput, observation) {
  const intent = validateGenerationImport(intentInput)
  const value = contractRecord(observation, ['source', 'migration', 'unit', 'payload', 'accountActive', 'protocolState'])
  contractEnum(value.source, ['server', 'unavailable'])
  if (value.source === 'unavailable') return contractData({ status: 'uncertain', canRetry: false })
  if (!sameContract(captureMigrationIdentity(value.migration), intent.migration) || !sameContract(validateMigrationUnit(value.unit), intent.unit)) return contractData({ status: 'stale', canRetry: false })
  if (!contractBoolean(value.accountActive) || value.protocolState !== 'migrating') return contractData({ status: 'blocked', canRetry: false })
  if (value.payload === null) return contractData({ status: 'not-committed', canRetry: true })
  return contractData({ status: sameContract(value.payload, intent.payload) ? 'confirmed' : 'conflict', canRetry: false })
}
