// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmulatorFinalizationServer } from '../../experiments/historical-import/finalize.server.mjs'
import { historicalFinalizationRecord, hasHistoricalFinalization } from '../utils/historicalFinalizationRecord.js'
import { transformHistoricalSnapshot } from '../utils/historicalGenerationTransformer.js'
import { planDigest } from '../../experiments/historical-import/protocol.mjs'
vi.mock('../../scripts/emulatorSafety.mjs', () => ({ assertEmulatorProject: vi.fn(async () => {}), assertEmulatorsReady: vi.fn(async () => {}) }))
const context = { uid: 'owner', migrationId: 'm', transformVersion: 1 }
const proof = { version: 1, authority: 'emulator-root-cas-v1', ...context, sourceVersion: 'a'.repeat(64), planDigest: 'b'.repeat(64), snapshotDigest: 'c'.repeat(64), receiptsDigest: 'd'.repeat(64), finalizationId: 'e'.repeat(64) }
const environment = {
  HISTORICAL_FINALIZATION_SERVER: 'true', GCLOUD_PROJECT: 'demo-dear-pages', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', HISTORICAL_EMULATOR_ADMIN_TOKEN: 'owner',
}
beforeEach(() => { for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it.each(Object.keys(environment))('rejects incorrect server environment %s without any request', field => {
  vi.stubEnv(field, 'refused')
  const request = vi.fn()
  expect(() => createEmulatorFinalizationServer({ request })).toThrow('controlled-emulator-server-required')
  expect(request).not.toHaveBeenCalled()
})
it('refuses a browser context before any privileged observation', () => {
  vi.stubGlobal('window', {})
  expect(() => createEmulatorFinalizationServer({ request: vi.fn() })).toThrow('controlled-emulator-server-required')
})
it('rechecks environment on each operation and rejects caller proof artifacts', async () => {
  const request = vi.fn(), server = createEmulatorFinalizationServer({ request })
  await expect(server.finalize({ ...context, approval: proof })).rejects.toThrow()
  expect(request).not.toHaveBeenCalled()
  vi.stubEnv('GCLOUD_PROJECT', 'refused')
  await expect(server.finalize(context)).rejects.toThrow('controlled-emulator-server-required')
  expect(request).not.toHaveBeenCalled()
})
it('requires a fictitious existing Auth identity without writing Auth', async () => {
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ users: [{ localId: 'owner', email: 'refused.invalid' }] }) }))
  await expect(createEmulatorFinalizationServer({ request }).finalize(context)).rejects.toThrow('fictional-auth-account-required')
  expect(request).toHaveBeenCalledTimes(1)
  const [url, options] = request.mock.calls[0]
  expect(url).toBe('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-dear-pages/accounts:lookup')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toEqual({ localId: ['owner'] })
})
it('requires an ETag and rejects unversioned root observations', async () => {
  const request = vi.fn(async url => url.includes('9099')
    ? { ok: true, json: async () => ({ users: [{ localId: 'owner', email: 'fixture@example.test' }] }) }
    : { ok: true, headers: new Headers(), text: async () => '{}' })
  await expect(createEmulatorFinalizationServer({ request }).finalize(context)).rejects.toThrow('unbounded-or-unversioned-root')
  expect(request.mock.calls.every(([, options]) => options.method !== 'PUT')).toBe(true)
  expect(request.mock.calls.every(([url]) => new URL(url).hostname === '127.0.0.1')).toBe(true)
})
it('validates only closed server-record schemas and captured account/plan bindings', () => {
  const user = { bookMigration: { id: 'm', version: 1 }, historicalImport: { phase: 'sealed', stage: 'imported', sourceVersion: proof.sourceVersion, planDigest: proof.planDigest }, historicalFinalization: proof }
  expect(historicalFinalizationRecord(proof)).toEqual(proof)
  expect(hasHistoricalFinalization(user, 'owner')).toBe(true)
  expect(hasHistoricalFinalization(user, 'other')).toBe(false)
  expect(hasHistoricalFinalization({ ...user, historicalFinalization: { ...proof, approved: true } }, 'owner')).toBe(false)
  expect(hasHistoricalFinalization({ ...user, historicalImport: { ...user.historicalImport, planDigest: 'f'.repeat(64) } }, 'owner')).toBe(false)
  expect(hasHistoricalFinalization({ ...user, bookMigration: { id: 'new-migration', version: 1 } }, 'owner')).toBe(false)
})
it('uses a conditional root write and treats a server error as an uncertain commit', async () => {
  const preparation = await transformHistoricalSnapshot({}, context)
  const root = { accountControl: { owner: { state: 'active', legacyClosed: true } }, users: {
    owner: { bookProtocol: { version: 2, state: 'migrating' }, bookMigration: { id: 'm', version: 1 },
      historicalImport: { phase: 'sealed', stage: 'imported', sourceVersion: preparation.sourceVersion, planDigest: planDigest(preparation) } },
    other: { profile: { preserved: ' Unchanged ' } },
  } }
  const request = vi.fn(async (url, options) => {
    if (url.includes('9099')) return { ok: true, json: async () => ({ users: [{ localId: 'owner', email: 'fixture@example.test' }] }) }
    if (url.includes('.settings')) return { ok: true, json: async () => JSON.parse(readFileSync(resolve('experiments/historical-import/database.rules.json'), 'utf8')) }
    if (options.method === 'PUT') return { ok: false, status: 500 }
    return { ok: true, headers: new Headers({ etag: '"fixture-root-version"' }), text: async () => JSON.stringify(root) }
  })
  await expect(createEmulatorFinalizationServer({ request }).finalize(context)).rejects.toThrow('observation-or-commit-uncertain')
  const [url, options] = request.mock.calls.find(([, options]) => options.method === 'PUT')
  expect(url).toBe('http://127.0.0.1:9000/.json?ns=demo-dear-pages&format=export')
  expect(options.headers['if-match']).toBe('"fixture-root-version"')
  const written = JSON.parse(options.body)
  expect(written.accountControl).toEqual(root.accountControl)
  expect(written.users.other).toEqual(root.users.other)
  expect(written.users.owner.bookProtocol.state).toBe('ready')
  expect(root.users.owner.bookProtocol.state).toBe('migrating')
})
it('does not import the server authority from any browser application source', () => {
  // Existing app entry graph remains client-only. The new pure DTO may be shared;
  // the process-only authority must never be reachable through a source import.
  const files = ['src/main.jsx', 'src/services/generationApplicationService.js', 'src/utils/historicalFinalizationRecord.js']
  for (const file of files) expect(readFileSync(resolve(file), 'utf8')).not.toContain('finalize.server')
})
