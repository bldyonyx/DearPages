import CollectionCard from '../components/collections/cards/CollectionCard.jsx'
import CollectionCreateModal from '../components/collections/modals/CollectionCreateModal.jsx'
import CollectionDeleteModal from '../components/collections/modals/CollectionDeleteModal.jsx'
import CollectionEditModal from '../components/collections/modals/CollectionEditModal.jsx'
import HeaderActions from '../components/layout/HeaderActions.jsx'
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
    <div className="p-6">
      <header className="py-4">
        <div
          className="
            flex flex-col gap-4
            lg:flex-row lg:items-center lg:justify-between
          "
        >
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
              Mes collections
            </h1>

            <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
              Des piles de livres rangées à ta façon.
            </p>
          </div>

          <div
            className="
              flex min-w-0 flex-wrap
              items-center gap-3
              lg:flex-1
              lg:flex-nowrap
              lg:justify-end
            "
          >
            <HeaderActions
              user={user}
              className="order-1 md:flex-none lg:order-2"
            />

            <div className="order-2 basis-full lg:order-1 lg:basis-auto">
              <button
                type="button"
                onClick={openCreateModal}
                className="
                  inline-flex h-10
                  cursor-pointer
                  shrink-0 items-center
                  justify-center
                  rounded-full border
                  border-lime/70
                  bg-lime/70 px-4
                  font-bold text-darkwood
                  shadow-sm
                  hover:bg-lime
                  md:h-11 md:px-5
                "
              >
                + Nouvelle collection
              </button>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <section
          className="
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/65 p-5
            shadow-sm
            sm:p-7
          "
        >
          <LoadingState message="Chargement de tes collections..." />
        </section>
      ) : error ? (
        <section
          className="
            mt-8 rounded-[28px]
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
          "
        >
          <ErrorState
            message={error}
            onRetry={loadCollections}
          />
        </section>
      ) : collections.length === 0 ? (
        <section
          className="
            mt-8 max-w-2xl rounded-3xl
            border border-walnut/10
            bg-cream/75
            px-6 py-10
            shadow-sm
          "
        >
          <p
            className="
              font-heading text-2xl
              font-bold text-darkwood
            "
          >
            Aucune collection pour le moment
          </p>

          <p
            className="
              mt-2 max-w-md
              font-ui text-sm
              leading-6 text-walnut/70
            "
          >
            Crée une première collection pour regrouper tes
            envies, tes coups de coeur ou tes lectures à venir.
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="
              mt-6 cursor-pointer
              font-ui text-sm
              font-bold text-darkwood
              underline decoration-walnut/30
              underline-offset-4
              transition-opacity
              hover:opacity-70
            "
          >
            Créer ma première collection →
          </button>
        </section>
      ) : (
        <section className="mt-8">
          <div
            className="
              grid gap-5
              sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]
              xl:grid-cols-3
            "
          >
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                previewBooks={getCollectionPreviewBooks(
                  collection,
                )}
                onDeleteRequest={openDeleteModal}
                onEditRequest={openEditModal}
                onPinRequest={handleTogglePinned}
              />
            ))}
          </div>
        </section>
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