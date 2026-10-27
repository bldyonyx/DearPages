/* eslint-disable no-control-regex -- RTDB keys must reject control characters. */

/**
 * Validate one application RTDB key without coercion or normalization.
 * Matches the conservative note/rating identifier policy: 1–128 UTF-16 units,
 * no ASCII whitespace, RTDB separators, controls or unpaired surrogates.
 * Reserved object-property names are excluded to keep future object maps safe.
 * This intentionally accepts fewer keys than RTDB's general 768-byte limit.
 * @param {unknown} value
 * @returns {string} The unchanged key.
 * @throws {TypeError} For an unsafe or unsupported key.
 */
export function validateRtdbPathSegment(value) {
  if (typeof value !== 'string' || !value || value.length > 128 ||
      value.trim() !== value || /[.#$[\]/\u0000-\u0020\u007f\ud800-\udfff]/u.test(value) ||
      ['__proto__', 'prototype', 'constructor'].includes(value)) {
    throw new TypeError('Invalid RTDB path segment.')
  }
  return value
}
