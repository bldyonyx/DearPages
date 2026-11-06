import { createGenerationCollectionsGateway } from './generationCollectionsGateway.js'
import { getAuth } from 'firebase/auth'
import { createBookLifecycleService } from '../services/bookLifecycleService.js'
import { createGenerationApplicationService } from '../services/generationApplicationService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { createAccountControl } from '../utils/generationRecoveryContracts.js'
import { contractData, sameContract } from '../utils/generationContractData.js'
import { createGenerationLibraryGateway } from './generationLibraryGateway.js'

export const generationLibraryRequested = (env = import.meta.env) => env.MODE === 'emulator' && env.VITE_GENERATION_LIBRARY === 'true'
/** No singleton import: independently testable with an injected demo Database.
 * Errors are blocked, NEVER permission to fall back to legacy writes.
 */
export async function resolveLibraryBackend(database, uid, { isolated, fetch: request = globalThis.fetch, facadeOptions = {} } = {}) {
  if (!isolated) return Object.freeze({ mode: 'blocked' })
  try {
    createBookLifecycleService(database) // Validates BOTH SDK endpoints, project and namespace before reads.
    const auth = getAuth(database.app)
    const owner = () => { if (auth.currentUser?.uid !== uid) throw new Error('owner-mismatch') }
    owner()
    const token = await auth.currentUser.getIdToken()
    owner()
    const read = async path => {
      const url = new URL(`http://${emulator.host}:${emulator.database}/${path}.json`)
      url.searchParams.set('ns', emulator.projectId); url.searchParams.set('auth', token)
      const response = await request(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('observation-unavailable')
      const value = contractData(await response.json()); owner(); return value
    }
    const accountValue = await read(`accountControl/${encodeURIComponent(uid)}`)
    const account = accountValue === null ? null : createAccountControl(accountValue)
    const protocol = await read(`users/${encodeURIComponent(uid)}/bookProtocol`)
    // Legacy is an explicit observation under this opt-in profile, never a network fallback.
    if (protocol === null && account?.state === 'active' && account.legacyClosed === false) {
      const state = await read(`users/${encodeURIComponent(uid)}`)
      const after = await read(`accountControl/${encodeURIComponent(uid)}`)
      const generationBranches = ['bookProtocol', 'bookMigration', 'bookLifecycle', 'bookData', 'collectionCatalog', 'batchHead', 'batchReceipts']
      if (sameContract(accountValue, after) && !generationBranches.some(key => state?.[key] != null)) return Object.freeze({ mode: 'legacy' })
      return Object.freeze({ mode: 'blocked' })
    }
    if (!sameContract(protocol, { version: 2, state: 'ready' })) return Object.freeze({ mode: 'blocked' })
    const facade = createGenerationApplicationService(database, { uid, fetch: request, ...facadeOptions })
    // Existing facade checks protocol shape, legacy residue, account fence and freshness.
    await facade.books.getContext('generation-ui-probe')
    owner()
    const gateway = createGenerationLibraryGateway(facade, uid)
    return Object.freeze({ mode: 'generation', facade, gateway, collectionsGateway: createGenerationCollectionsGateway(facade, gateway, uid) })
  } catch { return Object.freeze({ mode: 'blocked' }) }
}
export async function resolveCurrentLibraryBackend(uid) {
  if (!generationLibraryRequested()) return Object.freeze({ mode: 'legacy' })
  const { database, isFirebaseEmulator } = await import('../services/firebase.js')
  return resolveLibraryBackend(database, uid, { isolated: isFirebaseEmulator })
}
