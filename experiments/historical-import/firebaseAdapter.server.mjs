import { isDeepStrictEqual } from 'node:util'
import { createMigrationIdentity } from '../../src/utils/generationMigrationContracts.js'
import { contractRecord } from '../../src/utils/generationOperationUtils.js'
import { createHistoricalFinalizer } from './finalizationCore.server.mjs'
import { createLocalFirebaseRest } from './firebaseRest.server.mjs'

const failure = code => Object.assign(new Error(`historical-adapter/${code}`), { code: `historical-adapter/${code}` })
/** PREPARATION ONLY. No route/CLI, IAM creation, ADC or real Firebase transport.
 * Callbacks are host-side capabilities, NEVER request-body fields. The host must
 * authenticate the private invocation and service identity. Local doubles may
 * model that decision; they do not establish a production trust authority.
 */
export function createPreparedFirebaseFinalizationServer(input) {
  if (typeof window !== 'undefined' || !input) throw failure('explicit-server-capabilities-required')
  const options = contractRecord(input, ['environment', 'authorizeInvocation', 'getServiceCredential', 'request', 'expectedRules'])
  const environment = Object.freeze(contractRecord(options.environment, ['mode', 'projectId', 'namespace']))
  function guard() {
    if (typeof window !== 'undefined' || environment.mode !== 'local-test' || environment.projectId !== 'demo-dear-pages' || environment.namespace !== 'demo-dear-pages') throw failure('real-execution-disabled')
  }
  guard()
  for (const name of ['authorizeInvocation', 'getServiceCredential', 'request']) if (typeof options[name] !== 'function') throw failure('explicit-server-capabilities-required')
  // Capture, do not consult a mutable caller policy/config after construction.
  const expectedRules = structuredClone(options.expectedRules)
  if (!expectedRules || typeof expectedRules !== 'object' || !expectedRules.rules) throw failure('explicit-rules-policy-required')
  const authorize = options.authorizeInvocation, credential = options.getServiceCredential, request = options.request
  return Object.freeze({ finalize: async inputIdentity => {
    guard()
    const migration = createMigrationIdentity(inputIdentity)
    const scope = Object.freeze({ ...migration, projectId: environment.projectId, namespace: environment.namespace, action: 'historical.finalize' })
    let decision = null
    const check = () => {
      guard()
      if (!decision) throw failure('private-service-invocation-required')
    }
    async function authorizePrivateInvocation() {
      guard()
      let value
      try { value = contractRecord(await authorize(scope), ['channel', 'role', 'servicePrincipal', 'invokerPrincipal', 'scope']) }
      catch { throw failure('private-service-invocation-required') }
      if (value.channel !== 'private-job' || value.role !== 'migration-finalizer' || !isDeepStrictEqual(value.scope, scope) ||
        typeof value.servicePrincipal !== 'string' || !value.servicePrincipal || typeof value.invokerPrincipal !== 'string' || !value.invokerPrincipal ||
        value.servicePrincipal === migration.uid || value.servicePrincipal === value.invokerPrincipal) throw failure('private-service-invocation-required')
      if (decision && (value.servicePrincipal !== decision.servicePrincipal || value.invokerPrincipal !== decision.invokerPrincipal)) throw failure('service-identity-changed')
      decision = Object.freeze({ servicePrincipal: value.servicePrincipal, invokerPrincipal: value.invokerPrincipal })
    }
    await authorizePrivateInvocation() // Fail before token acquisition or network.
    const rest = createLocalFirebaseRest({ request, assertAuthorized: check, getAccessToken: async () => {
      // Refresh the host authorization before EVERY privileged request.
      await authorizePrivateInvocation()
      let value
      try { value = contractRecord(await credential(scope), ['kind', 'principal', 'accessToken']) }
      catch { throw failure('explicit-service-credential-required') }
      await authorizePrivateInvocation()
      if (value.kind !== 'service' || value.principal !== decision.servicePrincipal || typeof value.accessToken !== 'string' || !value.accessToken) throw failure('explicit-service-credential-required')
      return value.accessToken
    } })
    return createHistoricalFinalizer({
      // The unchanged attestation contract deliberately does not accept a real authority yet.
      recordAuthority: 'emulator-root-cas-v1', assertAuthorized: check, authorize: authorizePrivateInvocation,
      verifyAccountIdentity: async uid => {
        const identity = await rest.lookupAccount(uid)
        if (!identity?.email?.endsWith('@example.test') || identity.disabled) throw failure('fictional-account-required')
      },
      readRoot: rest.readRoot,
      assertWritePolicy: async () => { if (!isDeepStrictEqual(await rest.readRules(), expectedRules)) throw failure('unexpected-rules-policy') },
      compareAndSwapRoot: rest.compareAndSwapRoot,
    }).finalize(migration)
  } })
}
