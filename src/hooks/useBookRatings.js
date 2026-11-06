import { personalErrorKind } from '../integration/generationPersonalBackend.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isBookRatingsUiEnabled, getBookRatingsForDisplay, newBookRatingId, createBookRating,
  updateBookRatingEntry, deleteBookRatingEntry, migrateLegacyBookRating, compareBookRatings,
} from '../services/bookRatingsService.js'

const initial = (scope, enabled) => ({ scope, ratings: [], legacy: null, loaded: false, loading: enabled, busy: false, loadError: false, error: '', notice: '' })
export default function useBookRatings(userId, bookId, personalBackend) {
  const generation = personalBackend?.mode === 'generation'
  const enabled = personalBackend ? generation && personalBackend.context.uid === userId && personalBackend.context.bookId === bookId : isBookRatingsUiEnabled
  const scope = useMemo(() => ({ userId, bookId, personalBackend }), [userId, bookId, personalBackend])
  const control = useRef(null)
  const [state, setState] = useState(() => initial(scope, enabled))
  const change = useCallback(update => {
    if (control.current?.scope === scope && control.current.active) setState(current => update(current.scope === scope ? current : initial(scope, enabled)))
  }, [scope, enabled])
  const reload = useCallback(async () => {
    const c = control.current
    if (!enabled || !userId || !bookId || !c?.active || c.scope !== scope || c.lock) return
    c.lock = true
    change(s => ({ ...s, loading: true, loadError: false, error: '' }))
    try {
      const result = await (generation ? personalBackend.ratings.load() : getBookRatingsForDisplay(userId, bookId))
      c.processed ||= result.legacy.status === 'processed'
      if (c.active) change(s => ({ ...s, ...result, legacy: c.processed ? { status: 'processed' } : result.legacy, loaded: true, loading: false }))
    } catch {
      if (c.active) change(s => ({ ...s, loading: false, loadError: true }))
    } finally { c.lock = false }
  }, [scope, userId, bookId, change, enabled, generation, personalBackend])
  useEffect(() => {
    const c = { scope, active: true, lock: false, processed: false }
    control.current = c
    queueMicrotask(() => { if (c.active) reload() })
    return () => { c.active = false }
  }, [scope, reload])
  async function operate(action, apply) {
    const c = control.current
    if (!enabled || !c?.active || c.scope !== scope || c.lock || !state.loaded || state.loadError) return false
    c.lock = true
    change(s => ({ ...s, busy: true, error: '', notice: '' }))
    try {
      const result = await action()
      if (!c.active) return false
      change(s => ({ ...s, ratings: apply(s.ratings, result).sort(compareBookRatings) }))
      return true
    } catch (cause) {
      const code = cause.code?.replace('book-ratings/', '')
      change(s => ({ ...s, error: generation ? (personalErrorKind(cause) === 'invalid' ? 'invalid' : personalErrorKind(cause)) : ['conflict', 'source-changed', 'not-found', 'status-conflict'].includes(code) ? 'conflict' : code === 'invalid-argument' ? 'invalid' : 'saveError' }))
      return false
    } finally {
      c.lock = false
      if (c.active) change(s => ({ ...s, busy: false }))
    }
  }
  const current = state.scope === scope ? state : initial(scope, enabled)
  return {
    ...current, enabled, reload,
    allocate: () => generation ? personalBackend.ratings.allocate() : newBookRatingId(userId, bookId),
    create: (id, input) => operate(() => generation ? personalBackend.ratings.create(id, input) : createBookRating(userId, bookId, id, input), (ratings, result) => [...ratings.filter(r => r.id !== result.id), result]),
    save: (expected, input) => operate(() => generation ? personalBackend.ratings.save(expected, input) : updateBookRatingEntry(userId, bookId, expected, input), (ratings, result) => ratings.map(r => r.id === result.id ? result : r)),
    remove: expected => operate(() => generation ? personalBackend.ratings.remove(expected) : deleteBookRatingEntry(userId, bookId, expected), ratings => ratings.filter(r => r.id !== expected.id)),
    convert: value => generation ? Promise.resolve(false) : operate(async () => {
      await migrateLegacyBookRating(userId, bookId, value)
      const c = control.current
      if (!c?.active || c.scope !== scope) return null
      c.processed = true
      change(s => ({ ...s, legacy: { status: 'processed' }, notice: 'converted' }))
      try { return await (generation ? personalBackend.ratings.load() : getBookRatingsForDisplay(userId, bookId)) }
      catch { change(s => ({ ...s, notice: 'convertedRefresh' })); return null }
    }, (ratings, result) => result ? result.ratings : ratings),
  }
}
