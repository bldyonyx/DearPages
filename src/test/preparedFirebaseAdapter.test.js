// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPreparedFirebaseFinalizationServer } from '../../experiments/historical-import/firebaseAdapter.server.mjs'
import { createLocalFirebaseRest } from '../../experiments/historical-import/firebaseRest.server.mjs'
import { transformHistoricalSnapshot } from '../utils/historicalGenerationTransformer.js'
import { receiptFor, receiptKey, planDigest } from '../../experiments/historical-import/protocol.mjs'

const context = { uid: 'owner', migrationId: 'migration', transformVersion: 1 }
const environment = { mode: 'local-test', projectId: 'demo-dear-pages', namespace: 'demo-dear-pages' }
const expectedRules = JSON.parse(readFileSync('experiments/historical-import/database.rules.json', 'utf8'))
const servicePrincipal = 'migration-service@demo.invalid', invokerPrincipal = 'operator@demo.invalid'
const source = {
  library: { book: { id: 'book', title: 'Fictif', status: 'reading', addedAt: 1, note: 'Note', review: 'Avis', rating: 4 } },
  bookNotes: { book: { n: { title: '', contentHtml: ' Contenu ', date: '2024-02-29', createdAt: 1, updatedAt: 2, isPinned: true } } },
  bookNotesLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: 'Note', processedAt: 1 } },
  bookReviewsLegacy: { book: { version: 1, outcome: 'copied', sourceHtml: 'Avis', processedAt: 1 } },
  bookRatings: { book: { '-1234567890123456789': { deleted: true, createdAt: 1, updatedAt: 3, revision: 4 } } },
  bookRatingsLegacy: { book: { version: 1, sourceValue: 4, processedAt: 1 } },
  collections: { empty: { name: ' Vide ', description: '', icon: 'library', pinned: false, createdAt: 1, updatedAt: 1 } },
  profile: { displayName: ' Fictif ', custom: 'preserved' }, preferences: { language: 'fr', annualGoal: 500 },
}
async function fixture() {
  const prepared = await transformHistoricalSnapshot(source, context)
  expect(prepared.status).toBe('prepared')
  const user = structuredClone(source)
  Object.assign(user, { bookMigration: { id: context.migrationId, version: 1 }, bookProtocol: { version: 2, state: 'migrating' },
    historicalImport: { phase: 'sealed', stage: 'imported', sourceVersion: prepared.sourceVersion, planDigest: planDigest(prepared) },
    bookLifecycle: { book: { generation: 1, state: 'creating' } }, importReceipts: {},
  })
  for (const entry of prepared.destinations) {
    const keys = entry.destinationPath.split('/').slice(2)
    let node = user
    for (const key of keys.slice(0, -1)) node = node[key] ??= {}
    node[keys.at(-1)] = structuredClone(entry.intent.payload)
    user.importReceipts[receiptKey(entry.intent.unit.unitId)] = receiptFor(entry.intent)
  }
  const state = { root: { accountControl: { owner: { state: 'active', legacyClosed: true } }, users: { owner: user, other: { profile: { untouched: true } } } }, version: 1, onPut: null }
  const request = vi.fn(async (url, options) => {
    expect(new URL(url).hostname).toBe('127.0.0.1')
    expect(options.redirect).toBe('error'); expect(options.cache).toBe('no-store')
    expect(options.headers.Authorization).toBe('Bearer local-only-service-token')
    if (url.includes('accounts:lookup')) return { ok: true, json: async () => ({ users: [{ localId: 'owner', email: 'fixture@example.test' }] }) }
    if (url.includes('.settings')) return { ok: true, json: async () => expectedRules }
    if (options.method === 'PUT') {
      if (state.onPut) await state.onPut()
      if (options.headers['if-match'] !== `"v${state.version}"`) return { ok: false, status: 412 }
      state.root = JSON.parse(options.body); state.version++
      return { ok: true, status: 200 }
    }
    const text = JSON.stringify(state.root), etag = `"v${state.version}"`
    return { ok: true, headers: new Headers({ etag }), text: async () => text }
  })
  const authorizeInvocation = vi.fn(async scope => ({ channel: 'private-job', role: 'migration-finalizer', servicePrincipal, invokerPrincipal, scope }))
  const getServiceCredential = vi.fn(async () => ({ kind: 'service', principal: servicePrincipal, accessToken: 'local-only-service-token' }))
  const options = { environment: { ...environment }, authorizeInvocation, getServiceCredential, request, expectedRules }
  return { state, options, server: createPreparedFirebaseFinalizationServer(options), request, authorizeInvocation, getServiceCredential }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('finalizes through the existing core with explicit local service capabilities and preserves all legacy/user data', async () => {
  const f = await fixture(), before = structuredClone(f.state.root)
  const globalRequest = vi.fn(() => { throw new Error('No implicit network') }); vi.stubGlobal('fetch', globalRequest)
  expect((await f.server.finalize(context)).status).toBe('finalized')
  for (const key of Object.keys(source)) expect(f.state.root.users.owner[key]).toEqual(before.users.owner[key])
  expect(f.state.root.users.other).toEqual(before.users.other)
  expect(f.state.root.accountControl).toEqual(before.accountControl)
  expect(f.state.root.users.owner.bookData).toEqual(before.users.owner.bookData)
  expect(f.state.root.users.owner.bookLifecycle.book.state).toBe('active')
  expect(f.state.root.users.owner.bookProtocol.state).toBe('ready')
  expect(globalRequest).not.toHaveBeenCalled()
})
it.each([
  { mode: 'production' }, { projectId: 'production-refused' }, { namespace: 'another' },
])('refuses non-authorized environment before invocation/credentials/network: %j', async change => {
  const f = await fixture()
  expect(() => createPreparedFirebaseFinalizationServer({ ...f.options, environment: { ...environment, ...change } })).toThrow('real-execution-disabled')
  expect(f.authorizeInvocation).not.toHaveBeenCalled(); expect(f.getServiceCredential).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled()
})
it.each(['request', 'getServiceCredential', 'authorizeInvocation'])('has no implicit %s or ADC fallback', async field => {
  const f = await fixture()
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/tmp/never-read-fake-credentials.json')
  expect(() => createPreparedFirebaseFinalizationServer({ ...f.options, [field]: undefined })).toThrow('explicit-server-capabilities-required')
  expect(f.request).not.toHaveBeenCalled()
})
it.each([
  { channel: 'browser' }, { role: 'user' }, { servicePrincipal: 'owner' }, { servicePrincipal: invokerPrincipal }, { scope: {} },
])('refuses an ordinary/unbound private invocation without acquiring a token: %j', async change => {
  const f = await fixture()
  f.authorizeInvocation.mockImplementation(async scope => ({ channel: 'private-job', role: 'migration-finalizer', servicePrincipal, invokerPrincipal, scope, ...change }))
  await expect(f.server.finalize(context)).rejects.toThrow('private-service-invocation-required')
  expect(f.getServiceCredential).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled()
})
it.each([
  { kind: 'user' }, { principal: 'another-service' }, { accessToken: '' },
])('rejects non-service/mismatched/missing explicit credential: %j', async change => {
  const f = await fixture()
  f.getServiceCredential.mockResolvedValue({ kind: 'service', principal: servicePrincipal, accessToken: 'local-only-service-token', ...change })
  await expect(f.server.finalize(context)).rejects.toThrow('explicit-service-credential-required')
  expect(f.request).not.toHaveBeenCalled()
})
it('rejects client approval fields without invoking host authorization', async () => {
  const f = await fixture()
  await expect(f.server.finalize({ ...context, approved: true })).rejects.toThrow()
  expect(f.authorizeInvocation).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled()
})
it('refuses browser construction of either server capability', async () => {
  const f = await fixture(); vi.stubGlobal('window', {})
  expect(() => createPreparedFirebaseFinalizationServer(f.options)).toThrow('explicit-server-capabilities-required')
  expect(() => createLocalFirebaseRest({ request: f.request, assertAuthorized: () => {}, getAccessToken: async () => 'unused' })).toThrow('explicit-server-capabilities-required')
})
it('rechecks private host authorization and refuses a mid-flight revocation before commit', async () => {
  const f = await fixture(), actual = f.options.request
  f.options.request = async (url, options) => {
    const response = await actual(url, options)
    if (url.includes('.settings')) f.authorizeInvocation.mockImplementation(async scope => ({ channel: 'browser', role: 'user', servicePrincipal, invokerPrincipal, scope }))
    return response
  }
  const before = structuredClone(f.state.root)
  await expect(createPreparedFirebaseFinalizationServer(f.options).finalize(context)).rejects.toThrow('private-service-invocation-required')
  expect(f.state.root).toEqual(before)
  expect(f.request.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(false)
})
it('rechecks distinct service identity rather than silently switching credentials', async () => {
  const f = await fixture()
  f.authorizeInvocation.mockImplementation(async scope => ({ channel: 'private-job', role: 'migration-finalizer', servicePrincipal: f.authorizeInvocation.mock.calls.length > 1 ? 'changed-service' : servicePrincipal, invokerPrincipal, scope }))
  await expect(f.server.finalize(context)).rejects.toThrow('service-identity-changed')
  expect(f.request).not.toHaveBeenCalled()
})
it('re-reads and verifies after a CAS conflict, preserving concurrent unrelated data', async () => {
  const f = await fixture()
  let changed = false
  f.state.onPut = async () => { if (!changed) { changed = true; f.state.root.users.other.profile.concurrent = true; f.state.version++ } }
  expect((await f.server.finalize(context)).status).toBe('finalized')
  expect(f.request.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(2)
  expect(f.state.root.users.other.profile.concurrent).toBe(true)
})
it('does not overwrite a terminal account barrier after a CAS conflict', async () => {
  const f = await fixture()
  f.state.onPut = async () => { f.state.root.accountControl.owner.state = 'deleting'; f.state.version++ }
  await expect(f.server.finalize(context)).rejects.toThrow('account-blocked')
  expect(f.state.root.users.owner.bookProtocol.state).toBe('migrating')
  expect(f.state.root.users.owner.historicalFinalization).toBeUndefined()
})
it('reconciles a lost acknowledgement without reactivating or reimporting data', async () => {
  const f = await fixture(), actual = f.options.request
  let interrupted = false
  f.options.request = async (url, options) => {
    const response = await actual(url, options)
    if (options.method === 'PUT' && !interrupted) { interrupted = true; throw new Error('Local double lost acknowledgement') }
    return response
  }
  const server = createPreparedFirebaseFinalizationServer(f.options)
  await expect(server.finalize(context)).rejects.toThrow('observation-or-commit-uncertain')
  const committed = structuredClone(f.state.root)
  expect((await server.finalize(context)).status).toBe('already-finalized')
  expect(f.state.root).toEqual(committed)
})
it('refuses wrong server rules without committing an attestation', async () => {
  const f = await fixture(), before = structuredClone(f.state.root)
  await expect(createPreparedFirebaseFinalizationServer({ ...f.options, expectedRules: { rules: { '.write': true } } }).finalize(context)).rejects.toThrow('unexpected-rules-policy')
  expect(f.state.root).toEqual(before)
})
it('never allows an unconditional CAS even to local doubles', async () => {
  const request = vi.fn(), rest = createLocalFirebaseRest({ request, assertAuthorized: () => {}, getAccessToken: async () => 'local-only' })
  for (const etag of [undefined, '', '*']) await expect(rest.compareAndSwapRoot(etag, {})).rejects.toThrow('unbounded-or-unversioned-root')
  expect(request).not.toHaveBeenCalled()
})
