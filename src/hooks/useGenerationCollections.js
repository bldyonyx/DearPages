import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { catalogMetadata } from '../utils/generationCollectionCatalogModel.js'
import { sameContract } from '../utils/generationContractData.js'
import { collectionErrorMessage } from '../integration/generationCollectionsGateway.js'

/** State for the existing list/detail views. No legacy authority or optimistic writes. */
export default function useGenerationCollections(backend, user, collectionId) {
  const { t } = useTranslation()
  const gateway = backend.collectionsGateway
  const scope = useMemo(() => ({ uid: user?.uid, gateway, collectionId }), [user?.uid, gateway, collectionId])
  const control = useRef(null), headerActionsMenuRef = useRef(null)
  const [state, setState] = useState(null)
  const current = state?.scope === scope ? state : { data: null, loading: true, error: '', busy: '' }
  const change = useCallback((c, patch) => {
    if (c.active && c.scope === scope && control.current === c) setState(value => ({ ...(value?.scope === scope ? value : {}), scope, ...patch }))
  }, [scope])
  const reload = useCallback(async (silent = false) => {
    const c = control.current
    if (!c?.active || c.scope !== scope || backend.mode !== 'generation') return
    if (!silent) change(c, { loading: true, error: '' })
    try {
      const data = await gateway.load()
      change(c, { data, loading: false, error: '' })
      c.data = data
      return data
    } catch (error) {
      change(c, { loading: false, error: collectionErrorMessage(error, t, collectionId ? 'collectionPage.loadError' : 'collectionsPage.loadError') })
      throw error
    }
  }, [backend.mode, gateway, change, t, collectionId, scope])
  useEffect(() => {
    const c = { scope, active: true, locked: false, pending: new Map() }
    control.current = c
    if (backend.mode === 'generation') { reload().catch(() => {}) }
    return () => { c.active = false }
  }, [scope, backend.mode, reload])
  useEffect(() => {
    const close = event => { const c = control.current; if (c?.active && !headerActionsMenuRef.current?.contains(event.target)) change(c, { menu: false }) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [change])
  const data = current.data || { collections: [], books: [] }
  const collection = data.collections.find(item => item.id === collectionId) || null
  function patch(value) { const c = control.current; if (c?.active && c.scope === scope && !c.locked && backend.mode === 'generation') change(c, value) }
  async function mutate(kind, task, done = {}) {
    const c = control.current
    if (!c?.active || c.scope !== scope || c.locked || !c.data || backend.mode !== 'generation') return false
    c.locked = true; change(c, { busy: kind, error: '', clearError: '' })
    try {
      await task(c)
      if (!c.active) return false
      const next = await gateway.load()
      if (!c.active) return false
      c.data = next
      c.pending.delete(kind)
      change(c, { data: next, ...done })
      return true
    } catch (error) {
      const message = collectionErrorMessage(error, t, 'collectionsPage.updateError')
      change(c, kind === 'clear' ? { clearError: message } : { error: message })
      return false
    } finally { c.locked = false; change(c, { busy: '' }) }
  }
  function catalog(kind, type, target, payload, done) {
    return mutate(kind, async c => {
      let operation = c.pending.get(kind)
      if (!operation) { operation = gateway.catalogOperation(type, target, payload); c.pending.set(kind, operation) }
      // A different form submission cannot mutate an unresolved intention.
      const normalized = payload && (['catalog.create', 'catalog.patch'].includes(type) ? catalogMetadata(payload, type === 'catalog.create') : payload)
      if (operation.type !== type || (target && !sameContract(operation.context, target.context)) ||
          (payload && !sameContract(operation.payload, normalized))) {
        throw Object.assign(new Error('Unresolved intention'), { code: 'collection-ui/uncertain' })
      }
      await gateway.executeCatalog(operation)
    }, done)
  }
  // Existing forms submit the same metadata schema; builders retain normalization.
  const loading = backend.mode === 'loading' || (backend.mode === 'generation' && current.loading)
  const error = backend.mode === 'blocked' ? t('collectionsPage.loadError') : current.error || ''
  return {
    user, collections: data.collections, libraryBooks: data.books, collection,
    collectionBooks: data.books.filter(book => collection?.books?.[book.id]),
    generationGateway: gateway,
    isLoading: loading, error,
    loadCollections: () => reload().catch(() => {}), loadCollectionPage: () => reload().catch(() => {}),
    isCreateModalOpen: Boolean(current.createOpen), isSubmitting: current.busy === 'create',
    collectionToDelete: current.deleting || null, isDeleting: current.busy === 'delete',
    collectionToEdit: current.editing || null, isSavingEdit: current.busy === 'edit', isSavingCollection: current.busy === 'edit',
    openCreateModal: () => patch({ createOpen: true }), closeCreateModal: () => patch({ createOpen: false }),
    openDeleteModal: target => patch({ deleting: target }), closeDeleteModal: () => patch({ deleting: null }),
    openEditModal: target => patch({ editing: target || collection, menu: false }),
    openEditModalFromMenu: () => patch({ editing: collection, menu: false }),
    closeEditModal: () => patch({ editing: null }),
    handleCreateCollection: payload => catalog('create', 'catalog.create', null, payload, { createOpen: false }),
    handleDeleteCollection: () => catalog('delete', 'catalog.delete', current.deleting, undefined, { deleting: null }),
    handleUpdateCollection: payload => catalog('edit', 'catalog.patch', current.editing, payload, { editing: null }),
    handleEditCollection: payload => catalog('edit', 'catalog.patch', current.editing, payload, { editing: null }),
    handleTogglePinned: target => catalog('pin', 'catalog.pin', target, { pinned: !target.pinned }),
    getCollectionPreviewBooks: target => data.books.filter(book => target.books?.[book.id]).slice(0, 4).map(book => ({ id: book.id, book })),
    isBooksModalOpen: Boolean(current.booksOpen), openBooksModal: () => patch({ booksOpen: true }), closeBooksModal: () => patch({ booksOpen: false }),
    handleBooksSaved: () => reload(true),
    bookToRemove: current.removing || null, removingBookId: current.busy === 'remove' ? current.removing?.id || '' : '',
    openRemoveBookModal: target => patch({ removing: target }), closeRemoveBookModal: () => patch({ removing: null }),
    handleConfirmRemoveBook: () => mutate('remove', async c => {
      let selection = c.pending.get('remove')
      if (!selection) { selection = await gateway.removeSelection(collection, current.removing); c.pending.set('remove', selection) }
      await gateway.saveSelection(selection, [])
    }, { removing: null }),
    isClearModalOpen: Boolean(current.clearOpen), isClearingCollection: current.busy === 'clear', clearCollectionError: current.clearError || '',
    openClearModalFromMenu: () => patch({ clearOpen: true, menu: false, clearError: '' }), closeClearModal: () => patch({ clearOpen: false, clearError: '' }),
    handleClearCollection: () => catalog('clear', 'catalog.clear', collection, undefined, { clearOpen: false }),
    isHeaderActionsMenuOpen: Boolean(current.menu), headerActionsMenuRef,
    toggleHeaderActionsMenu: () => patch({ menu: !current.menu }),
  }
}
