import { createBookMutationContext, validateBookMutationContext } from './bookMutationContext.js'

/** Internal contract readers: inspect descriptors before accessing caller data.
 * Reject accessors, symbols, hidden/extra/inherited fields and custom prototypes.
 * No getters, iterators, coercion hooks, clock, random source or SDK are used.
 */
export function contractRecord(input, required, optional = []) {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new TypeError('Expected a plain contract record.')
  }
  const descriptors = Object.getOwnPropertyDescriptors(input)
  const keys = Reflect.ownKeys(descriptors)
  const allowed = [...required, ...optional]
  if (required.some(key => !Object.hasOwn(descriptors, key))) throw new TypeError('Missing contract field.')
  const result = {}
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) throw new TypeError('Unexpected contract field.')
    const descriptor = descriptors[key]
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Contract accessors/hidden fields are forbidden.')
    result[key] = descriptor.value
  }
  return result
}

/** Read a dense ordinary array without invoking a supplied iterator or getter. */
export function contractArray(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) throw new TypeError('Expected a contract array.')
  const descriptors = Object.getOwnPropertyDescriptors(input)
  const length = descriptors.length.value
  if (Reflect.ownKeys(descriptors).length !== length + 1) throw new TypeError('Sparse or decorated contract array.')
  const result = []
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[String(i)]
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Invalid contract array entry.')
    result.push(descriptor.value)
  }
  return result
}

export function captureBookContext(input) {
  return createBookMutationContext(validateBookMutationContext(input))
}

export function assertSameBookContext(first, second) {
  const a = captureBookContext(first), b = captureBookContext(second)
  if (a.uid !== b.uid || a.bookId !== b.bookId || a.generation !== b.generation) {
    throw new TypeError('Book context mismatch; never retarget an operation.')
  }
}

export function positiveCounter(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Expected a positive safe integer counter.')
  return value
}

export function nextCounter(value) {
  positiveCounter(value)
  if (value === Number.MAX_SAFE_INTEGER) throw new RangeError('Counter exhausted; rollover is forbidden.')
  return value + 1
}

export function acknowledgedCreatedAt(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Expected an acknowledged creation timestamp.')
  return value
}

/** Nested inputs here must already be copied/frozen by their domain builders. */
export function operationEnvelope(type, context, entryId, payload, expected, extra = {}) {
  return Object.freeze({ context, type, entryId, payload: Object.freeze(payload), expected, ...extra })
}
