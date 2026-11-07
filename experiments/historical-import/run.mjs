import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkPorts, assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { verify } from './composeRules.mjs'
const existing = process.argv.length === 3 && process.argv[2] === '--existing'
assert.ok(process.argv.length === 2 || existing, 'Only --existing accepted')
assert.deepEqual(JSON.parse(await readFile(new URL('firebase.json', import.meta.url), 'utf8')), JSON.parse(await readFile(new URL('../generation-feasibility/firebase.json', import.meta.url), 'utf8')))
await verify()
const root = fileURLToPath(new URL('../../', import.meta.url))
if (existing) { await assertEmulatorProject(); await assertEmulatorsReady() }
else await checkPorts([9099, 9000, 4400, 4500])
const child = existing
  ? spawn(process.execPath, [`${root}node_modules/vitest/vitest.mjs`, 'run', '--config', 'vitest.config.js'], { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: { ...process.env, CI: 'true' } })
  : spawn('firebase', ['emulators:exec', '--config', 'firebase.json', '--project', 'demo-dear-pages', '--only', 'auth,database', `node ${root}node_modules/vitest/vitest.mjs run --config vitest.config.js`], { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1', DEBUG: '' } })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', code => { process.exitCode = code ?? 1 })
