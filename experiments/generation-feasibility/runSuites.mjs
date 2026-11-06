import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertEmulatorProject, assertEmulatorsReady } from '../../scripts/emulatorSafety.mjs'
import { compose, verify } from './composeRules.mjs'

assert.equal(process.argv.length, 2)
await assertEmulatorProject(); await assertEmulatorsReady(); await verify()
const root = fileURLToPath(new URL('../../', import.meta.url))
async function loadRules(source) {
  const response = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages', { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: source, redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Local rule profile rejected: ${await response.text()}`)
}
function run(cwd, config, extra = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`${root}node_modules/vitest/vitest.mjs`, 'run', '--config', config, ...extra], { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } })
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1))
  })
}
let failed = false
const experiment = fileURLToPath(new URL('.', import.meta.url))
const main = await run(experiment, 'vitest.config.js')
failed ||= main !== 0
if (!main) failed = (await run(experiment, 'reactLibrary.vitest.config.js')) !== 0 || failed
if (!main) {
  // Boundary profile changes only the absent-head genesis constant. No admin
  // fixture writes, no production path, no weakening of transition predicates.
  const boundary = (await compose()).replaceAll(".child('sequence').val() : 0) + 1", ".child('sequence').val() : 2147483645) + 1")
  assert.notEqual(boundary, await compose())
  await loadRules(boundary)
  failed = (await run(experiment, 'boundary.vitest.config.js')) !== 0 || failed
}
const suites = [
  ['generation-integration', 'generation-integration'],
  ['generation-collection-memberships', 'generation-collection-memberships'],
  ['generation-collection-catalog', 'generation-collection-catalog'],
  ['book-lifecycle-service', 'book-lifecycle'],
  ['book-lifecycle', 'book-lifecycle'],
  ['generation-library', 'generation-library'],
  ['generation-notes', 'generation-notes'],
  ['generation-ratings', 'generation-ratings'],
]
for (const [suite, rules] of suites) {
  console.log(`VALIDATION_SUITE ${suite}`)
  await loadRules(await readFile(new URL(`../${rules}/database.rules.json`, import.meta.url), 'utf8'))
  const code = await run(fileURLToPath(new URL(`../${suite}/`, import.meta.url)), 'vitest.config.js')
  failed ||= code !== 0
}
await loadRules(await readFile(new URL('../../emulator/database.rules.json', import.meta.url), 'utf8'))
console.log('VALIDATION_SUITE historical-rtdb')
failed = (await run(root, 'vitest.rtdb.config.js')) !== 0 || failed
process.exitCode = failed ? 1 : 0
