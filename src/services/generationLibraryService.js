import { getAuth } from 'firebase/auth'
import { ref, runTransaction } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { createBookMutationContext, validateBookMutationContext } from '../utils/bookMutationContext.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import { bookLibraryPath } from '../utils/bookGenerationPaths.js'
import {
  validateGenerationLibraryRecord, validateGenerationLibraryPatch, validateGenerationLibraryExpected, makeGenerationStatusPatch,
} from '../utils/generationLibraryModel.js'
import { sanitizeNoteHtml } from '../utils/noteHtmlSanitizer.js'

const failure = code => Object.assign(new Error(`generation-library/${code}`), { code: `generation-library/${code}` })
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const denied = error => /permission[ _-]?denied/i.test(error.code || error.message || '')

/** Isolated, demo-only repository. All mutations capture a frozen generation.
 * No application singleton, business integration, implicit activation or retry.
 * Lifecycle and its guard are reused; deletion remains exclusively its concern.
 */
export function createGenerationLibraryService(database) {
  const lifecycle = createBookLifecycleService(database)
  function owner(uid) {
    validateRtdbPathSegment(uid)
    createBookLifecycleService(database) // Reuse the existing fail-closed guard.
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== uid) throw failure('owner-mismatch')
    return auth
  }
  function capture(input) {
    const context = createBookMutationContext(validateBookMutationContext(input))
    owner(context.uid)
    return context
  }
  async function readServer(uid, path) {
    const token = await owner(uid).currentUser.getIdToken()
    owner(uid)
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const url = new URL(`http://${emulator.host}:${emulator.database}/${encodedPath}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (response.status === 401 || response.status === 403) throw failure('permission-denied')
      if (!response.ok) throw failure('server-error')
      return await response.json()
    } catch (error) {
      if (error.code?.startsWith('generation-library/')) throw error
      throw failure('network-error') // Never expose credential URLs in errors.
    }
  }
  async function requireState(context, state) {
    const current = await lifecycle.readLifecycle(context)
    if (!current) throw failure('not-found')
    if (current.generation !== context.generation) throw failure('stale-generation')
    if (current.state !== state) throw failure('not-active')
  }
  async function readRecord(context) {
    const raw = await readServer(context.uid, bookLibraryPath(context))
    if (!raw) throw failure('not-found')
    return validateGenerationLibraryRecord(context, raw)
  }

  /** Accepts a full projected record (e.g. createGenerationLibraryBook output).
   * Initialization is idempotent only for exactly the same stored payload while
   * still creating. Never overwrites a competing initializer, even for same gen.
   */
  async function initializeLibrary(input, record) {
    const context = capture(input)
    const payload = validateGenerationLibraryRecord(context, record)
    for (const field of ['note', 'review']) if (Object.hasOwn(payload, field)) payload[field] = sanitizeNoteHtml(payload[field])
    await requireState(context, 'creating')
    const previous = await readServer(context.uid, bookLibraryPath(context))
    if (previous !== null) {
      if (!equal(validateGenerationLibraryRecord(context, previous), payload)) throw failure('initialization-conflict')
      return { context, book: payload }
    }
    owner(context.uid)
    try {
      await runTransaction(ref(database, bookLibraryPath(context)), current => current === null ? payload : undefined,
        { applyLocally: false })
    } catch (error) {
      if (!denied(error)) throw error
      // A competing initializer may have won. Only server evidence is accepted.
    }
    await requireState(context, 'creating')
    const confirmed = await readRecord(context)
    if (!equal(confirmed, payload)) throw failure('initialization-conflict')
    return { context, book: confirmed }
  }

  async function getActiveBook(input) {
    const context = capture(input)
    await requireState(context, 'active')
    const book = await readRecord(context)
    await requireState(context, 'active')
    return { context, book }
  }

  /** Discovery only: returns explicit contexts alongside books, newest first.
   * This is not an atomic whole-library snapshot. A lifecycle race fails rather
   * than silently replacing a captured generation; caller can explicitly reload.
   */
  async function getActiveBooks(uid) {
    owner(uid)
    const lives = await readServer(uid, `users/${uid}/bookLifecycle`) || {}
    const results = []
    for (const [bookId, current] of Object.entries(lives)) {
      if (current.state !== 'active') continue
      const context = createBookMutationContext({ uid, bookId, generation: current.generation })
      results.push(await getActiveBook(context))
    }
    return results.sort((a, b) => b.book.addedAt - a.book.addedAt)
  }

  async function mutate(context, makePatch, expected) {
    const { book: baseline } = await getActiveBook(context)
    if (expected && Object.entries(expected).some(([key, value]) => (baseline[key] ?? null) !== value)) {
      throw failure('field-conflict')
    }
    if (!makePatch(baseline)) return { context, book: baseline, patch: null }
    let conflict = false, applied = null
    owner(context.uid)
    const result = await runTransaction(ref(database, bookLibraryPath(context)), current => {
      conflict = false
      applied = null
      // A valid non-destructive proposal allows RTDB to compare hashes on a cold
      // SDK cache. A stale hash retries against the server's actual full record.
      // Never propose null/deletion or switch the reference to another epoch.
      const stored = current ?? baseline
      if (expected && Object.entries(expected).some(([key, value]) => (stored[key] ?? null) !== value)) {
        conflict = true
        return undefined
      }
      const patch = makePatch(stored)
      if (!patch) return stored // Hash-checked no-op, never trust a stale cache.
      applied = patch
      return { ...stored, ...patch }
    }, { applyLocally: false })
    if (conflict) throw failure('field-conflict')
    await requireState(context, 'active')
    const book = await readRecord(context)
    if (!result.committed && applied) throw failure('transaction-conflict')
    return { context, book, patch: result.committed ? applied : null }
  }

  function options(input = {}) {
    if (!input || Object.getPrototypeOf(input) !== Object.prototype ||
        Object.keys(input).some(key => key !== 'expected')) throw new TypeError('Invalid mutation options.')
    if (input.expected === undefined) return undefined
    return validateGenerationLibraryExpected(input.expected)
  }

  async function updateBookStatus(input, status, settings) {
    const context = capture(input), expected = options(settings), now = Date.now()
    makeGenerationStatusPatch({ status }, status, now)
    return mutate(context, stored => makeGenerationStatusPatch(stored, status, now), expected)
  }

  async function updateLibraryFields(input, inputPatch, settings) {
    const context = capture(input), expected = options(settings), now = Date.now()
    const patch = Object.freeze(validateGenerationLibraryPatch(inputPatch))
    return mutate(context, stored => Object.entries(patch).every(([key, value]) => (stored[key] ?? null) === value)
      ? null : { ...patch, updatedAt: now }, expected)
  }

  return Object.freeze({
    initializeLibrary, getActiveBook, getActiveBooks, updateBookStatus, updateLibraryFields,
    updateBookStartedAt: (context, value, settings) => updateLibraryFields(context, { startedAt: value ?? null }, settings),
    updateBookFinishedAt: (context, value, settings) => updateLibraryFields(context, { finishedAt: value ?? null }, settings),
    updateBookAbandonedAt: (context, value, settings) => updateLibraryFields(context, { abandonedAt: value ?? null }, settings),
    // Compatibility only: both reject locally with historical-source-readonly.
    // Sources may be supplied at initialization while creating; subsequent text
    // mutations and explicit conversions belong to the generation notes service.
    updateBookNote: (context, value, settings) => updateLibraryFields(context, { note: value }, settings),
    updateBookReview: (context, value, settings) => updateLibraryFields(context, { review: value }, settings),
    updateBookRating: (context, value, settings) => updateLibraryFields(context, { rating: value }, settings),
    // Interface only: delegates to the existing lifecycle, never implements purge.
    deleteGeneration: context => lifecycle.deleteGeneration(capture(context)),
    resumeDeletion: context => lifecycle.resumeDeletion(capture(context)),
  })
}
