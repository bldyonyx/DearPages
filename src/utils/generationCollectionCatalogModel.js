import { createCollectionContext, nextCollectionContext } from './generationCollectionContracts.js'
import { contractRecord, positiveCounter, acknowledgedCreatedAt, nextCounter } from './generationOperationUtils.js'

// Existing collectionsService defaults; parity-tested without importing its singleton.
export const CATALOG_DEFAULT_ICON = 'library'
// Conservative SDK-tested profile: avoid its numeric hashing divergence near 2^53.
export const CATALOG_MAX_COUNTER = 2147483647
export const CATALOG_LAST_LIVE_REVISION = CATALOG_MAX_COUNTER - 1
export function nextCatalogCounter(value) {
  positiveCounter(value)
  if (value >= CATALOG_MAX_COUNTER) throw new RangeError('Catalog counter exhausted; reset forbidden.')
  return nextCounter(value)
}
export const CATALOG_FIELDS = Object.freeze(['name', 'description', 'icon', 'pinned'])

export function captureCatalogContext(input) {
  const context = createCollectionContext(input)
  if (!Object.isFrozen(input)) throw new TypeError('Expected frozen Collection context.')
  if (context.epoch > CATALOG_MAX_COUNTER) throw new RangeError('Catalog epoch outside tested counter profile.')
  return context
}
export function catalogMetadata(input, creating = false) {
  const value = contractRecord(input, creating ? ['name'] : [], creating ? ['description', 'icon'] : ['name', 'description', 'icon'])
  if (!Object.keys(value).length) throw new TypeError('Empty metadata patch.')
  const result = {}
  if (Object.hasOwn(value, 'name')) {
    if (typeof value.name !== 'string' || !value.name.trim()) throw new TypeError('Collection name is required.')
    result.name = value.name.trim()
  }
  if (Object.hasOwn(value, 'description')) {
    if (typeof value.description !== 'string') throw new TypeError('Invalid description.')
    result.description = value.description.trim()
  } else if (creating) result.description = ''
  if (Object.hasOwn(value, 'icon')) {
    if (typeof value.icon !== 'string') throw new TypeError('Invalid icon.')
    result.icon = value.icon || CATALOG_DEFAULT_ICON
  } else if (creating) result.icon = CATALOG_DEFAULT_ICON
  return Object.freeze(result)
}
export function createCatalogToken(input) {
  const value = contractRecord(input, ['context', 'createdAt', 'revision', 'fieldRevisions'])
  const fields = contractRecord(value.fieldRevisions, CATALOG_FIELDS)
  if (CATALOG_FIELDS.some(key => positiveCounter(fields[key]) > CATALOG_MAX_COUNTER)) throw new RangeError('Catalog field counter outside supported profile.')
  const fieldRevisions = Object.freeze(Object.fromEntries(CATALOG_FIELDS.map(key => [key, positiveCounter(fields[key])])))
  const revision = positiveCounter(value.revision)
  if (revision > CATALOG_LAST_LIVE_REVISION) throw new RangeError('Last revision is reserved for terminal deletion.')
  return Object.freeze({ context: captureCatalogContext(value.context), createdAt: acknowledgedCreatedAt(value.createdAt), revision, fieldRevisions })
}
function expectedToken(context, input) {
  const token = createCatalogToken(input)
  if (!Object.isFrozen(input) || JSON.stringify(context) !== JSON.stringify(token.context)) throw new TypeError('Collection token/context mismatch.')
  return token
}
/** Stable envelope. Clear targets the deterministic successor of this captured
 * epoch; global revisions never redirect an intent to the server's newer epoch.
 */
export function createCatalogOperation(input) {
  const value = contractRecord(input, ['type', 'context', 'payload'], ['expected', 'operationId'])
  const context = captureCatalogContext(value.context)
  const base = { type: value.type, context }
  if (value.type === 'catalog.create') {
    if (context.epoch !== 1 || Object.hasOwn(value, 'expected') || Object.hasOwn(value, 'operationId')) throw new TypeError('Invalid initial Collection scope.')
    return Object.freeze({ ...base, payload: catalogMetadata(value.payload, true) })
  }
  const expected = expectedToken(context, value.expected)
  let payload
  switch (value.type) {
    case 'catalog.patch': payload = catalogMetadata(value.payload); break
    case 'catalog.pin': {
      const pin = contractRecord(value.payload, ['pinned'])
      if (typeof pin.pinned !== 'boolean') throw new TypeError('Expected explicit pin assignment.')
      payload = Object.freeze(pin); break
    }
    case 'catalog.clear': {
      contractRecord(value.payload, [])
      if (typeof value.operationId !== 'string' || !/^-[A-Za-z0-9_-]{19}$/.test(value.operationId)) throw new TypeError('Clear needs a stable preallocated intent ID.')
      nextCatalogCounter(context.epoch)
      const next = nextCollectionContext(context)
      return Object.freeze({ ...base, payload: Object.freeze({}), expected, operationId: value.operationId, nextEpoch: next.epoch })
    }
    case 'catalog.delete':
      contractRecord(value.payload, [])
      payload = Object.freeze({});
      // Reserve the final safe revision for deletion, including at exhausted live revision.
      nextCounter(expected.revision)
      break
    default: throw new TypeError('Unsupported catalog operation.')
  }
  if (Object.hasOwn(value, 'operationId')) throw new TypeError('Unexpected intent ID.')
  return Object.freeze({ ...base, payload, expected })
}
export function compareCatalogEntries(a, b) {
  return Number(b.pinned === true) - Number(a.pinned === true) ||
    (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
}
