import { useState } from 'react'
import { compareBookRatings } from '../utils/bookRatingsOrder.js'

const examples = [
  { id: 'rating-a', impression: 'Une lecture qui reste longtemps en tête.', value: 4, date: '2026-10-24', createdAt: 3, revision: 1 },
  { id: 'rating-b', value: 3, date: '2024-06-01', createdAt: 2, revision: 1 },
  { id: 'rating-c', value: 5, date: '', createdAt: 1, revision: 1 },
]
function withInput(rating, input) {
  const next = { ...rating, ...input }
  if (typeof next.impression === 'string' && !next.impression.trim()) delete next.impression
  return next
}
export default function usePreviewRatings(fail) {
  const [ratings, setRatings] = useState(examples)
  const [error, setError] = useState('')
  const [historical, setHistorical] = useState(false)
  const [processed, setProcessed] = useState(false)
  const [notice, setNotice] = useState('')
  function perform(make) {
    if (fail) { setError('saveError'); return false }
    setError(''); setRatings(current => make(current).sort(compareBookRatings)); return true
  }
  return {
    enabled: true, loaded: true, loading: false, loadError: false, busy: false, error, notice, ratings,
    historical, setHistorical,
    legacy: { status: processed ? 'processed' : historical ? 'unprocessed' : 'empty', value: 4 },
    allocate: () => crypto.randomUUID(), reload: async () => { setError('') },
    create: async (id, input) => perform(current => [...current, withInput({ id, revision: 1, createdAt: Date.now() }, input)]),
    save: async (expected, input) => perform(current => current.map(r => r.id === expected.id ? withInput({ ...r, revision: r.revision + 1 }, input) : r)),
    remove: async expected => perform(current => current.filter(r => r.id !== expected.id)),
    convert: async value => {
      if (processed) return true
      if (!perform(current => [...current, { id: 'legacy-rating-v1', value, date: '', revision: 1, createdAt: Date.now() }])) return false
      setProcessed(true); setNotice('converted'); return true
    },
  }
}
