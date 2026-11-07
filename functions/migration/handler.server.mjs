import { createMigrationIdentity } from '../../src/utils/generationMigrationContracts.js'
import { contractRecord } from '../../src/utils/generationOperationUtils.js'
import { createPreparedFirebaseFinalizationServer } from '../../experiments/historical-import/firebaseAdapter.server.mjs'

class InvocationError extends Error {
  constructor(status, code) { super(code); this.status = status; this.safeCode = code }
}
const denied = (status, code) => new InvocationError(status, code)
function configuration(env) {
  if (env.FUNCTIONS_EMULATOR !== 'true' || env.MIGRATION_FUNCTION_LOCAL_ENABLED !== 'true' || env.GCLOUD_PROJECT !== 'demo-dear-pages' ||
    env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw denied(503, 'real-execution-disabled')
  const { MIGRATION_RUNTIME_SERVICE_ACCOUNT: runtime, MIGRATION_INVOKER_SERVICE_ACCOUNT: invoker,
    MIGRATION_INVOKER_SUBJECT: subject, MIGRATION_FUNCTION_AUDIENCE: audience } = env
  const serviceAccount = /^[a-z][a-z0-9-]*@demo-dear-pages\.iam\.gserviceaccount\.com$/
  if (!serviceAccount.test(runtime || '') || !serviceAccount.test(invoker || '') || runtime === invoker ||
    !/^[0-9]{10,32}$/.test(subject || '') || typeof audience !== 'string') throw denied(503, 'incomplete-private-configuration')
  let url
  try { url = new URL(audience) } catch { throw denied(503, 'incomplete-private-configuration') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw denied(503, 'incomplete-private-configuration')
  return Object.freeze({ runtime, invoker, subject, audience })
}
/** No public trust source: these callbacks are internal server capabilities.
 * verifyInvocationToken must verify signature/issuer/audience, not decode a JWT
 * or trust req.auth / X-Goog-* / a body principal. No such real provider is wired
 * in the shipped export. Host IAM is an additional gate, not a replacement.
 */
export function createPrivateFinalizationHandler({ environment = () => process.env, verifyInvocationToken, getServiceCredential, request, expectedRules } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      if (req.method !== 'POST') throw denied(405, 'post-required')
      const header = req.headers?.authorization
      const bearer = typeof header === 'string' && /^Bearer ([^\s]+)$/.exec(header)
      if (!bearer) throw denied(401, 'service-authentication-required')
      const initial = configuration(environment())
      if ([verifyInvocationToken, getServiceCredential, request].some(value => typeof value !== 'function') || !expectedRules) throw denied(503, 'private-authority-not-configured')
      if (!/^application\/json(?:;|$)/i.test(req.headers?.['content-type'] || '')) throw denied(415, 'json-required')
      if (req.query && Object.keys(req.query).length) throw denied(400, 'unexpected-query')
      let migration
      try { migration = createMigrationIdentity(req.body) } catch { throw denied(400, 'invalid-migration-request') }
      const authorizeInvocation = async scope => {
        const current = configuration(environment())
        if (Object.keys(initial).some(key => initial[key] !== current[key])) throw denied(403, 'private-configuration-changed')
        let identity
        try { identity = contractRecord(await verifyInvocationToken(bearer[1], current.audience), ['issuer', 'audience', 'subject', 'email', 'emailVerified', 'expiresAt']) }
        catch { throw denied(403, 'service-invocation-denied') }
        if (!['https://accounts.google.com', 'accounts.google.com'].includes(identity.issuer) || identity.audience !== current.audience ||
          identity.subject !== current.subject || identity.email !== current.invoker || identity.emailVerified !== true ||
          !Number.isSafeInteger(identity.expiresAt) || identity.expiresAt <= Math.floor(Date.now() / 1000)) throw denied(403, 'service-invocation-denied')
        return { channel: 'private-job', role: 'migration-finalizer', servicePrincipal: current.runtime, invokerPrincipal: identity.email, scope }
      }
      await authorizeInvocation(Object.freeze({ ...migration, projectId: 'demo-dear-pages', namespace: 'demo-dear-pages', action: 'historical.finalize' }))
      const finalizer = createPreparedFirebaseFinalizationServer({
        environment: { mode: 'local-test', projectId: 'demo-dear-pages', namespace: 'demo-dear-pages' },
        authorizeInvocation, getServiceCredential, request, expectedRules,
      })
      const result = await finalizer.finalize(migration)
      return res.status(200).json(result)
    } catch (error) {
      // Never return tokens, credentials, snapshots or untrusted exception text.
      return res.status(error instanceof InvocationError ? error.status : 409).json({ error: error instanceof InvocationError ? error.safeCode : 'finalization-refused' })
    }
  }
}
