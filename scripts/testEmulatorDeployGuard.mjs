// Offline regression against the installed Firebase CLI's real target filtering,
// lifecycle hook runner and deployment orchestration. No CLI entrypoint, account
// loading, authentication, telemetry, or real deploy target is imported.
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
function findCli() {
  try { return dirname(require.resolve('firebase-tools/package.json')) } catch { /* Global CLI is also supported. */ }
  const found = process.platform === 'win32'
    ? spawnSync('where.exe', ['firebase.cmd'], { encoding: 'utf8' }) : undefined
  const candidates = process.platform === 'win32'
    ? [
      ...(found.status === 0 ? found.stdout.trim().split(/\r?\n/)
        .map((path) => join(dirname(path), 'node_modules/firebase-tools')) : []),
      join(process.env.APPDATA, 'npm/node_modules/firebase-tools'),
    ]
    : [join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'firebase-tools')]
  const cli = candidates.find((path) => existsSync(join(path, 'package.json')))
  assert.ok(cli, 'Install firebase-tools@15.31.0 to run the offline CLI regression')
  return cli
}
const cli = findCli()
assert.equal(JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8')).version, '15.31.0',
  'Review CLI internals and revalidate the guard before changing the tested version')
const cliRequire = createRequire(join(cli, 'package.json'))
const lodash = cliRequire('lodash')
const colors = cliRequire('colorette')
const quiet = () => {}
class FirebaseError extends Error {}
const stages = []
const target = Object.fromEntries(['prepare', 'deploy', 'release'].map((stage) => [stage, async () => { stages.push(stage) }]))
const dependencies = {
  lodash, colorette: colors, path: cliRequire('node:path'),
  '../error': { FirebaseError },
  '../logger': { logger: { info: quiet } },
  '../projectUtils': { needProjectId: (options) => options.project },
  '../utils': { logBullet: quiet, logWarning: quiet, logSuccess: quiet, consoleUrl: quiet, addSubdomain: quiet },
  '../track': { trackGA4: quiet },
  '../api': {},
  '../experiments': { assertEnabled() { throw new Error('Unexpected experiment') } },
  '../requirePermissions': { requirePermissions() { throw new Error('Network permission check forbidden in offline test') } },
  '../frameworks': { prepareFrameworks() { throw new Error('Unexpected framework preparation') } },
  './hosting/prepare': { hasPinnedFunctions: () => false },
  './dataconnect/context': {},
  '../vsCodeUtils': { isVSCodeExtension: () => false },
  // Only the fixed local refusal hook may spawn a process. Its Node executable
  // imports nothing, so it cannot load credentials, telemetry or deploy code.
  child_process: {
    spawn(command, args, options) {
      assert.ok(command.includes('scripts/refuseEmulatorDeploy.mjs'))
      assert.equal(options.cwd, root.replace(/[\\/]$/, ''))
      assert.equal(args.length, 0)
      return spawn(command, args, { ...options, stdio: 'pipe' })
    },
  },
}

function loadCli(relative, overrides = {}) {
  const filename = join(cli, 'lib', relative)
  const module = { exports: {} }
  const safeRequire = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name]
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`Offline CLI harness refused dependency: ${name}`)
  }
  safeRequire.resolve = (name) => {
    assert.equal(name, 'cross-env')
    return cliRequire.resolve(name)
  }
  vm.runInNewContext(readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: safeRequire, __dirname: dirname(filename),
    process: { execPath: process.execPath, platform: process.platform, env: {}, stdout: process.stdout },
    console: { log: quiet },
  }, { filename })
  return module.exports
}

const { lifecycleHooks } = loadCli('deploy/lifecycleHooks.js')
const targetStubs = Object.fromEntries([
  'hosting', 'database', 'firestore', 'functions', 'storage', 'remoteconfig',
  'extensions', 'dataconnect', 'apphosting', 'auth', 'ailogic',
].map((name) => [`./${name}`, target]))
const { deploy, VALID_DEPLOY_TARGETS } = loadCli('deploy/index.js', {
  ...targetStubs, './lifecycleHooks': { lifecycleHooks },
})
const { filterTargets } = loadCli('filterTargets.js', { './error': { FirebaseError } })
const isolated = JSON.parse(readFileSync(join(root, 'firebase.emulators.json'), 'utf8'))
const normal = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'))
function configView(src) {
  return {
    projectDir: root.replace(/[\\/]$/, ''), src,
    get: (key) => lodash.get(src, key), has: (key) => lodash.has(src, key),
    path: (path) => resolve(root, path),
  }
}

test('the fixed hook refuses every project and environment without imports', () => {
  const result = spawnSync(process.execPath, ['scripts/refuseEmulatorDeploy.mjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GCLOUD_PROJECT: 'demo-dear-pages', FIREBASE_EMULATOR_HUB: '127.0.0.1:4400' },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /DEPLOYMENT_REFUSED/)
})

for (const flags of [
  {}, { only: 'database' }, { only: 'database,hosting' }, { only: 'hosting,database' },
  { only: 'database:unknown' }, { dryRun: true }, { force: true },
  { only: 'hosting' }, { only: 'functions' }, { except: 'database' },
]) {
  test(`CLI rejects emulator deployment ${JSON.stringify(flags)} before any deploy stage`, async () => {
    stages.length = 0
    const options = { config: configView(isolated), project: 'demo-dear-pages', projectRoot: root, ...flags }
    await assert.rejects(async () => {
      const targets = filterTargets(options, VALID_DEPLOY_TARGETS)
      await deploy(targets, options)
    }, /database predeploy error: Command terminated with non-zero exit code 1|Cannot understand what targets/)
    assert.deepEqual(stages, [])
  })
}

test('normal Hosting selection and lifecycle have no emulator refusal hook', async () => {
  stages.length = 0
  const options = { config: configView(normal), project: 'demo-dear-pages', projectRoot: root, only: 'hosting' }
  const targets = filterTargets(options, VALID_DEPLOY_TARGETS)
  assert.deepEqual(Array.from(targets), ['hosting'])
  assert.ok(normal.hosting.every((config) => !config.predeploy))
  await deploy(targets, options)
  assert.deepEqual(stages, ['prepare', 'deploy', 'release']) // Local stubs only.
})

test('no other deployable target can bypass the database guard in this configuration', () => {
  assert.deepEqual(Array.from(VALID_DEPLOY_TARGETS).filter((key) => key in isolated), ['database'])
  for (const database of isolated.database) {
    assert.deepEqual(database.predeploy, ['node scripts/refuseEmulatorDeploy.mjs'])
    assert.equal(database.target, undefined)
  }
})

// Exercise the actual emulator command dispatchers as well. Service startup is
// simulated here; test:emulator:integration separately runs real Auth and RTDB.
class Command {
  constructor() { this.befores = [] }
  before(fn) { this.befores.push(fn); return this }
  description() { return this }
  option() { return this }
  action(fn) { this.actionFn = fn; return this }
}
for (const name of ['start', 'exec']) {
  test(`CLI emulators:${name} dispatches without running deployment hooks`, async () => {
    const calls = []
    const options = { config: configView(isolated), project: 'demo-dear-pages', only: 'auth,database' }
    let shutdown
    const stopped = new Promise((resolve) => { shutdown = resolve })
    const commandUtils = {
      setExportOnExitOptions: quiet, beforeEmulatorCommand: quiet,
      shutdownWhenKilled: () => stopped,
      emulatorExec: async (script, received) => {
        assert.equal(script, 'local-test')
        assert.equal(received, options)
        calls.push('exec')
      },
    }
    const controller = {
      startAll: async (received) => {
        assert.equal(received, options)
        calls.push('start')
        return { deprecationNotices: [] }
      },
      filterEmulatorTargets: () => [],
      cleanShutdown: async () => { throw new Error('Unexpected startup failure') },
    }
    const { command } = loadCli(`commands/emulators-${name}.js`, {
      '../command': { Command }, '../emulator/commandUtils': commandUtils,
      '../emulator/controller': controller,
      '../emulator/registry': { EmulatorRegistry: { getInfo: () => undefined, isRunning: () => false } },
      '../emulator/types': { Emulators: { LOGGING: 'logging', UI: 'ui', EXTENSIONS: 'extensions', HUB: 'hub' } },
      '../emulator/constants': {},
      '../dataconnect/webhook': { VSCODE_MESSAGE: {}, sendVSCodeMessage: async () => { shutdown() } },
      'cli-table3': cliRequire('cli-table3'),
    })
    for (const before of command.befores) await before(options)
    if (name === 'start') await command.actionFn(options)
    else await command.actionFn('local-test', options)
    assert.deepEqual(calls, [name])
  })
}
