import { useEffect, useState } from 'react'
import { generationLibraryRequested, resolveCurrentLibraryBackend } from '../integration/libraryBackend.js'

export default function useLibraryBackend(userId) {
  const requested = generationLibraryRequested()
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!requested || !userId) return
    let active = true
    resolveCurrentLibraryBackend(userId).then(backend => {
      if (active) setState({ userId, backend })
    }, () => { if (active) setState({ userId, backend: { mode: 'blocked' } }) })
    return () => { active = false }
  }, [requested, userId])
  if (!requested) return { mode: 'legacy' }
  return state?.userId === userId ? state.backend : { mode: 'loading' }
}
