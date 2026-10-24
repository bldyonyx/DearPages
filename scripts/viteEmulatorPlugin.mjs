import { emulator } from '../src/config/firebaseEmulator.js'
import { assertEmulatorProject, assertEmulatorsReady, checkPorts, validateEmulatorConfig } from './emulatorSafety.mjs'

export function viteEmulatorPlugin() {
  return {
    name: 'dear-pages-emulator-isolation',
    configResolved(config) {
      if (config.server.host !== emulator.host || config.server.port !== emulator.vite || !config.server.strictPort) {
        throw new Error('Unexpected emulator Vite host or port')
      }
    },
    async configureServer(server) {
      await validateEmulatorConfig()
      await checkPorts([emulator.vite])
      await assertEmulatorProject()
      await assertEmulatorsReady()
      server.middlewares.use('/__emulator_health', async (_req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', 'application/json')
        try {
          await assertEmulatorProject()
          await assertEmulatorsReady()
          res.end(JSON.stringify({ projectId: emulator.projectId }))
        } catch {
          res.statusCode = 503
          res.end(JSON.stringify({ error: 'Local Firebase emulators unavailable' }))
        }
      })
    },
  }
}

export const emulatorServer = {
  host: emulator.host, port: emulator.vite, strictPort: true,
  headers: {
    'Content-Security-Policy': `connect-src 'self' http://127.0.0.1:${emulator.auth} http://127.0.0.1:${emulator.database} ws://127.0.0.1:${emulator.database} ws://127.0.0.1:${emulator.vite}; frame-src 'self' http://127.0.0.1:${emulator.auth}; form-action 'self'`,
  },
}
