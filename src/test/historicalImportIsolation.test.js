import { beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHistoricalImportService } from '../../experiments/historical-import/service.mjs'
import { ref, update } from 'firebase/database'

const fake = vi.hoisted(() => ({ auth: null }))
vi.mock('firebase/auth', () => ({ getAuth: () => fake.auth }))
vi.mock('firebase/database', () => ({ ref: vi.fn(), update: vi.fn() }))
const identity = { uid: 'owner', migrationId: 'fixture', transformVersion: 1 }
function database() {
  return { app: { options: { projectId: 'demo-dear-pages', databaseURL: 'http://127.0.0.1:9000?ns=demo-dear-pages' } },
    _repoInternal: { repoInfo_: { host: '127.0.0.1:9000', namespace: 'demo-dear-pages', secure: false, isUsingEmulator: true, nodeAdmin: false, emulatorOptions: {} } } }
}
beforeEach(() => {
  vi.clearAllMocks()
  fake.auth = { emulatorConfig: { protocol: 'http', host: '127.0.0.1', port: 9099 }, currentUser: { uid: 'owner', email: 'fixture@example.test', getIdToken: vi.fn(async () => 'fictional') } }
})
it.each([
  db => { db.app.options.projectId = 'production-refused' },
  db => { db.app.options.databaseURL = 'https://production-refused.invalid' },
  db => { db.app.options.databaseURL = 'http://127.0.0.1:9000?ns=another' },
  db => { db._repoInternal.repoInfo_.host = 'production-refused.invalid' },
  db => { db._repoInternal.repoInfo_.namespace = 'another' },
  db => { db._repoInternal.repoInfo_.nodeAdmin = true },
  db => { db._repoInternal.repoInfo_.isUsingEmulator = false },
  () => { fake.auth.emulatorConfig = null },
  () => { fake.auth.emulatorConfig.port = 9999 },
])('rejects non-demo endpoint/project/Auth/Admin capabilities before ref or network %#', change => {
  const db = database(), network = vi.fn(() => { throw new Error('No network permitted') })
  change(db); vi.stubGlobal('fetch', network)
  try { expect(() => createHistoricalImportService(db, identity)).toThrow('emulator-only'); expect(ref).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled() }
  finally { vi.unstubAllGlobals() }
})
it.each([
  () => { fake.auth.currentUser.uid = 'another-owner' },
  () => { fake.auth.currentUser.email = 'not-a-fictional-account.invalid' },
  () => { fake.auth.currentUser = null },
])('rejects wrong, non-fictional or absent owner %#', change => {
  change()
  expect(() => createHistoricalImportService(database(), identity)).toThrow('fictional-owner-required')
  expect(ref).not.toHaveBeenCalled()
})
it('rechecks endpoints after construction before any observation', async () => {
  const db = database(), service = createHistoricalImportService(db, identity), network = vi.fn()
  db._repoInternal.repoInfo_.namespace = 'another'
  vi.stubGlobal('fetch', network)
  try { await expect(service.begin()).rejects.toThrow('emulator-only'); expect(network).not.toHaveBeenCalled(); expect(ref).not.toHaveBeenCalled() }
  finally { vi.unstubAllGlobals() }
})
it('rechecks owner after token acquisition, before the first network request', async () => {
  const service = createHistoricalImportService(database(), identity), network = vi.fn()
  fake.auth.currentUser.getIdToken.mockImplementation(async () => { fake.auth.currentUser = null; return 'fictional' })
  vi.stubGlobal('fetch', network)
  try { await expect(service.begin()).rejects.toThrow('fictional-owner-required'); expect(network).not.toHaveBeenCalled(); expect(ref).not.toHaveBeenCalled() }
  finally { vi.unstubAllGlobals() }
})
it('does not expose any approval, activation, purge or Auth mutation API', () => {
  expect(Object.keys(createHistoricalImportService(database(), identity))).toEqual(['begin', 'resume', 'sealAndVerify'])
  expect(update).not.toHaveBeenCalled()
})
it('keeps the independent verifier graph free of transformer, services, SDK and dynamic imports', () => {
  const visited = new Set()
  function inspect(file) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    expect(source).not.toMatch(/\bimport\s*\(/)
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      expect(match[1]).not.toMatch(/historicalGenerationTransformer|firebase|services\//)
      if (match[1].startsWith('.')) inspect(resolve(dirname(file), match[1]))
    }
  }
  inspect(resolve('experiments/historical-import/verify.mjs'))
})
