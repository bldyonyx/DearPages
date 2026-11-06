import { captureBookContext } from '../utils/generationOperationUtils.js'
import { sameContract } from '../utils/generationContractData.js'
import { createNoteCreateOperation, createNoteSaveOperation, createNotePinOperation, createNoteDeleteOperation } from '../utils/generationNoteContracts.js'
import { createRatingCreateOperation, createRatingUpdateOperation, createRatingDeleteOperation } from '../utils/generationRatingContracts.js'

// Client allocation only: compatible stable IDs, no SDK ref, write or clock.
const alphabet = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
const allocate = () => '-' + [...crypto.getRandomValues(new Uint8Array(19))].map(byte => alphabet[byte & 63]).join('')
export function personalErrorKind(error) {
  const code = String(error?.code || '').toLowerCase()
  if (/conflict/.test(code)) return 'conflict'
  if (/stale|not-active|deleted|not-found|owner-mismatch|permission|account-|protocol-/.test(code)) return 'refused'
  if (error instanceof TypeError || error instanceof RangeError || /invalid/.test(code)) return 'invalid'
  return 'uncertain'
}
/** UI adapter only. All reads/writes use notes/ratings on the guarded facade.
 * No historical reads/conversions. Unknown outcomes keep the original envelope
 * and ID for an EXPLICIT same-intention retry; no timer/effect resends a mutation.
 */
export function createGenerationPersonalBackend(facade, input) {
  const context = captureBookContext(input)
  const pending = new Map()
  async function send(key, build, execute) {
    const prior = pending.get(key)
    const operation = build(prior?.entryId)
    if (prior && !sameContract(prior, operation)) throw Object.assign(new Error('Unresolved intention'), { code: 'personal/uncertain' })
    try {
      const result = await execute(prior || operation)
      pending.delete(key)
      return result
    } catch (error) {
      if (personalErrorKind(error) === 'uncertain') pending.set(key, prior || operation)
      else pending.delete(key)
      throw error
    }
  }
  return Object.freeze({ mode: 'generation', context,
    notes: Object.freeze({
      load: async () => ({ notes: await facade.notes.getNotes(context), legacy: { status: 'empty' }, legacyReview: { status: 'empty' } }),
      create: payload => send('note:new', id => createNoteCreateOperation({ context, entryId: id || allocate(), payload }), op => facade.notes.execute(op)).then(result => result.note),
      save: (entryId, payload, expected) => send(`note:${entryId}`, () => createNoteSaveOperation({ context, entryId, payload, expected }), op => facade.notes.execute(op)).then(result => result.note),
      pin: (entryId, isPinned, expected) => send(`note:${entryId}`, () => createNotePinOperation({ context, entryId, isPinned, expected }), op => facade.notes.execute(op)).then(result => result.note),
      remove: (entryId, expected) => send(`note:${entryId}`, () => createNoteDeleteOperation({ context, entryId, expected }), op => facade.notes.execute(op)),
    }),
    ratings: Object.freeze({
      allocate,
      load: async () => ({ ratings: await facade.ratings.getRatings(context), legacy: { status: 'empty' } }),
      create: (entryId, payload) => send(`rating:${entryId}`, () => createRatingCreateOperation({ context, entryId, payload }), op => facade.ratings.execute(op)).then(result => result.rating),
      save: (entry, payload) => send(`rating:${entry.id}`, () => createRatingUpdateOperation({ context, entryId: entry.id, payload, expected: entry.token }), op => facade.ratings.execute(op)).then(result => result.rating),
      remove: entry => send(`rating:${entry.id}`, () => createRatingDeleteOperation({ context, entryId: entry.id, expected: entry.token }), op => facade.ratings.execute(op)),
    }),
  })
}
