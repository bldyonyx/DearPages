import { personalErrorKind } from '../integration/generationPersonalBackend.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  compareBookNotes, createBookNote, deleteBookNote, getBookNotesForDisplay,
  isBookNotesUiEnabled, updateBookNote, updateBookNotePinned,
  getBookNote, migrateLegacyBookNote, migrateLegacyBookReview,
} from '../services/bookNotesService.js'

function initial(scope, enabled) {
  return { scope, notes: [], legacy: null, legacyReview: null, conversionStatus: '', loading: enabled, loaded: false, loadError: false, pending: {}, errors: {} }
}

export default function useBookNotes(userId, bookId, personalBackend) {
  const generation = personalBackend?.mode === 'generation'
  const enabled = personalBackend ? generation && personalBackend.context.uid === userId && personalBackend.context.bookId === bookId : isBookNotesUiEnabled
  const scope = useMemo(() => ({ userId, bookId, personalBackend }), [userId, bookId, personalBackend])
  const controlRef = useRef(null)
  const [state, setState] = useState(() => initial(scope, enabled))
  const change = useCallback((update) => {
    if (controlRef.current?.scope === scope && controlRef.current.active) {
      setState((current) => update(current.scope === scope ? current : initial(scope, enabled)))
    }
  }, [scope, enabled])

  const reload = useCallback(async () => {
    const control = controlRef.current
    if (!enabled || !userId || !bookId || !control?.active || control.scope !== scope || control.locks.size) return
    const sequence = ++control.sequence
    control.loading = true
    change((current) => ({ ...current, loading: true, loadError: false }))
    try {
      const result = await (generation ? personalBackend.notes.load() : getBookNotesForDisplay(userId, bookId))
      if (!control.active || sequence !== control.sequence) return
      control.processed ||= result.legacy.status === 'processed'
      control.processedReview ||= result.legacyReview?.status === 'processed'
      change((current) => ({ ...current, ...result, legacy: control.processed ? { status: 'processed' } : result.legacy,
        legacyReview: control.processedReview ? { status: 'processed' } : result.legacyReview, loading: false, loaded: true }))
    } catch {
      if (control.active && sequence === control.sequence) change((current) => ({ ...current, loading: false, loadError: true }))
    } finally {
      if (sequence === control.sequence) control.loading = false
    }
  }, [bookId, userId, scope, change, enabled, generation, personalBackend])

  useEffect(() => {
    const control = { scope, active: true, sequence: 0, locks: new Set(), processed: false, processedReview: false, loading: false }
    controlRef.current = control
    // Defer the initial request so StrictMode's discarded effect does not fetch.
    queueMicrotask(() => { if (control.active) reload() })
    return () => { control.active = false; control.sequence++ }
  }, [scope, reload])

  async function operate(key, action, apply, errorKey) {
    const control = controlRef.current
    if (!enabled || !control?.active || control.scope !== scope || control.loading || control.locks.has(key) || state.loadError || !state.loaded) return false
    control.locks.add(key)
    change((current) => ({ ...current, pending: { ...current.pending, [key]: true }, errors: { ...current.errors, [key]: '' } }))
    try {
      const result = await action()
      if (!control.active) return false
      change((current) => ({ ...current, notes: apply(current.notes, result).sort(compareBookNotes) }))
      return true
    } catch (error) {
      const kind = generation ? personalErrorKind(error) : null
      const message = generation ? (kind === 'invalid' ? 'invalidInput' : kind) : error.code === 'book-notes/invalid-argument' ? 'invalidInput' : error.code === 'book-notes/note-not-found' ? 'missingNote' : errorKey
      change((current) => ({ ...current, errors: { ...current.errors, [key]: message } }))
      return false
    } finally {
      control.locks.delete(key)
      change((current) => ({ ...current, pending: { ...current.pending, [key]: false } }))
    }
  }

  async function convert(kind, options) {
    const control = controlRef.current
    const key = `convert:${kind}`
    if (generation || !['note', 'review'].includes(kind) || !options?.expectedVersion || !enabled || !control?.active || control.scope !== scope || control.loading || control.locks.has(key) || state.loadError || !state.loaded) return false
    control.locks.add(key)
    change((current) => ({ ...current, conversionStatus: '', pending: { ...current.pending, [key]: true }, errors: { ...current.errors, [key]: '' } }))
    try {
      await (kind === 'note' ? migrateLegacyBookNote : migrateLegacyBookReview)(userId, bookId, options)
      if (!control.active) return false
      // Mark completion immediately after acknowledgement. A subsequent read
      // failure must never offer a historical fallback or report a failed write.
      if (kind === 'note') control.processed = true
      else control.processedReview = true
      const field = kind === 'note' ? 'legacy' : 'legacyReview'
      change((current) => ({ ...current, [field]: { status: 'processed' }, conversionStatus: 'converted' }))
      try {
        const id = kind === 'note' ? 'legacy-note-v1' : 'legacy-review-v1'
        const converted = await getBookNote(userId, bookId, id)
        if (!control.active) return false
        // Merge this destination only: do not replace independent in-flight edits.
        change((current) => ({ ...current, notes: [...current.notes.filter((note) => note.id !== id), ...(converted ? [converted] : [])].sort(compareBookNotes), conversionStatus: converted ? 'converted' : 'convertedAbsent' }))
      } catch {
        change((current) => ({ ...current, conversionStatus: 'convertedRefresh' }))
      }
      return true
    } catch (error) {
      const message = ['book-notes/legacy-conflict', 'book-notes/legacy-source-changed'].includes(error.code) ? 'conversionConflict'
        : error.code === 'book-notes/invalid-argument' ? 'conversionInvalid' : 'conversionError'
      change((current) => ({ ...current, errors: { ...current.errors, [key]: message } }))
      return false
    } finally {
      control.locks.delete(key)
      change((current) => ({ ...current, pending: { ...current.pending, [key]: false } }))
    }
  }

  const current = state.scope === scope ? state : initial(scope, enabled)
  return {
    ...current, enabled, reload, convert,
    create: (input) => operate('new', () => generation ? personalBackend.notes.create(input) : createBookNote(userId, bookId, input),
      (notes, result) => generation ? [...notes, result] : [...notes, { ...input, id: result, createdAt: Date.now() }], 'saveError'),
    save: (id, input, expected) => operate(id, () => generation ? personalBackend.notes.save(id, input, expected) : updateBookNote(userId, bookId, id, input),
      (notes, result) => notes.map(note => note.id === id ? (generation ? result : { ...note, ...input }) : note), 'saveError'),
    pin: (id, isPinned, expected) => operate(id, () => generation ? personalBackend.notes.pin(id, isPinned, expected) : updateBookNotePinned(userId, bookId, id, isPinned),
      (notes, result) => notes.map(note => note.id === id ? (generation ? result : { ...note, isPinned }) : note), 'pinError'),
    remove: (id, expected) => operate(id, () => generation ? personalBackend.notes.remove(id, expected) : deleteBookNote(userId, bookId, id),
      notes => notes.filter(note => note.id !== id), 'deleteError'),
  }
}
