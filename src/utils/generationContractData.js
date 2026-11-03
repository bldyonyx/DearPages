import { contractArray, contractRecord } from './generationOperationUtils.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'

/** Descriptor-safe JSON values only. No getters/toJSON, clocks, SDK or DOM.
 * Canonical object order is for identity/comparison, never data repair. */
export function contractData(input, ancestors = new Set()) {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input
  if (typeof input === 'number' && Number.isFinite(input) && !Object.is(input, -0)) return input
  if (!input || typeof input !== 'object' || ancestors.has(input)) throw new TypeError('Invalid contract data.')
  const next = new Set(ancestors).add(input)
  if (Array.isArray(input)) return Object.freeze(contractArray(input).map(value => contractData(value, next)))
  const keys = Reflect.ownKeys(input)
  if (keys.some(key => typeof key !== 'string')) throw new TypeError('Symbolic contract key.')
  // Validate BEFORE copying: assigning __proto__ into an ordinary object would
  // otherwise invoke its inherited setter and silently lose the source key.
  keys.forEach(validateRtdbPathSegment)
  const value = contractRecord(input, keys)
  const entries = Object.keys(value).sort().map(key => {
    validateRtdbPathSegment(key)
    return [key, contractData(value[key], next)]
  })
  return Object.freeze(Object.fromEntries(entries))
}
export const canonicalContract = input => JSON.stringify(contractData(input))
export const sameContract = (first, second) => canonicalContract(first) === canonicalContract(second)
export function frozenContract(input) {
  const result = contractData(input)
  function frozen(value) {
    if (value && typeof value === 'object' && (!Object.isFrozen(value) || Object.values(value).some(item => !frozen(item)))) return false
    return true
  }
  if (!frozen(input)) throw new TypeError('Expected a deeply frozen contract.')
  return result
}
export function boundedCounter(value, max = 2147483647, min = 1) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError('Contract counter outside bounds.')
  return value
}
export const contractTimestamp = value => boundedCounter(value, Number.MAX_SAFE_INTEGER, 0)
export function contractBoolean(value) {
  if (typeof value !== 'boolean') throw new TypeError('Expected explicit boolean.')
  return value
}
export function contractEnum(value, values) {
  if (!values.includes(value)) throw new TypeError('Unsupported contract discriminator.')
  return value
}
export function contractFingerprint(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError('Expected supplied SHA-256 fingerprint.')
  return value
}
export const compareContractIds = (a, b) => a < b ? -1 : a > b ? 1 : 0
