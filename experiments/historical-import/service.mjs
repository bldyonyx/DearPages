import { getAuth } from 'firebase/auth'
import { ref, update } from 'firebase/database'
import { createBookLifecycleService } from '../../src/services/bookLifecycleService.js'
import { transformHistoricalSnapshot } from '../../src/utils/historicalGenerationTransformer.js'
import { createMigrationIdentity, createMigrationCheckpoint, advanceMigrationCheckpoint } from '../../src/utils/generationMigrationContracts.js'
import { contractData, sameContract } from '../../src/utils/generationContractData.js'
import { verifyHistoricalImport } from './verify.mjs'
import { controlRoots, sourceValue, planDigest, receiptKey, receiptFor } from './protocol.mjs'

const failure = code => Object.assign(new Error(`historical-import/${code}`), { code: `historical-import/${code}` })
const stages = ['frozen', 'inventoried', 'planned', 'imported']
export function createHistoricalImportService(database, identity) {
  const migration = createMigrationIdentity(identity)
  if (migration.transformVersion !== 1) throw failure('unsupported-version')
  function owner() {
    createBookLifecycleService(database) // Existing fail-closed guard: BOTH SDK endpoints, demo namespace, non-Admin.
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== migration.uid || !auth.currentUser.email?.endsWith('@example.test')) throw failure('fictional-owner-required')
    return auth.currentUser
  }
  owner()
  const base = `users/${migration.uid}`
  async function read(path) {
    const token = await owner().getIdToken(); owner()
    const url = new URL(`http://127.0.0.1:9000/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', 'demo-dear-pages'); url.searchParams.set('auth', token)
    // Priorities must be visible; never silently convert export wrappers.
    url.searchParams.set('format', 'export')
    let response
    try { response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) }) }
    catch { throw failure('observation-unavailable') }
    owner()
    if (!response.ok) throw failure('observation-denied')
    return contractData(await response.json())
  }
  async function observe() {
    const before = await read(`accountControl/${migration.uid}`), user = await read(base), after = await read(`accountControl/${migration.uid}`)
    if (!sameContract(before, after) || before?.state !== 'active') throw failure('account-blocked')
    return { account: before, user: user || {} }
  }
  async function commit(values) {
    owner()
    try { await update(ref(database), values) }
    catch (error) {
      error.message += ` [${Object.keys(values).map(path => path.replaceAll(migration.uid, '<uid>')).join(',')}]`
      throw error
    }
    owner()
  }
  async function prepare(user, resumed) {
    const preparation = await transformHistoricalSnapshot(resumed ? sourceValue(user) : user, migration)
    if (preparation.status !== 'prepared') throw failure('incompatible-source')
    return preparation
  }
  function bound(user, preparation, account) {
    if (account.legacyClosed !== true || !sameContract(user.bookMigration ?? null, { id: migration.migrationId, version: 1 }) ||
      !sameContract(user.bookProtocol ?? null, { version: 2, state: 'migrating' }) || user.historicalImport?.sourceVersion !== preparation.sourceVersion ||
      user.historicalImport?.planDigest !== planDigest(preparation) || !stages.includes(user.historicalImport?.stage) || !['open', 'sealed'].includes(user.historicalImport?.phase)) throw failure('identity-or-source-conflict')
  }
  async function begin() {
    let { user, account } = await observe()
    if (user.historicalImport) {
      const preparation = await prepare(user, true); bound(user, preparation, account)
      const { complete } = scan(user, preparation)
      return contractData({ status: 'resumable', migration, checkpoint: createMigrationCheckpoint({ migration, stage: user.historicalImport.stage, completedUnits: preparation.plan.units.filter(unit => complete.has(unit.unitId)) }) })
    }
    if (account.legacyClosed !== false || controlRoots.some(key => user[key] != null)) throw failure('existing-generation-state')
    const preparation = await prepare(user, false)
    try { await commit({
      [`${base}/bookProtocol`]: { version: 2, state: 'migrating' }, [`${base}/bookMigration`]: { id: migration.migrationId, version: 1 },
      [`accountControl/${migration.uid}/legacyClosed`]: true,
      [`${base}/historicalImport`]: { sourceVersion: preparation.sourceVersion, planDigest: planDigest(preparation), phase: 'open', stage: 'frozen' },
    }) } catch (error) {
      const after = await observe()
      try { bound(after.user, preparation, after.account) } catch { throw error }
    }
    ;({ user, account } = await observe())
    bound(user, preparation, account)
    const sealedSource = await prepare(user, true)
    if (!sameContract(sealedSource.source, preparation.source)) throw failure('source-changed-during-freeze')
    return contractData({ status: 'frozen', migration, checkpoint: createMigrationCheckpoint({ migration, stage: 'frozen', completedUnits: [] }) })
  }
  function scan(user, preparation) {
    const complete = new Set(), missing = []
    for (const item of preparation.destinations) {
      const suffix = item.destinationPath.split('/').slice(2)
      const value = suffix.reduce((node, key) => node?.[key], user) ?? null
      const receipt = user.importReceipts?.[receiptKey(item.intent.unit.unitId)] ?? null
      if (value === null && receipt === null) { missing.push(item); continue }
      if (!sameContract(value, item.intent.payload) || !sameContract(receipt, receiptFor(item.intent))) throw failure('destination-or-receipt-conflict')
      complete.add(item.intent.unit.unitId)
    }
    return { complete, missing }
  }
  async function stage(next, preparation) {
    const { user, account } = await observe(); bound(user, preparation, account)
    const current = user.historicalImport.stage
    if (stages.indexOf(current) >= stages.indexOf(next)) return
    advanceMigrationCheckpoint(createMigrationCheckpoint({ migration, stage: current, completedUnits: [] }), createMigrationCheckpoint({ migration, stage: next, completedUnits: [] }))
    try { await commit({ [`${base}/historicalImport/stage`]: next }) }
    catch (error) {
      // Same immutable transition may have won concurrently. Never infer success
      // from a denied/network response; observe the exact bound server state.
      const after = await observe(); bound(after.user, preparation, after.account)
      if (stages.indexOf(after.user.historicalImport.stage) < stages.indexOf(next)) throw error
    }
  }
  async function resume({ maxUnits = Number.MAX_SAFE_INTEGER } = {}) {
    if (!Number.isSafeInteger(maxUnits) || maxUnits < 0) throw failure('invalid-limit')
    let { user, account } = await observe()
    const preparation = await prepare(user, true); bound(user, preparation, account)
    if (user.historicalImport.phase === 'sealed') return sealAndVerify()
    if (user.historicalImport.stage === 'frozen') await stage('inventoried', preparation)
    if (['frozen', 'inventoried'].includes(user.historicalImport.stage)) await stage('planned', preparation)
    ;({ user, account } = await observe()); bound(user, preparation, account)
    for (const book of preparation.books) {
      const bookId = book.context.bookId, life = user.bookLifecycle?.[bookId]
      if (life != null) {
        if (!sameContract(life, { generation: 1, state: 'creating' })) throw failure('lifecycle-conflict')
      } else {
        if (user.bookData?.[bookId] != null) throw failure('lifecycle-conflict')
        try { await commit({ [`${base}/bookLifecycle/${bookId}`]: { generation: 1, state: 'creating' } }) }
        catch (error) {
          const after = await observe(); bound(after.user, preparation, after.account)
          if (!sameContract(after.user.bookLifecycle?.[bookId] ?? null, { generation: 1, state: 'creating' })) throw error
        }
      }
    }
    let written = 0
    while (true) {
      ;({ user, account } = await observe()); bound(user, preparation, account)
      const { complete, missing } = scan(user, preparation)
      if (!missing.length) { await stage('imported', preparation); break }
      if (user.historicalImport.stage !== 'planned' || user.historicalImport.phase !== 'open') throw failure('incomplete-import')
      if (written >= maxUnits) break
      const item = missing.find(entry => entry.dependencies.every(id => complete.has(id)))
      if (!item) throw failure('dependency-conflict')
      try {
        await commit({ [item.destinationPath]: item.intent.payload, [`${base}/importReceipts/${receiptKey(item.intent.unit.unitId)}`]: receiptFor(item.intent) })
      } catch (error) {
        const after = await observe(); bound(after.user, preparation, after.account)
        if (!scan(after.user, preparation).complete.has(item.intent.unit.unitId)) throw error
      }
      written++
    }
    ;({ user, account } = await observe()); bound(user, preparation, account)
    const { complete, missing } = scan(user, preparation)
    return contractData({ status: missing.length ? 'interrupted' : 'imported-unfinalized', written,
      checkpoint: createMigrationCheckpoint({ migration, stage: user.historicalImport.stage, completedUnits: preparation.plan.units.filter(unit => complete.has(unit.unitId)) }), canApprove: false, canReady: false })
  }
  async function sealAndVerify() {
    let { user, account } = await observe()
    const preparation = await prepare(user, true); bound(user, preparation, account)
    if (user.historicalImport.stage !== 'imported') throw failure('incomplete-import')
    const precheck = verifyHistoricalImport(user, migration, { sealed: user.historicalImport.phase === 'sealed' })
    if (precheck.status !== 'verified-unfinalized') return precheck
    if (user.historicalImport.phase === 'open') {
      try { await commit({ [`${base}/historicalImport/phase`]: 'sealed' }) }
      catch (error) {
        const after = await observe(); bound(after.user, preparation, after.account)
        if (after.user.historicalImport.phase !== 'sealed') throw error
      }
    }
    ;({ user, account } = await observe()); bound(user, preparation, account)
    return verifyHistoricalImport(user, migration)
  }
  /** Owner-side diagnostic only; the actual authority is a controlled Node tool.
   * A verifier running as the owner is independent code, not a trusted principal.
   * Never accept a caller report/token, persist an approval, activate a book or
   * promote the protocol. Repeated/concurrent attempts only re-observe the seal.
   */
  async function finalize(...input) {
    if (input.length) throw failure('client-approval-forbidden')
    const { user, account } = await observe()
    const preparation = await prepare(user, true); bound(user, preparation, account)
    if (user.historicalImport.stage !== 'imported') throw failure('incomplete-import')
    if (user.historicalImport.phase !== 'sealed') throw failure('unsealed-import')
    const { missing } = scan(user, preparation)
    const verification = verifyHistoricalImport(user, migration)
    return contractData({ status: 'blocked', migration,
      reason: missing.length ? 'incomplete-import' : verification.status !== 'verified-unfinalized' ? 'verification-failed' : 'verification-authority-unavailable',
      sourceVersion: preparation.sourceVersion, planDigest: planDigest(preparation),
      verification, canApprove: false, canReady: false })
  }
  return Object.freeze({ begin, resume, sealAndVerify, finalize }) // No approval/write finalization capability.
}
