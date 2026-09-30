import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import CollectionBooksGrid from '../components/collections/CollectionBooksGrid.jsx'
import CollectionPageEmptyState from '../components/collections/CollectionPageEmptyState.jsx'
import CollectionPageHeader from '../components/collections/CollectionPageHeader.jsx'
import { collectionPageLarge } from '../components/collections/collectionPageResponsive.js'
import CollectionBookRemoveModal from '../components/collections/modals/CollectionBookRemoveModal.jsx'
import CollectionBooksModal from '../components/collections/modals/CollectionBooksModal.jsx'
import CollectionClearModal from '../components/collections/modals/CollectionClearModal.jsx'
import CollectionEditModal from '../components/collections/modals/CollectionEditModal.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import useCollectionPage from '../hooks/useCollectionPage.js'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function CollectionPage() {
  const {
    user,

    collection,
    libraryBooks,
    collectionBooks,

    isLoading,
    error,

    isBooksModalOpen,

    collectionToEdit,
    isSavingCollection,

    bookToRemove,
    removingBookId,

    isClearModalOpen,
    isClearingCollection,
    clearCollectionError,

    isHeaderActionsMenuOpen,
    headerActionsMenuRef,

    loadCollectionPage,

    openBooksModal,
    closeBooksModal,
    handleBooksSaved,

    openEditCollectionModal,
    closeEditCollectionModal,
    handleUpdateCollection,

    openRemoveBookModal,
    closeRemoveBookModal,
    handleConfirmRemoveBook,

    openClearModalFromMenu,
    closeClearModal,
    handleClearCollection,

    toggleHeaderActionsMenu,
  } = useCollectionPage()

  if (isLoading) {
    return (
      <div className={`p-6 ${collectionPageLarge.shell}`}>
        <section
          className={`
            mt-8 rounded-[28px]
            border border-walnut/10
            bg-cream/65 p-5
            shadow-sm
            sm:p-7
            ${collectionPageLarge.sectionGap}
            ${collectionPageLarge.panel}
          `}
        >
          <LoadingState message="Chargement de la collection..." />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 ${collectionPageLarge.shell}`}>
        <section
          className={`
            mt-8 rounded-[28px]
            border border-dustyrose/30
            bg-dustyrose/20
            px-5 py-4
            ${collectionPageLarge.sectionGap}
          `}
        >
          <ErrorState
            message={error}
            onRetry={loadCollectionPage}
          />
        </section>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className={`p-6 ${collectionPageLarge.shell}`}>
        <section
          className={`
            mx-auto mt-8 max-w-2xl
            rounded-[28px]
            border border-walnut/10
            bg-cream/60
            px-6 py-14
            text-center
            shadow-sm
            ${collectionPageLarge.sectionGap}
            ${collectionPageLarge.emptyPanel}
          `}
        >
          <p
            className={`
              font-heading text-2xl font-bold text-darkwood
              ${collectionPageLarge.emptyTitle}
            `}
          >
            Collection introuvable
          </p>

          <p
            className={`
              mx-auto mt-2 max-w-md
              font-ui text-sm leading-6
              text-walnut/70
              ${collectionPageLarge.text}
            `}
          >
            Elle a peut-être été supprimée ou déplacée.
          </p>

          <Link
            to="/collections"
            className="
              mt-6 inline-flex
              items-center gap-2
              rounded-full bg-lime/70
              px-4 py-2
              font-ui text-sm
              font-bold text-darkwood
              transition-colors
              hover:bg-lime
            "
          >
            <ArrowLeft
              className="h-4 w-4"
              strokeWidth={1.8}
              aria-hidden="true"
            />

            Retour aux collections
          </Link>
        </section>
      </div>
    )
  }

  const bookToRemoveId = bookToRemove
    ? getBookId(bookToRemove)
    : ''

  return (
    <div className={`p-6 ${collectionPageLarge.shell}`}>
      <CollectionPageHeader
        collection={collection}
        bookCount={collectionBooks.length}
        isActionsMenuOpen={isHeaderActionsMenuOpen}
        actionsMenuRef={headerActionsMenuRef}
        onToggleActionsMenu={toggleHeaderActionsMenu}
        onAddBooks={openBooksModal}
        onEditCollection={openEditCollectionModal}
        onClearCollection={openClearModalFromMenu}
      />

      {collectionBooks.length === 0 ? (
        <CollectionPageEmptyState
          onAddBooks={openBooksModal}
        />
      ) : (
        <CollectionBooksGrid
          books={collectionBooks}
          removingBookId={removingBookId}
          onRemoveBook={openRemoveBookModal}
        />
      )}

      <CollectionBooksModal
        isOpen={isBooksModalOpen}
        userId={user.uid}
        collection={collection}
        libraryBooks={libraryBooks}
        onClose={closeBooksModal}
        onSaved={handleBooksSaved}
      />

      <CollectionEditModal
        collection={collectionToEdit}
        isSaving={isSavingCollection}
        onClose={closeEditCollectionModal}
        onSave={handleUpdateCollection}
      />

      <CollectionBookRemoveModal
        book={bookToRemove}
        isRemoving={
          removingBookId === bookToRemoveId
        }
        onClose={closeRemoveBookModal}
        onRemove={handleConfirmRemoveBook}
      />

      <CollectionClearModal
        isOpen={isClearModalOpen}
        bookCount={collectionBooks.length}
        isClearing={isClearingCollection}
        error={clearCollectionError}
        onClose={closeClearModal}
        onClear={handleClearCollection}
      />
    </div>
  )
}

export default CollectionPage