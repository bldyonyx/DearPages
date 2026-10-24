import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emulator } from '../src/config/firebaseEmulator.js'

export async function validateEmulatorConfig() {
  const config = JSON.parse(await readFile('firebase.emulators.json', 'utf8'))
  const expected = {
    database: [{
      instance: emulator.projectId, rules: 'emulator/database.rules.json',
      predeploy: ['node scripts/refuseEmulatorDeploy.mjs'],
    }],
    emulators: {
      auth: { host: emulator.host, port: emulator.auth },
      database: { host: emulator.host, port: emulator.database },
      hub: { host: emulator.host, port: emulator.hub },
      logging: { host: emulator.host, port: emulator.logging },
      ui: { enabled: false }, singleProjectMode: true,
    },
  }
  if (JSON.stringify(config) !== JSON.stringify(expected)) {
    throw new Error('Unexpected Firebase emulator configuration')
  }
}

export function windowsExcludedPorts(output) {
  return [...output.matchAll(/^\s*(\d+)\s+(\d+)\s*\*?\s*$/gm)]
    .map((match) => [Number(match[1]), Number(match[2])])
}

export async function checkPorts(ports) {
  if (process.platform === 'win32') {
    for (const family of ['ipv4', 'ipv6']) {
      const ranges = windowsExcludedPorts(execFileSync('netsh', [
        'interface', family, 'show', 'excludedportrange', 'protocol=tcp',
      ], { encoding: 'utf8' }))
      if (!ranges.length) throw new Error('Cannot verify Windows excluded ports')
      for (const port of ports) {
        if (ranges.some(([start, end]) => port >= start && port <= end)) {
          throw new Error(`Port ${port} is excluded by Windows`)
        }
      }
    }
  }
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = net.createServer()
      server.once('error', reject)
      server.listen(port, emulator.host, () => server.close(resolve))
    })
  }
}

export async function assertEmulatorsReady(fetcher = fetch) {
  const request = async (port, path) => {
    const response = await fetcher(`http://${emulator.host}:${port}${path}`, {
      signal: AbortSignal.timeout(2000), redirect: 'error',
    })
    if (!response.ok) throw new Error(`Emulator service unavailable: ${port}`)
    return response.json()
  }
  const services = await request(emulator.hub, '/emulators')
  for (const name of ['auth', 'database']) {
    if (services[name]?.host !== emulator.host || services[name]?.port !== emulator[name]) {
      throw new Error(`Unexpected emulator service: ${name}`)
    }
  }
  await request(emulator.auth, `/emulator/v1/projects/${emulator.projectId}/config`)
  // No admin token and no writes: the root must be denied by the local rules.
  const response = await fetcher(`http://${emulator.host}:${emulator.database}/.json?ns=${emulator.projectId}`, {
    signal: AbortSignal.timeout(2000), redirect: 'error',
  })
  const body = await response.json()
  if (response.status !== 401 || body.error !== 'Permission denied') {
    throw new Error('RTDB emulator must deny unauthenticated root access')
  }
}

export async function assertEmulatorProject() {
  const locator = JSON.parse(await readFile(join(tmpdir(), `hub-${emulator.projectId}.json`), 'utf8'))
  if (!locator.origins?.includes(`http://${emulator.host}:${emulator.hub}`) || !Number.isInteger(locator.pid)) {
    throw new Error('Emulator Hub does not match demo-dear-pages')
  }
  process.kill(locator.pid, 0)
}
