import { contractArray, contractRecord } from './generationOperationUtils.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'
import { contractBoolean, contractData, contractEnum, contractTimestamp, compareContractIds } from './generationContractData.js'
import { validateImportedCollectionRecord } from './generationImportContracts.js'

export function createCollectionActivity(input) {
  const value = contractRecord(input, ['at', 'catalogCreatedAt'])
  return Object.freeze({ at: contractTimestamp(value.at), catalogCreatedAt: contractTimestamp(value.catalogCreatedAt) })
}
/** Caller-supplied acknowledged timestamps only. No clock, server placeholder,
 * fake metadata patch, or implicit membership activity for a no-op. */
export function projectCollectionActivityEffect(input) {
  const value = contractRecord(input, ['kind', 'changed', 'previous', 'catalogCreatedAt', 'eventAt'])
  contractEnum(value.kind, ['membership', 'metadata', 'pin', 'clear', 'delete'])
  const changed = contractBoolean(value.changed), identity = contractTimestamp(value.catalogCreatedAt)
  const previous = value.previous === null ? null : createCollectionActivity(value.previous)
  if (previous && previous.catalogCreatedAt !== identity) throw new TypeError('Activity belongs to another catalog identity.')
  if (!changed || ['metadata', 'pin', 'clear'].includes(value.kind)) {
    if (value.eventAt !== null) throw new TypeError('Unexpected membership timestamp.')
    return contractData({ activity: previous, shouldWrite: false })
  }
  if (value.kind === 'delete') {
    if (value.eventAt !== null) throw new TypeError('Unexpected deletion activity timestamp.')
    return contractData({ activity: null, shouldWrite: previous !== null })
  }
  const at = contractTimestamp(value.eventAt)
  if (previous && at < previous.at) throw new TypeError('Activity cannot move backwards.')
  return contractData({ activity: createCollectionActivity({ at, catalogCreatedAt: identity }), shouldWrite: true })
}
export function projectCollectionActivity(input) {
  const value = contractRecord(input, ['collectionId', 'catalog', 'activity'])
  const collectionId = validateRtdbPathSegment(value.collectionId)
  const catalog = validateImportedCollectionRecord('generation', value.catalog)
  if (catalog.deleted === true) return null
  const activity = value.activity === null ? null : createCollectionActivity(value.activity)
  if (activity && activity.catalogCreatedAt !== catalog.createdAt) throw new TypeError('Activity identity conflict.')
  return contractData({ collectionId, pinned: catalog.pinned, metadataAt: catalog.updatedAt, activityAt: activity?.at ?? null, sortAt: Math.max(catalog.updatedAt, activity?.at ?? 0) })
}
export function sortCollectionsByActivity(input) {
  const seen = new Set()
  const projections = contractArray(input).map(item => {
    const projection = projectCollectionActivity(item)
    if (projection) {
      if (seen.has(projection.collectionId)) throw new TypeError('Duplicate collection projection.')
      seen.add(projection.collectionId)
    }
    return projection
  }).filter(Boolean)
  return Object.freeze(projections.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.sortAt - a.sortAt || compareContractIds(a.collectionId, b.collectionId)))
}
