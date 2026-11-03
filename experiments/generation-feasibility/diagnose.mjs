import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { verify } from './composeRules.mjs'

const mode = process.argv[2]
assert.ok(['targeted', 'sizes', 'keys', 'full', 'regressions', 'rules', 'stop'].includes(mode))
assert.equal(process.argv.length, 3)
await assertEmulatorProject(); await assertEmulatorsReady(); await verify()
if (mode === 'stop') {
  // assertEmulatorProject already verifies this locator and exact demo origin.
  const locator = JSON.parse(await readFile(join(tmpdir(), 'hub-demo-dear-pages.json'), 'utf8'))
  assert.ok(locator.origins.includes('http://127.0.0.1:4400'))
  assert.ok(Number.isInteger(locator.pid))
  process.kill(locator.pid, 'SIGINT')
  process.exit(0)
}
const source = await readFile(new URL('database.rules.json', import.meta.url), 'utf8')
const response = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages', { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: source, redirect: 'error', signal: AbortSignal.timeout(20000) })
assert.ok(response.ok, await response.text())
if (mode !== 'rules') {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const args = mode === 'regressions' ? ['runSuites.mjs'] : [`${root}node_modules/vitest/vitest.mjs`, 'run', '--config', 'vitest.config.js']
  if (mode === 'targeted') args.push('-t', 'C: different envelope|C: 65 commits|C/composed: book purge|C: 32 guarded')
  if (mode === 'sizes') args.push('-t', 'diagnostic: progressive')
  if (mode === 'keys') args.push('-t', 'diagnostic: valid identifier')
  const child = spawn(process.execPath, args, { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: { ...process.env, CI: 'true' } })
  child.once('error', error => { console.error(error); process.exitCode = 1 })
  child.once('exit', code => { process.exitCode = code ?? 1 })
}
