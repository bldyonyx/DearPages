import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { checkPorts } from '../../scripts/emulatorSafety.mjs'
import { verify } from './composeRules.mjs'
const serve = process.argv.length === 3 && process.argv[2] === '--serve'
assert.ok(process.argv.length === 2 || serve, 'Only --serve is accepted')
const config = JSON.parse(await readFile(new URL('firebase.json', import.meta.url), 'utf8'))
const expected = JSON.parse(await readFile(new URL('../generation-integration/firebase.json', import.meta.url), 'utf8'))
assert.deepEqual(config, expected)
assert.equal(config.database[0].instance, 'demo-dear-pages')
await verify()
await checkPorts([9099, 9000, 4400, 4500])
const args = [serve ? 'emulators:start' : 'emulators:exec', '--config', 'firebase.json', '--project', 'demo-dear-pages', '--only', 'auth,database']
if (!serve) args.push('node runSuites.mjs')
const child = spawn('firebase', args, { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: { ...process.env, CI: 'true', DEBUG: '' } })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', code => { process.exitCode = code ?? 1 })
