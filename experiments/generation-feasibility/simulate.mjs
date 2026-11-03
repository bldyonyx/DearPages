import { readFile } from 'node:fs/promises'
import { assertEmulatorProject } from '../../scripts/emulatorSafety.mjs'

/** Local Emulator's non-mutating rules simulator. Auth is deliberately a
 * non-admin owner claim. No credentials or data values are logged. */
export async function simulate(uid, updates) {
  await assertEmulatorProject()
  const rules = await readFile(new URL('database.rules.json', import.meta.url), 'utf8')
  const response = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages', {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules, auth: { uid }, action: { type: 'patch', path: '/', data: updates } }),
    redirect: 'error', signal: AbortSignal.timeout(15000),
  })
  const result = await response.json()
  // Simulator traces contain rule expressions but not application content. Keep
  // only failure outcomes/trace structure; redact the ephemeral owner ID.
  const events = result.write?.events || []
  const failures = events.filter(event => (event.type === 'validate' && event.result === false) || event.errors?.length)
    .map(({ type, path, line, expr, errors }) => ({ type, path: path.replaceAll(uid, '<uid>'), line, expr, errors }))
  console.log('RULE_SIMULATION', JSON.stringify({ keys: Object.keys(result), failures }).slice(0, 15000))
  return result
}
