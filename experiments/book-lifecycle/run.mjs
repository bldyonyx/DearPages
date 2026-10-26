import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkPorts } from '../../scripts/emulatorSafety.mjs'

// Fixed demo project, ports, config and test command. No forwarded arguments,
// deployment, credential handling, data imports/exports or application Vite.
assert.equal(process.argv.length, 2, 'No runner arguments are accepted')
const cwd = fileURLToPath(new URL('.', import.meta.url))
const actual = JSON.parse(await readFile(new URL('firebase.json', import.meta.url), 'utf8'))
const expected = JSON.parse(await readFile(new URL('../../firebase.emulators.json', import.meta.url), 'utf8'))
expected.database[0].rules = 'database.rules.json'
expected.database[0].predeploy = ['node ../../scripts/refuseEmulatorDeploy.mjs']
assert.deepEqual(actual, expected)
assert.equal(actual.database[0].instance, 'demo-dear-pages')
await checkPorts([9099, 9000, 4400, 4500])
const child = spawn('firebase', [
  'emulators:exec', '--config', 'firebase.json', '--project', 'demo-dear-pages',
  '--only', 'auth,database',
  'node ../../node_modules/vitest/vitest.mjs run --config vitest.config.js',
], { cwd, stdio: 'inherit', env: { ...process.env, DEBUG: '', CI: 'true' } })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', code => { process.exitCode = code ?? 1 })
