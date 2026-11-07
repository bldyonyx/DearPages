// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createPrivateFinalizationHandler } from '../../functions/migration/handler.server.mjs'
import * as entry from '../../functions/migration/index.mjs'

const runtime = 'migration-runtime@demo-dear-pages.iam.gserviceaccount.com'
const invoker = 'migration-invoker@demo-dear-pages.iam.gserviceaccount.com'
const config = {
  FUNCTIONS_EMULATOR: 'true', MIGRATION_FUNCTION_LOCAL_ENABLED: 'true', GCLOUD_PROJECT: 'demo-dear-pages',
  FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  MIGRATION_RUNTIME_SERVICE_ACCOUNT: runtime, MIGRATION_INVOKER_SERVICE_ACCOUNT: invoker,
  MIGRATION_INVOKER_SUBJECT: '123456789012345678901', MIGRATION_FUNCTION_AUDIENCE: 'https://local-fixture.invalid/finalizeHistoricalImport',
}
const body = { uid: 'owner', migrationId: 'migration', transformVersion: 1 }
const request = () => ({ method: 'POST', headers: { authorization: 'Bearer local-oidc-double', 'content-type': 'application/json' }, query: {}, body })
function response() {
  return { statusCode: 200, payload: null, headers: {}, on() { return this }, set(name, value) { this.headers[name] = value; return this }, status(code) { this.statusCode = code; return this }, json(value) { this.payload = value; return this } }
}
function capabilities() {
  return {
    environment: () => ({ ...config }),
    verifyInvocationToken: vi.fn(async () => ({ issuer: 'https://accounts.google.com', audience: config.MIGRATION_FUNCTION_AUDIENCE, subject: config.MIGRATION_INVOKER_SUBJECT, email: invoker, emailVerified: true, expiresAt: Math.floor(Date.now() / 1000) + 300 })),
    getServiceCredential: vi.fn(), request: vi.fn(), expectedRules: { rules: {} },
  }
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('exports only one real SDK HTTP v2 function, private IAM, internal ingress and a parameterized distinct runtime identity', () => {
  expect(Object.keys(entry)).toEqual(['finalizeHistoricalImport'])
  const metadata = entry.finalizeHistoricalImport.__endpoint
  expect(metadata.platform).toBe('gcfv2')
  expect(metadata.httpsTrigger.invoker).toEqual(['private'])
  expect(metadata.ingressSettings).toBe('ALLOW_INTERNAL_ONLY')
  expect(String(metadata.serviceAccountEmail)).toContain('MIGRATION_RUNTIME_SERVICE_ACCOUNT')
  expect(metadata).not.toHaveProperty('eventTrigger')
  expect(metadata).not.toHaveProperty('scheduleTrigger')
})
it('refuses unauthenticated requests without any token/credential/network activity', async () => {
  const dependencies = capabilities(), req = request(), res = response(); delete req.headers.authorization
  await createPrivateFinalizationHandler(dependencies)(req, res)
  expect(res.statusCode).toBe(401)
  expect(dependencies.verifyInvocationToken).not.toHaveBeenCalled(); expect(dependencies.getServiceCredential).not.toHaveBeenCalled(); expect(dependencies.request).not.toHaveBeenCalled()
})
it.each(['GET', 'OPTIONS', 'PUT'])('has no browser preflight or automatic invocation path for %s', async method => {
  const res = response(), dependencies = capabilities()
  await createPrivateFinalizationHandler(dependencies)({ ...request(), method }, res)
  expect(res.statusCode).toBe(405); expect(dependencies.request).not.toHaveBeenCalled()
  expect(res.headers).not.toHaveProperty('Access-Control-Allow-Origin')
})
it.each(['FUNCTIONS_EMULATOR', 'MIGRATION_FUNCTION_LOCAL_ENABLED', 'GCLOUD_PROJECT', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'])('refuses a non-authorized environment field %s', async field => {
  const dependencies = capabilities(), res = response()
  dependencies.environment = () => ({ ...config, [field]: 'production-refused' })
  await createPrivateFinalizationHandler(dependencies)(request(), res)
  expect(res.statusCode).toBe(503); expect(res.payload.error).toBe('real-execution-disabled')
  expect(dependencies.verifyInvocationToken).not.toHaveBeenCalled(); expect(dependencies.request).not.toHaveBeenCalled()
})
it.each(['MIGRATION_RUNTIME_SERVICE_ACCOUNT', 'MIGRATION_INVOKER_SERVICE_ACCOUNT', 'MIGRATION_INVOKER_SUBJECT', 'MIGRATION_FUNCTION_AUDIENCE'])('requires explicit private configuration %s without a default identity', async field => {
  const dependencies = capabilities(), res = response()
  dependencies.environment = () => ({ ...config, [field]: undefined })
  await createPrivateFinalizationHandler(dependencies)(request(), res)
  expect(res.statusCode).toBe(503); expect(dependencies.request).not.toHaveBeenCalled()
})
it('refuses the same runtime and invoker service accounts', async () => {
  const dependencies = capabilities(), res = response()
  dependencies.environment = () => ({ ...config, MIGRATION_RUNTIME_SERVICE_ACCOUNT: invoker })
  await createPrivateFinalizationHandler(dependencies)(request(), res)
  expect(res.statusCode).toBe(503)
})
it('shipped handler has no implicit verifier, ADC credentials or Firebase transport', async () => {
  const res = response(), network = vi.fn(); vi.stubGlobal('fetch', network)
  await createPrivateFinalizationHandler({ environment: () => config })(request(), res)
  expect(res.statusCode).toBe(503); expect(res.payload.error).toBe('private-authority-not-configured')
  expect(network).not.toHaveBeenCalled()
})
it.each([
  { issuer: 'https://securetoken.google.com/demo-dear-pages' }, { audience: 'https://wrong.invalid' },
  { subject: '000000000000000000000' }, { email: 'user@example.test' }, { emailVerified: false }, { expiresAt: 0 },
])('rejects ordinary Firebase users, wrong audience/subject and expired tokens: %j', async change => {
  const dependencies = capabilities(), original = dependencies.verifyInvocationToken, res = response()
  dependencies.verifyInvocationToken = vi.fn(async (...args) => ({ ...await original(...args), ...change }))
  await createPrivateFinalizationHandler(dependencies)(request(), res)
  expect(res.statusCode).toBe(403); expect(dependencies.getServiceCredential).not.toHaveBeenCalled(); expect(dependencies.request).not.toHaveBeenCalled()
})
it('does not trust req.auth, identity headers or a client approval as service authentication', async () => {
  const dependencies = capabilities(), req = request(), res = response()
  req.auth = { uid: 'admin', token: { admin: true } }; req.headers['x-goog-authenticated-user-email'] = invoker
  dependencies.verifyInvocationToken.mockRejectedValue(new Error('Not a signed OIDC service identity'))
  await createPrivateFinalizationHandler(dependencies)(req, res)
  expect(res.statusCode).toBe(403); expect(dependencies.request).not.toHaveBeenCalled()
  const other = response()
  await createPrivateFinalizationHandler(capabilities())({ ...request(), body: { ...body, approval: { approved: true } } }, other)
  expect(other.statusCode).toBe(400)
})
it('does not echo untrusted exception text or token material', async () => {
  const dependencies = capabilities(), res = response()
  dependencies.getServiceCredential.mockRejectedValue(Object.assign(new Error('secret-token'), { safeCode: 'secret-token', status: 500 }))
  await createPrivateFinalizationHandler(dependencies)(request(), res)
  expect(res.statusCode).toBe(409); expect(JSON.stringify(res.payload)).not.toContain('secret-token')
})
it('deploy guard exits before any deployment command and the root Hosting configuration is untouched', () => {
  const result = spawnSync(process.execPath, ['functions/migration/refuseDeploy.mjs'], { encoding: 'utf8' })
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(1); expect(result.stderr).toContain('MIGRATION_FUNCTION_DEPLOYMENT_DISABLED')
  const root = JSON.parse(readFileSync('firebase.json', 'utf8'))
  expect(root).not.toHaveProperty('functions')
  const preparation = JSON.parse(readFileSync('firebase.migration-functions.json', 'utf8'))
  expect(preparation.functions[0].predeploy).toEqual(['node functions/migration/refuseDeploy.mjs'])
  expect(preparation.functions[0].source).toBe('functions/migration')
})
it('function registration itself does not start a migration or read credentials', () => {
  const network = vi.fn(); vi.stubGlobal('fetch', network)
  expect(entry.finalizeHistoricalImport).toBeTypeOf('function')
  const source = readFileSync('functions/migration/index.mjs', 'utf8')
  expect(source).not.toMatch(/initializeApp|getApplicationDefault|applicationDefault|onCall|onValueWritten|onDocument|onUserCreated|onSchedule/)
  expect(network).not.toHaveBeenCalled()
})
it('the actual SDK export remains blocked even with complete fictitious local configuration', async () => {
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value)
  const network = vi.fn(); vi.stubGlobal('fetch', network)
  const res = response()
  await entry.finalizeHistoricalImport(request(), res)
  expect(res.statusCode).toBe(503)
  expect(res.payload.error).toBe('private-authority-not-configured')
  expect(network).not.toHaveBeenCalled()
})
