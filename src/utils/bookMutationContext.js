import { validateRtdbPathSegment } from './rtdbPathSegment.js'

export const MAX_BOOK_GENERATION = 2147483647

/** @typedef {{uid: string, bookId: string, generation: number}} BookMutationContext */

function readContext(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype ||
      Reflect.ownKeys(input).length !== 3) {
    throw new TypeError('Expected exactly uid, bookId and generation.')
  }
  // Reject inherited fields, accessors and hidden fields before reading values.
  const descriptors = Object.getOwnPropertyDescriptors(input)
  for (const key of ['uid', 'bookId', 'generation']) {
    const descriptor = descriptors[key]
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      throw new TypeError('Context fields must be own enumerable data properties.')
    }
  }
  const uid = validateRtdbPathSegment(descriptors.uid.value)
  const bookId = validateRtdbPathSegment(descriptors.bookId.value)
  const generation = descriptors.generation.value
  if (!Number.isInteger(generation) || generation < 1 || generation > MAX_BOOK_GENERATION) {
    throw new TypeError('Generation must be an integer from 1 to 2147483647.')
  }
  return { uid, bookId, generation }
}

/**
 * Capture an explicit generation as a fresh, frozen value object.
 * No Firebase access, lookup, generation increment or input mutation occurs.
 * Existing callers must retain this value throughout an operation and retries;
 * constructing a newer context does not retarget any previously captured work.
 * @param {BookMutationContext} input A plain object with exactly these fields.
 * @returns {Readonly<BookMutationContext>}
 * @throws {TypeError} For invalid fields or unsupported object shapes.
 */
export function createBookMutationContext(input) {
  return Object.freeze(readContext(input))
}

/**
 * Validate a frozen context, including structurally equivalent frozen objects.
 * Mutable inputs are accepted only by createBookMutationContext, which copies
 * them. No repair, coercion or generation refresh is performed here.
 * @param {unknown} context
 * @returns {Readonly<BookMutationContext>} The unchanged context.
 * @throws {TypeError} Unless the context is valid and frozen.
 */
export function validateBookMutationContext(context) {
  readContext(context)
  if (!Object.isFrozen(context)) throw new TypeError('Book mutation context must be frozen.')
  return context
}
