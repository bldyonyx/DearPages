import { spawn } from 'node:child_process'
import { emulator } from '../src/config/firebaseEmulator.js'
import { checkPorts, validateEmulatorConfig } from './emulatorSafety.mjs'

await validateEmulatorConfig()
await checkPorts([emulator.auth, emulator.database, emulator.hub, emulator.logging])
const integration = process.argv.length === 3 && process.argv[2] === '--test'
if (process.argv.length > 2 && !integration) throw new Error('Unsupported emulator arguments')
const args = [integration ? 'emulators:exec' : 'emulators:start', '--config', 'firebase.emulators.json',
  '--project', emulator.projectId, '--only', 'auth,database']
if (integration) args.push('node scripts/testEmulators.mjs')
// Fixed command, no forwarded CLI arguments, no import/export or deployment.
const child = spawn(process.platform === 'win32' ? 'cmd.exe' : 'firebase',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `firebase.cmd ${args.map((arg) => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`]
    : args,
  { stdio: 'inherit', windowsVerbatimArguments: process.platform === 'win32',
    cwd: new URL('..', import.meta.url), env: { ...process.env, DEBUG: '', CI: 'true' } })
child.once('error', (error) => { console.error(error); process.exitCode = 1 })
child.once('exit', (code) => { process.exitCode = code ?? 1 })
