import CollectionCreateModal from '../components/collections/modals/CollectionCreateModal.jsx'
import CollectionDeleteModal from '../components/collections/modals/CollectionDeleteModal.jsx'
import CollectionEditModal from '../components/collections/modals/CollectionEditModal.jsx'
import CollectionsEmptyState from '../components/collections/CollectionsEmptyState.jsx'
import CollectionsGrid from '../components/collections/CollectionsGrid.jsx'
import CollectionsHeader from '../components/collections/CollectionsHeader.jsx'
import { collectionsLarge } from '../components/collections/collectionsResponsive.js'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import useCollections from '../hooks/useCollections.js'

function Collections() {
  const {
    user,
    collections,
    isLoading,
    error,

    isCreateModalOpen,
    isSubmitting,

    collectionToDelete,
    isDeleting,

    collectionToEdit,
    isSavingEdit,

    loadCollections,
    handleCreateCollection,
    handleDeleteCollection,
    handleUpdateCollection,
    handleTogglePinned,
    getCollectionPreviewBooks,

    openCreateModal,
    closeCreateModal,
    openDeleteModal,
    closeDeleteModal,
    openEditModal,
    closeEditModal,
  } = useCollections()

  return (
    <div className={`p-6 ${collectionsLarge.shell}`}>
      <CollectionsHeader
        user={user}
        onCreateCollection={openCreateModal}
      />

      {isLoading ? (
        <section
          className={`
            mt-8 rounded-3xl
            border border-darkwood/10
            bg-cream/80 p-5
            shadow-sm
            sm:p-7
            ${collectionsLarge.sectionGap}
          `}
        >
          <LoadingState message="Chargement de tes collections..." />
        </section>
      ) : error ? (
        <section
          className={`
            mt-8 rounded-[28px]
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
            ${collectionsLarge.sectionGap}
          `}
        >
          <ErrorState
            message={error}
            onRetry={loadCollections}
          />
        </section>
      ) : collections.length === 0 ? (
        <CollectionsEmptyState
          onCreateCollection={openCreateModal}
        />
      ) : (
        <CollectionsGrid
          collections={collections}
          getPreviewBooks={getCollectionPreviewBooks}
          onDeleteCollection={openDeleteModal}
          onEditCollection={openEditModal}
          onPinCollection={handleTogglePinned}
        />
      )}

      <CollectionCreateModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onCreate={handleCreateCollection}
        isSubmitting={isSubmitting}
      />

      <CollectionDeleteModal
        collection={collectionToDelete}
        isDeleting={isDeleting}
        onClose={closeDeleteModal}
        onDelete={handleDeleteCollection}
      />

      <CollectionEditModal
        collection={collectionToEdit}
        isSaving={isSavingEdit}
        onClose={closeEditModal}
        onSave={handleUpdateCollection}
      />
    </div>
  )
}

export default Collections
