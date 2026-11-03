import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { contractData, canonicalContract, frozenContract } from '../utils/generationContractData.js'
import { createMigrationIdentity, createMigrationUnit, createMigrationTransition } from '../utils/generationMigrationContracts.js'
import { createGenerationImport } from '../utils/generationImportContracts.js'
import { captureMembershipBatch } from '../utils/generationMembershipBatchContracts.js'
import { projectCollectionActivityEffect } from '../utils/generationCollectionActivityContracts.js'
import { createAccountControl, createAccountTransition, createBookRecoveryIntent } from '../utils/generationRecoveryContracts.js'
import { createBookMutationContext } from '../utils/bookMutationContext.js'

vi.mock('firebase/app', () => { throw new Error('Unexpected Firebase import') })
vi.mock('firebase/auth', () => { throw new Error('Unexpected Firebase import') })
vi.mock('firebase/database', () => { throw new Error('Unexpected Firebase import') })
vi.mock('dompurify', () => { throw new Error('Unexpected DOM import') })
vi.mock('../services/firebase.js', () => { throw new Error('Unexpected Firebase singleton') })

const modules = ['generationContractData', 'generationMigrationContracts', 'generationImportContracts', 'generationMembershipBatchContracts', 'generationCollectionActivityContracts', 'generationRecoveryContracts']
const context = createBookMutationContext({ uid: 'owner', bookId: 'book', generation: 1 })
const migration = createMigrationIdentity({ uid: 'owner', migrationId: 'migration', transformVersion: 1 })

it('has no Firebase, service, DOM dependency, or dynamic import in its local dependency graph', () => {
  const visited = new Set()
  function inspect(file) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    expect(source).not.toMatch(/\bimport\s*\(/)
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      expect(match[1]).not.toMatch(/^firebase(?:\/|$)|dompurify|services\//)
      if (match[1].startsWith('.')) inspect(resolve(dirname(file), match[1]))
    }
  }
  modules.forEach(name => inspect(resolve('src/utils', `${name}.js`)))
})
it('constructs deterministic data without clock, random source, network, crypto or DOM', () => {
  const forbidden = vi.fn(() => { throw new Error('Forbidden dependency') })
  const clock = vi.spyOn(Date, 'now').mockImplementation(forbidden), random = vi.spyOn(Math, 'random').mockImplementation(forbidden)
  vi.stubGlobal('fetch', forbidden)
  try {
    const unit = createMigrationUnit({ migration, kind: 'library', scope: ['book'] })
    expect(unit).toEqual(createMigrationUnit({ migration, kind: 'library', scope: ['book'] }))
    const payload = { id: 'book', title: 'Book', addedAt: 0, status: 'to-read' }
    const imported = createGenerationImport({ migration, kind: 'library', profile: 'legacy', context, entryId: null, payload })
    expect(imported.payload).toEqual(payload)
    expect(createMigrationTransition({ migration, from: 'absent', to: 'migrating', intentId: 'intent' }).legacyClosed).toBe(true)
    expect(captureMembershipBatch('owner', 'first', 1, [{ bookId: 'book', generation: 1, collectionId: 'c7', epoch: 1, catalogCreatedAt: 0, before: { exists: false }, desired: false }]).guards[0].after).toEqual({ exists: false })
    expect(projectCollectionActivityEffect({ kind: 'clear', changed: true, previous: null, catalogCreatedAt: 0, eventAt: null }).shouldWrite).toBe(false)
    expect(createBookRecoveryIntent({ context, intentId: 'intent', kind: 'resume-deletion', initializationId: null }).context).toEqual(context)
    expect(createAccountTransition({ uid: 'owner', intentId: 'delete', expected: createAccountControl({ state: 'active', legacyClosed: true }), target: { state: 'deleting', legacyClosed: true }, protocolAfter: 'ready', userDataAbsent: false }).target.state).toBe('deleting')
    expect(forbidden).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals(); clock.mockRestore(); random.mockRestore() }
})
it.each([undefined, NaN, Infinity, -0, 1n, Symbol('x'), () => 1, new Map(), new Set(), new Date(0)])('rejects unsupported contract values without JSON coercion %#', value => {
  expect(() => contractData({ value })).toThrow()
})
it('rejects inherited, accessor, symbolic, hidden and cyclic data before invoking code', () => {
  const getter = vi.fn(() => 'value')
  const cycle = {}; cycle.self = cycle
  const array = ['value']; Object.defineProperty(array, '0', { get: getter })
  const hostile = [cycle, array, Object.create({ inherited: 1 }), Object.assign(Object.create(null), { key: 1 }),
    { [Symbol('key')]: 1 }, Object.defineProperty({}, 'hidden', { value: true }),
    Object.defineProperty({}, 'key', { get: getter, enumerable: true }), { toJSON: getter }]
  for (const value of hostile) expect(() => contractData(value)).toThrow()
  expect(getter).not.toHaveBeenCalled()
})
it('validates discriminators before interpolation or caller coercion', () => {
  const hook = vi.fn(() => 'absent')
  expect(() => createMigrationTransition({ migration, intentId: 'intent', from: { toString: hook }, to: 'migrating' })).toThrow()
  expect(hook).not.toHaveBeenCalled()
})
it.each(['__proto__', 'constructor', 'prototype', '.priority', 'bad/key'])('rejects unsafe map key %s', key => {
  expect(() => contractData(Object.fromEntries([[key, 'value']]))).toThrow()
})
it('canonicalizes keys without changing array order, content or caller objects', () => {
  const input = { z: [' b ', 'a'], a: { n: null } }
  const copied = contractData(input)
  expect(canonicalContract(input)).toBe('{"a":{"n":null},"z":[" b ","a"]}')
  expect(input.z).toEqual([' b ', 'a'])
  expect(Object.isFrozen(input.z)).toBe(false)
  expect(Object.isFrozen(copied.z)).toBe(true)
  expect(frozenContract(copied)).toEqual(copied)
  expect(() => frozenContract(Object.freeze({ z: ['mutable'] }))).toThrow()
})
it.each([
  [createMigrationIdentity, { uid: 'owner', migrationId: 'migration', transformVersion: 1 }],
  [createAccountControl, { state: 'active', legacyClosed: true }],
])('public identity parsers reject unknown and accessor fields %#', (parser, input) => {
  expect(() => parser({ ...input, extra: true })).toThrow()
  const getter = vi.fn()
  const poisoned = Object.defineProperty({ ...input }, Object.keys(input)[0], { get: getter, enumerable: true })
  expect(() => parser(poisoned)).toThrow()
  expect(getter).not.toHaveBeenCalled()
})
