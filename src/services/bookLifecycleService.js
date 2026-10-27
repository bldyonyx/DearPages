import { getAuth } from 'firebase/auth'
import { ref, set, update } from 'firebase/database'
import { emulator } from '../config/firebaseEmulator.js'
import {
  createBookMutationContext, MAX_BOOK_GENERATION, validateBookMutationContext,
} from '../utils/bookMutationContext.js'
import { bookDataPath, bookLifecyclePath, bookLibraryPath, bookProtocolPath } from '../utils/bookGenerationPaths.js'

const failure = code => Object.assign(new Error(`book-lifecycle/${code}`), { code: `book-lifecycle/${code}` })
const denied = error => /permission[ _-]?denied/i.test(error.code || error.message || '')
const states = ['creating', 'active', 'deleting', 'deleted']
const lifecycle = (generation, state) => Object.freeze({ generation, state })

/**
 * Isolated demo-only service. Inject an SDK Database already connected to the
 * fixed local RTDB AND Auth emulators. Never imports the application's Firebase
 * singleton. Construction and every operation fail closed outside this setup.
 * All methods require an immutable 8B.3.1 context; none resolves a newer epoch.
 * No operation automatically retries a network failure: retry explicitly using
 * the same context (and the same predecessor context for beginNextGeneration).
 */
export function createBookLifecycleService(database) {
  function connection() {
    if (database?.app?.options?.projectId !== emulator.projectId) throw failure('emulator-only')
    const configured = new URL(database.app.options.databaseURL)
    const auth = getAuth(database.app)
    const local = url => url.protocol === 'http:' && url.hostname === emulator.host &&
      url.port === String(emulator.database) && !url.username && !url.password
    // Inspect metadata BEFORE ref(): ref() starts the SDK connection. The public
    // ref.toString() omits the namespace, so it cannot reject a Database override
    // pointing at a different namespace. This isolated guard intentionally pins
    // the installed SDK's metadata shape and fails closed if it changes.
    const repo = database._repoInternal?.repoInfo_
    if (!local(configured) || configured.searchParams.get('ns') !== emulator.projectId ||
        repo?.host !== `${emulator.host}:${emulator.database}` || repo.namespace !== emulator.projectId ||
        repo.secure !== false || repo.isUsingEmulator !== true || repo.nodeAdmin !== false ||
        !repo.emulatorOptions || Object.keys(repo.emulatorOptions).length !== 0 ||
        auth.emulatorConfig?.host !== emulator.host || auth.emulatorConfig?.port !== emulator.auth ||
        auth.emulatorConfig?.protocol !== 'http') throw failure('emulator-only')
    return { auth }
  }
  connection()

  function capture(input) {
    // Copy primitive values as well as validating: subsequent async work never
    // consults a caller-owned object or another lifecycle to choose an epoch.
    const context = createBookMutationContext(validateBookMutationContext(input))
    const { auth } = connection()
    if (auth.currentUser?.uid !== context.uid) throw failure('owner-mismatch')
    return context
  }

  async function readServer(context, path) {
    const { auth } = connection()
    if (auth.currentUser?.uid !== context.uid) throw failure('owner-mismatch')
    const token = await auth.currentUser.getIdToken()
    // SDK get() can fall back to cached or optimistic data. A no-cache REST GET
    // gives explicit server evidence for idempotency/uncertain acknowledgements.
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const url = new URL(`http://${emulator.host}:${emulator.database}/${encodedPath}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    let response
    try {
      response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
    } catch {
      // Do not leak a URL containing credentials in a wrapped fetch error.
      throw failure('network-error')
    }
    if (response.status === 401 || response.status === 403) throw failure('permission-denied')
    if (!response.ok) throw failure('server-error')
    return response.json()
  }

  async function read(context) {
    const value = await readServer(context, bookLifecyclePath(context))
    if (value === null) return null
    if (!value || Object.keys(value).length !== 2 || !states.includes(value.state) ||
        !Number.isInteger(value.generation) || value.generation < 1 || value.generation > MAX_BOOK_GENERATION) {
      throw failure('contradictory-state')
    }
    return lifecycle(value.generation, value.state)
  }

  function expectGeneration(context, current) {
    if (!current) throw failure('not-found')
    if (current.generation !== context.generation) throw failure('stale-generation')
  }

  async function requireProtocol(context) {
    const value = await readServer(context, bookProtocolPath(context))
    if (value?.version !== 2 || value.state !== 'ready' || Object.keys(value).length !== 2) {
      throw failure('protocol-not-ready')
    }
  }

  async function ensurePurged(context) {
    // Read the entire book's generations, never delete this ancestor.
    const bookPath = bookDataPath(context).split('/').slice(0, -1).join('/')
    if (await readServer(context, bookPath) !== null) throw failure('contradictory-state')
  }

  async function transition(context, target, accepts) {
    await requireProtocol(context)
    const current = await read(context)
    if (current?.generation === context.generation && current.state === target) return current
    if (!accepts(current)) {
      if (current && current.generation !== context.generation) throw failure('stale-generation')
      throw failure('invalid-state')
    }
    connection()
    try {
      // Rules compare before AND after states. The preflight is for errors only;
      // it never grants a transition, even if another client changes state here.
      await set(ref(database, bookLifecyclePath(context)), lifecycle(context.generation, target))
    } catch (error) {
      if (!denied(error)) throw error
      const winner = await read(context)
      if (winner?.generation === context.generation && winner.state === target) return winner
      if (winner && winner.generation !== context.generation) throw failure('stale-generation')
      throw failure('transition-conflict')
    }
    // Do not label a concurrently advanced state as this operation's result.
    const confirmed = await read(context)
    expectGeneration(context, confirmed)
    if (confirmed.state !== target) throw failure('transition-conflict')
    return confirmed
  }

  /** Explicit demo bootstrap; never migrates data or updates an existing protocol. */
  async function initializeProtocol(input) {
    const context = capture(input)
    const current = await readServer(context, bookProtocolPath(context))
    if (current !== null) { await requireProtocol(context); return }
    try {
      await set(ref(database, bookProtocolPath(context)), { version: 2, state: 'ready' })
    } catch (error) {
      if (!denied(error)) throw error
      await requireProtocol(context)
    }
    await requireProtocol(context)
  }

  /** Read the actual state (possibly newer) without replacing the caller's context. */
  const readLifecycle = async input => read(capture(input))

  /** Only absent -> creating(1); repeats succeed only while still creating(1). */
  async function initializeGeneration(input) {
    const context = capture(input)
    if (context.generation !== 1) throw failure('invalid-initial-generation')
    await transition(context, 'creating', current => current === null)
    return context
  }

  /**
   * Supply the captured DELETED predecessor, never a freshly resolved lifecycle.
   * Its deterministic successor is computed once; retrying the predecessor can
   * only address that same successor. Returns its new frozen mutation context.
   */
  async function beginNextGeneration(input) {
    const previous = capture(input)
    if (previous.generation === MAX_BOOK_GENERATION) throw failure('generation-exhausted')
    const next = createBookMutationContext({ ...previous, generation: previous.generation + 1 })
    await transition(next, 'creating', current => current?.generation === previous.generation && current.state === 'deleted')
    return next
  }

  /** Library initialization remains a caller responsibility; rules require it. */
  async function activateGeneration(input) {
    const context = capture(input)
    expectGeneration(context, await read(context))
    // Also detect malformed admin/fixture states rather than accepting active
    // with no library as an idempotent result.
    if (await readServer(context, bookLibraryPath(context)) === null) throw failure('library-not-initialized')
    return transition(context, 'active', current => current?.generation === context.generation && current.state === 'creating')
  }

  /** Acknowledged durable lock. Does not purge or allow unlocking. */
  async function lockDeletion(input) {
    const context = capture(input)
    return transition(context, 'deleting', current => current?.generation === context.generation &&
      ['creating', 'active'].includes(current.state))
  }

  /** Requires an already acknowledged deleting state. Purge + deleted is atomic. */
  async function purgeGeneration(input) {
    const context = capture(input)
    await requireProtocol(context)
    const current = await read(context)
    expectGeneration(context, current)
    if (current.state === 'deleted') { await ensurePurged(context); return current }
    if (current.state !== 'deleting') throw failure('invalid-state')
    connection()
    try {
      await update(ref(database), {
        [bookDataPath(context)]: null,
        [bookLifecyclePath(context)]: lifecycle(context.generation, 'deleted'),
      })
    } catch (error) {
      if (!denied(error)) throw error
      const winner = await read(context)
      expectGeneration(context, winner)
      if (winner.state !== 'deleted') throw failure('transition-conflict')
    }
    const confirmed = await read(context)
    expectGeneration(context, confirmed)
    if (confirmed.state !== 'deleted') throw failure('transition-conflict')
    await ensurePurged(context)
    return confirmed
  }

  /** Resume only deleting/deleted; never starts deletion of an active book. */
  const resumeDeletion = input => purgeGeneration(input)

  /** Explicit lock then purge; retry uses this same generation, including deleted. */
  async function deleteGeneration(input) {
    const context = capture(input)
    const current = await read(context)
    expectGeneration(context, current)
    if (['creating', 'active'].includes(current.state)) {
      try { await lockDeletion(context) } catch (error) {
        if (!['book-lifecycle/invalid-state', 'book-lifecycle/transition-conflict'].includes(error.code)) throw error
        const winner = await read(context)
        expectGeneration(context, winner)
        if (!['deleting', 'deleted'].includes(winner.state)) throw error
      }
    }
    return purgeGeneration(context)
  }

  return Object.freeze({ initializeProtocol, readLifecycle, initializeGeneration, beginNextGeneration,
    activateGeneration, lockDeletion, purgeGeneration, resumeDeletion, deleteGeneration })
}
