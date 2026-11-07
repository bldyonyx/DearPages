import { createHash } from 'node:crypto'
import { canonicalContract, contractData } from '../../src/utils/generationContractData.js'

export const controlRoots = Object.freeze(['bookProtocol', 'bookMigration', 'historicalImport', 'importReceipts', 'bookData', 'bookLifecycle', 'collectionCatalog'])
export const hash = value => createHash('sha256').update(canonicalContract(value), 'utf8').digest('hex')
export const receiptKey = unitId => hash(['historical-import-receipt-v1', unitId])
export const receiptFor = intent => contractData({ unitId: intent.unit.unitId, payloadDigest: hash(['historical-import-payload-v1', intent.payload]) })
export const sourceValue = user => contractData(Object.fromEntries(Object.entries(user || {}).filter(([key]) => !controlRoots.includes(key))))
export const planDigest = preparation => hash(['historical-import-plan-v1', preparation.migration, preparation.sourceVersion, preparation.destinations])
