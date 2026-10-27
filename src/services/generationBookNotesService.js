import { getAuth } from 'firebase/auth'
import { ref, runTransaction, serverTimestamp, update } from 'firebase/database'
import { createBookLifecycleService } from './bookLifecycleService.js'
import { emulator } from '../config/firebaseEmulator.js'
import { captureBookContext, contractRecord, contractArray, nextCounter } from '../utils/generationOperationUtils.js'
import { bookLibraryPath, bookNotesPath, bookNotesLegacyPath, bookReviewsLegacyPath } from '../utils/bookGenerationPaths.js'
import {
  createNoteConcurrencyToken, createNoteCreateOperation, createNotePatchOperation, createNoteSaveOperation,
  createNotePinOperation, createNoteDeleteOperation, createNoteSourceToken, createNoteConversionOperation,
} from '../utils/generationNoteContracts.js'
import { validateRtdbPathSegment } from '../utils/rtdbPathSegment.js'
import { compareBookNotes } from '../utils/bookNotesOrder.js'
import { sanitizeNoteHtml } from '../utils/noteHtmlSanitizer.js'

const failure = code => Object.assign(new Error(`generation-notes/${code}`), { code: `generation-notes/${code}` })
const initialFieldRevisions = () => ({ title: 1, contentHtml: 1, date: 1 })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const fingerprint = async value => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('')

/** Isolated demo-only repository. No singleton, discovery of generations, implicit
 * conversion or ID allocation. Keep the supplied operation for explicit retries.
 */
export function createGenerationBookNotesService(database) {
  const lifecycle = createBookLifecycleService(database)
  function owner(context) {
    createBookLifecycleService(database)
    const auth = getAuth(database.app)
    if (auth.currentUser?.uid !== context.uid) throw failure('owner-mismatch')
    return auth
  }
  function capture(input) {
    const context = captureBookContext(input)
    owner(context)
    return context
  }
  async function readServer(context, path) {
    const token = await owner(context).currentUser.getIdToken()
    owner(context)
    const url = new URL(`http://${emulator.host}:${emulator.database}/${path.split('/').map(encodeURIComponent).join('/')}.json`)
    url.searchParams.set('ns', emulator.projectId)
    url.searchParams.set('auth', token)
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (response.status === 401 || response.status === 403) throw failure('permission-denied')
      if (!response.ok) throw failure('server-error')
      return await response.json()
    } catch (error) {
      if (error.code?.startsWith('generation-notes/')) throw error
      throw failure('network-error')
    }
  }
  async function active(context) {
    const state = await lifecycle.readLifecycle(context)
    if (state?.generation !== context.generation) throw failure('stale-generation')
    if (state.state !== 'active') throw failure('not-active')
  }
  function display(context, id, raw) {
    if (!raw || raw.deleted === true) return null
    const token = createNoteConcurrencyToken({ context, entryId: id, createdAt: raw.createdAt,
      fields: { title: raw.title, contentHtml: raw.contentHtml, date: raw.date } })
    return Object.freeze({ ...raw, fieldRevisions: Object.freeze({ ...raw.fieldRevisions }), id, contentHtml: sanitizeNoteHtml(raw.contentHtml), token })
  }
  async function getNote(input, id) {
    const context = capture(input), path = bookNotesPath(context, validateRtdbPathSegment(id))
    await active(context)
    const raw = await readServer(context, path)
    await active(context)
    return display(context, id, raw)
  }
  async function getNotes(input) {
    const context = capture(input)
    await active(context)
    const raw = await readServer(context, bookNotesPath(context)) || {}
    await active(context)
    return Object.freeze(Object.entries(raw).map(([id, value]) => display(context, id, value)).filter(Boolean).sort(compareBookNotes))
  }

  // Reconstruct at the public boundary: frozen envelopes are not credentials.
  function validateOperation(input) {
    // All own descriptors are inspected before reading any property.
    const descriptors = Object.getOwnPropertyDescriptors(input || {})
    if (Object.getPrototypeOf(input || {}) !== Object.prototype || Reflect.ownKeys(descriptors).some(key =>
      typeof key !== 'string' || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw new TypeError('Invalid operation.')
    const value = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]))
    const base = { context: value.context, entryId: value.entryId }
    let rebuilt
    switch (value.type) {
      case 'note.create':
        if (value.expected !== null) throw new TypeError('Unexpected creation precondition.')
        rebuilt = createNoteCreateOperation({ ...base, payload: value.payload }); break
      case 'note.patch': rebuilt = createNotePatchOperation({ ...base, payload: value.payload, expected: value.expected }); break
      case 'note.save': rebuilt = createNoteSaveOperation({ ...base, payload: value.payload, expected: value.expected }); break
      case 'note.pin': {
        const pin = contractRecord(value.payload, ['isPinned'])
        rebuilt = createNotePinOperation({ ...base, isPinned: pin.isPinned, expected: value.expected }); break
      }
      case 'note.delete': {
        const payload = contractRecord(value.payload, ['deleted'])
        if (payload.deleted !== true) throw new TypeError('Invalid terminal intention.')
        rebuilt = createNoteDeleteOperation({ ...base, expected: value.expected }); break
      }
      default: throw new TypeError('Unsupported note operation.')
    }
    if (Object.hasOwn(value, 'comparisonFields') && contractArray(value.comparisonFields).some(field => typeof field !== 'string')) throw new TypeError('Invalid comparison fields.')
    if (!same(Object.keys(value).sort(), Object.keys(rebuilt).sort()) || !same(value, rebuilt)) throw new TypeError('Non-canonical operation.')
    return rebuilt
  }
  async function execute(input) {
    const operation = validateOperation(input), context = capture(operation.context)
    const path = bookNotesPath(context, operation.entryId), expected = operation.expected
    await active(context)
    const creation = operation.type === 'note.create' ? await fingerprint(JSON.stringify(operation.payload)) : null
    const baseline = await readServer(context, path)
    function propose(current) {
      if (operation.type === 'note.create') {
        if (current === null) return { ...operation.payload, creation, fieldRevisions: initialFieldRevisions(), isPinned: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        if (!current.deleted && current.creation === creation) return current
        throw failure('creation-conflict')
      }
      if (!current) throw failure('not-found')
      if (current.createdAt !== expected.createdAt) throw failure('identity-conflict')
      if (current.deleted) {
        if (operation.type === 'note.delete') return current
        throw failure('deleted')
      }
      if (operation.comparisonFields.some(field => current[field] !== expected.fields[field])) throw failure('field-conflict')
      if (operation.type === 'note.delete') return { deleted: true, createdAt: current.createdAt }
      const fieldRevisions = { ...current.fieldRevisions }
      for (const field of ['title', 'contentHtml', 'date']) {
        if (Object.hasOwn(operation.payload, field) && operation.payload[field] !== current[field]) fieldRevisions[field] = nextCounter(fieldRevisions[field])
      }
      return { ...current, ...operation.payload, fieldRevisions,
        updatedAt: operation.type === 'note.pin' ? current.updatedAt : serverTimestamp() }
    }
    propose(baseline) // Fail promptly; the transaction repeats every comparison.
    let writeError, callbackError
    try {
      owner(context)
      await runTransaction(ref(database, path), current => {
        callbackError = undefined
        // SDK retry callbacks must abort rather than throw into its event loop.
        try { return propose(current ?? baseline) } catch (error) { callbackError = error; return undefined }
      }, { applyLocally: false })
    } catch (error) { writeError = error }
    // Reconcile only with server evidence in the captured context. Offline or
    // unavailable evidence remains uncertain, never allocates a replacement ID.
    await active(context)
    const observed = await readServer(context, path)
    const confirmed = operation.type === 'note.create' ? observed && !observed.deleted && observed.creation === creation
      : operation.type === 'note.delete' ? observed?.deleted === true && observed.createdAt === expected.createdAt
        : observed && !observed.deleted && observed.createdAt === expected.createdAt &&
          Object.entries(operation.payload).every(([key, value]) => observed[key] === value)
    if (!confirmed) throw callbackError || writeError || failure('conflict')
    return Object.freeze({ context, note: display(context, operation.entryId, observed), deleted: observed.deleted === true })
  }

  async function getLegacySource(input, kind) {
    const context = capture(input)
    if (!['note', 'review'].includes(kind)) throw new TypeError('Invalid historical kind.')
    await active(context)
    const book = await readServer(context, bookLibraryPath(context))
    const source = book?.[kind] ?? ''
    const marker = await readServer(context, kind === 'note' ? bookNotesLegacyPath(context) : bookReviewsLegacyPath(context))
    await active(context)
    return Object.freeze({ status: marker ? 'processed' : 'unprocessed', contentHtml: marker ? '' : sanitizeNoteHtml(source),
      token: createNoteSourceToken({ context, kind, sourceVersion: await fingerprint(source) }) })
  }
  async function convertLegacy(input) {
    // Rebuild using exact DTO shape without invoking accessors.
    const value = contractRecord(input, ['context', 'type', 'entryId', 'payload', 'expected'])
    const payload = contractRecord(value.payload, ['kind', 'title', 'date'])
    const operation = createNoteConversionOperation({ context: value.context, expected: value.expected, title: payload.title, date: payload.date })
    if (value.type !== 'note.convert' || value.entryId !== operation.entryId || payload.kind !== operation.payload.kind || !same(value, operation)) throw new TypeError('Non-canonical conversion.')
    const context = capture(operation.context), kind = payload.kind
    const markerPath = kind === 'note' ? bookNotesLegacyPath(context) : bookReviewsLegacyPath(context)
    const intent = await fingerprint(JSON.stringify([operation.payload, operation.expected.sourceVersion]))
    await active(context)
    const previous = await readServer(context, markerPath)
    if (previous) {
      if (previous.intent !== intent) throw failure('conversion-conflict')
      return Object.freeze({ context, outcome: previous.outcome })
    }
    const book = await readServer(context, bookLibraryPath(context)), source = book?.[kind] ?? ''
    if (await fingerprint(source) !== operation.expected.sourceVersion) throw failure('source-conflict')
    // Reuse note create validation/sanitization without allocating a destination.
    const fields = createNoteCreateOperation({ context, entryId: 'conversion-validation',
      payload: { title: payload.title, contentHtml: source, date: payload.date } }).payload
    const marker = { version: 1, sourceHtml: source, intent, outcome: source === '' ? 'empty' : 'copied', processedAt: serverTimestamp() }
    const writes = { [markerPath]: marker }
    if (source !== '') writes[bookNotesPath(context, operation.entryId)] = { ...fields, creation: intent, fieldRevisions: initialFieldRevisions(),
      isPinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    let writeError
    try { owner(context); await update(ref(database), writes) } catch (error) { writeError = error }
    await active(context)
    const confirmed = await readServer(context, markerPath)
    if (confirmed?.intent !== intent) throw writeError || failure('conversion-conflict')
    return Object.freeze({ context, outcome: confirmed.outcome })
  }
  return Object.freeze({ getNote, getNotes, execute, getLegacySource, convertLegacy,
    createNote: (context, entryId, payload) => execute(createNoteCreateOperation({ context, entryId, payload })),
    patchNote: (context, entryId, payload, expected) => execute(createNotePatchOperation({ context, entryId, payload, expected })),
    saveNote: (context, entryId, payload, expected) => execute(createNoteSaveOperation({ context, entryId, payload, expected })),
    setPinned: (context, entryId, isPinned, expected) => execute(createNotePinOperation({ context, entryId, isPinned, expected })),
    deleteNote: (context, entryId, expected) => execute(createNoteDeleteOperation({ context, entryId, expected })),
  })
}
