import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { checkPorts } from '../../scripts/emulatorSafety.mjs'

assert.equal(process.argv.length, 2, 'No runner arguments are accepted')
const config = JSON.parse(await readFile(new URL('../book-lifecycle/firebase.json', import.meta.url), 'utf8'))
const expected = JSON.parse(await readFile(new URL('../../firebase.emulators.json', import.meta.url), 'utf8'))
expected.database[0].rules = 'database.rules.json'
expected.database[0].predeploy = ['node ../../scripts/refuseEmulatorDeploy.mjs']
assert.deepEqual(config, expected)
assert.equal(config.database[0].instance, 'demo-dear-pages')
await checkPorts([9099, 9000, 4400, 4500])
const child = spawn('firebase', [
  'emulators:exec', '--config', '../book-lifecycle/firebase.json',
  '--project', 'demo-dear-pages', '--only', 'auth,database',
  'node ../../node_modules/vitest/vitest.mjs run --config vitest.config.js',
], { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: { ...process.env, DEBUG: '', CI: 'true' } })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', code => { process.exitCode = code ?? 1 })
