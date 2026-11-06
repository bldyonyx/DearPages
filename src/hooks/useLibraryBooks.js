import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUserLibrary } from '../services/libraryService.js'
import useLibraryBackend from './useLibraryBackend.js'

export default function useLibraryBooks(userId) {
  const { t } = useTranslation()
  const backend = useLibraryBackend(userId)
  const scope = useMemo(() => ({ userId, mode: backend.mode, gateway: backend.gateway }), [userId, backend.mode, backend.gateway])
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!userId || backend.mode === 'loading') return
    let active = true
    async function load() {
      try {
        if (backend.mode === 'blocked') throw new Error('generation-disabled')
        const books = backend.mode === 'generation' ? await backend.gateway.list() : await getUserLibrary(userId)
        if (active) setState({ scope, books, error: '' })
      } catch {
        if (active) setState({ scope, books: [], error: t('libraryPage.loadError') })
      }
    }
    load()
    return () => { active = false }
  }, [userId, scope, t, backend.mode, backend.gateway])
  const current = state?.scope === scope ? state : null
  return { books: current?.books ?? [], isLoading: Boolean(userId) && !current, error: current?.error ?? '', libraryMode: backend.mode }
}
