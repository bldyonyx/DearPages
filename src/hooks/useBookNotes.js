import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  compareBookNotes, createBookNote, deleteBookNote, getBookNotesForDisplay,
  isBookNotesUiEnabled, updateBookNote,
  getBookNote, migrateLegacyBookNote, migrateLegacyBookReview,
} from '../services/bookNotesService.js'

function initial(scope) {
  return { scope, notes: [], legacy: null, legacyReview: null, conversionStatus: '', loading: isBookNotesUiEnabled, loaded: false, loadError: false, pending: {}, errors: {} }
}

export default function useBookNotes(userId, bookId) {
  const scope = useMemo(() => ({ userId, bookId }), [userId, bookId])
  const controlRef = useRef(null)
  const [state, setState] = useState(() => initial(scope))
  const change = useCallback((update) => {
    if (controlRef.current?.scope === scope && controlRef.current.active) {
      setState((current) => update(current.scope === scope ? current : initial(scope)))
    }
  }, [scope])

  const reload = useCallback(async () => {
    const control = controlRef.current
    if (!isBookNotesUiEnabled || !userId || !bookId || !control?.active || control.scope !== scope || control.locks.size) return
    const sequence = ++control.sequence
    control.loading = true
    change((current) => ({ ...current, loading: true, loadError: false }))
    try {
      const result = await getBookNotesForDisplay(userId, bookId)
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
  }, [bookId, userId, scope, change])

  useEffect(() => {
    const control = { scope, active: true, sequence: 0, locks: new Set(), processed: false, processedReview: false, loading: false }
    controlRef.current = control
    // Defer the initial request so StrictMode's discarded effect does not fetch.
    queueMicrotask(() => { if (control.active) reload() })
    return () => { control.active = false; control.sequence++ }
  }, [scope, reload])

  async function operate(key, action, apply, errorKey) {
    const control = controlRef.current
    if (!isBookNotesUiEnabled || !control?.active || control.scope !== scope || control.loading || control.locks.has(key) || state.loadError || !state.loaded) return false
    control.locks.add(key)
    change((current) => ({ ...current, pending: { ...current.pending, [key]: true }, errors: { ...current.errors, [key]: '' } }))
    try {
      const result = await action()
      if (!control.active) return false
      change((current) => ({ ...current, notes: apply(current.notes, result).sort(compareBookNotes) }))
      return true
    } catch (error) {
      const message = error.code === 'book-notes/invalid-argument' ? 'invalidInput' : error.code === 'book-notes/note-not-found' ? 'missingNote' : errorKey
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
    if (!['note', 'review'].includes(kind) || !options?.expectedVersion || !isBookNotesUiEnabled || !control?.active || control.scope !== scope || control.loading || control.locks.has(key) || state.loadError || !state.loaded) return false
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

  const current = state.scope === scope ? state : initial(scope)
  return {
    ...current, enabled: isBookNotesUiEnabled, reload, convert,
    create: (input) => operate('new', () => createBookNote(userId, bookId, input),
      (notes, id) => [...notes, { ...input, id, createdAt: Date.now() }], 'saveError'),
    save: (id, input) => operate(id, () => updateBookNote(userId, bookId, id, input),
      (notes) => notes.map((note) => note.id === id ? { ...note, ...input } : note), 'saveError'),
    remove: (id) => operate(id, () => deleteBookNote(userId, bookId, id),
      (notes) => notes.filter((note) => note.id !== id), 'deleteError'),
  }
}
