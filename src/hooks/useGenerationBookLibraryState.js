import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** No optimistic route record or mutable Auth lookup is an authority for writes. */
export default function useGenerationBookLibraryState({ backend, userId, bookId, routeKey, book }) {
  const { t } = useTranslation()
  const scope = useMemo(() => ({ userId, bookId, routeKey, gateway: backend.gateway }), [userId, bookId, routeKey, backend.gateway])
  const control = useRef(null)
  const [state, setState] = useState(null)
  const current = state?.scope === scope ? state : { book: null, loading: true, saving: false, loaded: false, error: '', modal: false }
  useEffect(() => {
    const c = { active: true, locked: false, addition: null, status: null, loaded: false }
    control.current = c
    if (backend.mode !== 'generation') return () => { c.active = false }
    const change = patch => { if (c.active) setState(value => ({ ...(value?.scope === scope ? value : {}), scope, ...patch })) }
    change({ book: null, loading: true, saving: false, loaded: false, error: '', modal: false })
    backend.gateway.read(bookId).then(snapshot => {
      if (!c.active) return
      c.loaded = true; c.snapshot = snapshot
      change({ ...snapshot, loading: false, loaded: true })
    }, () => change({ loading: false, error: t('bookPage.library.loadError') }))
    return () => { c.active = false }
  }, [backend.mode, backend.gateway, scope, bookId, t])
  function change(c, patch) {
    if (c.active && control.current === c) setState(value => ({ ...value, scope, ...patch }))
  }
  async function operate(kind, action) {
    const c = control.current
    if (backend.mode !== 'generation' || !c?.active || !c.loaded || c.locked) return
    c.locked = true; change(c, { saving: true, error: '' })
    try {
      const snapshot = await action(c)
      if (!c.active) return
      c.snapshot = snapshot
      change(c, { ...snapshot, modal: false })
    } catch {
      change(c, { error: t(`bookPage.library.${kind}Error`) })
    } finally { c.locked = false; change(c, { saving: false }) }
  }
  function add(status) {
    return operate('add', async c => {
      if (c.snapshot.book || c.status || c.deleting) throw new Error('pending-operation')
      c.addition ??= backend.gateway.captureAddition(book, status, c.snapshot.lifecycle)
      if (c.addition.record.status !== status) throw new Error('different-retry')
      const snapshot = await backend.gateway.add(c.addition)
      c.addition = null
      return snapshot
    })
  }
  const blocked = backend.mode === 'blocked'
  return {
    libraryBook: current.book, setLibraryBook: () => {},
    isLibraryLoading: backend.mode === 'loading' || (backend.mode === 'generation' && current.loading),
    isSaving: Boolean(current.saving) || blocked || (backend.mode === 'generation' && !current.loaded),
    isReadingDateSaving: false, readingDateMessage: '', handleReadingDateChange: undefined,
    libraryError: blocked ? t('bookPage.library.loadError') : current.error || '',
    isRemoveModalOpen: Boolean(current.modal),
    handleAddToLibrary: () => add('to-read'),
    handleStatusChange: status => {
      if (!current.book) return add(status)
      return operate('status', async c => {
        if (c.deleting || c.addition) throw new Error('pending-operation')
        c.status ??= { context: c.snapshot.book.generationContext, previous: c.snapshot.book.status, desired: status }
        if (c.status.desired !== status) throw new Error('different-retry')
        const nextBook = await backend.gateway.status(c.status.context, c.status.previous, c.status.desired)
        c.status = null
        return { ...c.snapshot, book: nextBook }
      })
    },
    handleOpenRemoveModal: () => { const c = control.current; if (c?.active && c.loaded && !c.locked && !c.status && !c.addition) change(c, { modal: true }) },
    handleCloseRemoveModal: () => { const c = control.current; if (c?.active && !c.locked) change(c, { modal: false }) },
    handleConfirmRemove: () => operate('remove', async c => {
      if (!c.snapshot.book || c.status || c.addition) throw new Error('pending-operation')
      c.deleting = true
      const snapshot = await backend.gateway.remove(c.snapshot.book.generationContext)
      c.deleting = false
      return snapshot
    }),
  }
}
