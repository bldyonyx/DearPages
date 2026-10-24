import { afterEach, describe, expect, it, vi } from 'vitest'
import { emulatorEnv, validateEmulatorEnv } from '../config/firebaseEmulator.js'
import { assertEmulatorsReady, validateEmulatorConfig, windowsExcludedPorts } from '../../scripts/emulatorSafety.mjs'

const sdk = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getAuth: vi.fn(() => ({ name: 'auth' })),
  getDatabase: vi.fn(() => ({ name: 'database' })),
  connectAuthEmulator: vi.fn(), connectDatabaseEmulator: vi.fn(),
}))
vi.mock('firebase/app', () => ({ initializeApp: sdk.initializeApp }))
vi.mock('firebase/auth', () => ({ getAuth: sdk.getAuth, connectAuthEmulator: sdk.connectAuthEmulator }))
vi.mock('firebase/database', () => ({ getDatabase: sdk.getDatabase, connectDatabaseEmulator: sdk.connectDatabaseEmulator }))

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules() })

function localEnvironment() {
  for (const [key, value] of Object.entries(emulatorEnv)) vi.stubEnv(key, value)
  vi.stubEnv('MODE', 'emulator')
  vi.stubEnv('PROD', false)
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:5501' })
}

describe('Firebase emulator isolation', () => {
  it('accepts only the complete fixed local environment', () => {
    expect(validateEmulatorEnv(emulatorEnv, 'emulator')).toBe(true)
    for (const key of Object.keys(emulatorEnv)) {
      expect(() => validateEmulatorEnv({ ...emulatorEnv, [key]: 'wrong' }, 'emulator')).toThrow()
      const missing = { ...emulatorEnv }; delete missing[key]
      expect(() => validateEmulatorEnv(missing, 'emulator')).toThrow()
    }
    expect(() => validateEmulatorEnv({ ...emulatorEnv, VITE_FIREBASE_UNKNOWN: 'x' }, 'emulator')).toThrow()
    expect(() => validateEmulatorEnv(emulatorEnv, 'emulator', true)).toThrow()
    expect(() => validateEmulatorEnv(emulatorEnv, 'development')).toThrow()
    expect(validateEmulatorEnv({}, 'development')).toBe(false)
    expect(validateEmulatorEnv({}, 'production', true)).toBe(false)
  })

  it('keeps the dedicated CLI configuration fixed', async () => {
    await expect(validateEmulatorConfig()).resolves.toBeUndefined()
    expect(windowsExcludedPorts(' 5141 5240\r\n 5241 5340\r\n 50000 50059 *\r\n'))
      .toEqual([[5141, 5240], [5241, 5340], [50000, 50059]])
  })

  it('checks only loopback services and refuses missing or mismatched services', async () => {
    const fetcher = vi.fn(async (url) => {
      expect(new URL(url).hostname).toBe('127.0.0.1')
      if (url.endsWith('/emulators')) return { ok: true, json: async () => ({ auth: { host: '127.0.0.1', port: 9099 }, database: { host: '127.0.0.1', port: 9000 } }) }
      if (url.includes('/config')) return { ok: true, json: async () => ({}) }
      return { status: 401, json: async () => ({ error: 'Permission denied' }) }
    })
    await assertEmulatorsReady(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await expect(assertEmulatorsReady(vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow('offline')
    await expect(assertEmulatorsReady(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ auth: { host: 'remote', port: 9099 } }) }))).rejects.toThrow('Unexpected emulator service')
  })

  it('refuses initialization before any SDK call when readiness fails', async () => {
    localEnvironment()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(import('../services/firebase.js')).rejects.toThrow('refusing Firebase initialization')
    expect(sdk.initializeApp).not.toHaveBeenCalled()
    expect(sdk.getAuth).not.toHaveBeenCalled()
    expect(sdk.getDatabase).not.toHaveBeenCalled()
  })

  it('refuses a real project or wrong origin before any SDK call', async () => {
    localEnvironment()
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'real-project')
    await expect(import('../services/firebase.js')).rejects.toThrow('VITE_FIREBASE_PROJECT_ID')
    expect(sdk.initializeApp).not.toHaveBeenCalled()
    vi.resetModules()
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-dear-pages')
    vi.stubGlobal('location', { origin: 'https://example.com' })
    await expect(import('../services/firebase.js')).rejects.toThrow('dedicated local Vite origin')
    expect(sdk.initializeApp).not.toHaveBeenCalled()
  })

  it('connects both emulators before exposing Firebase to application imports', async () => {
    localEnvironment()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ projectId: 'demo-dear-pages' }) }))
    const result = await import('../services/firebase.js')
    expect(sdk.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'demo-dear-pages', apiKey: 'demo-only-api-key', databaseURL: emulatorEnv.VITE_FIREBASE_DATABASE_URL }))
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(result.auth, 'http://127.0.0.1:9099')
    expect(sdk.connectDatabaseEmulator).toHaveBeenCalledWith(result.database, '127.0.0.1', 9000)
    expect(sdk.getAuth.mock.invocationCallOrder[0]).toBeLessThan(sdk.connectAuthEmulator.mock.invocationCallOrder[0])
    expect(sdk.connectAuthEmulator.mock.invocationCallOrder[0]).toBeLessThan(sdk.getDatabase.mock.invocationCallOrder[0])
  })

  it('preserves normal configuration and never calls emulator connectors', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'existing-project')
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', undefined)
    await import('../services/firebase.js')
    expect(sdk.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'existing-project' }))
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled()
    expect(sdk.connectDatabaseEmulator).not.toHaveBeenCalled()
  })
})
