import { useEffect } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import BookDetails from '../components/books/BookDetails.jsx'
import BookPersonalSection from '../components/books/BookPersonalSection.jsx'
import RemoveBookModal from '../components/books/RemoveBookModal.jsx'
import { bookLarge } from '../components/books/bookResponsive.js'
import BackButton from '../components/ui/BackButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBookLibraryState } from '../hooks/useBookLibraryState.js'
import { useBookPageData } from '../hooks/useBookPageData.js'
import { BOOK_STATUSES } from '../services/libraryService.js'
import {
  hasCompleteInitialBookDetails,
  hasUsefulBookDescription,
} from '../utils/bookPageUtils.js'

const STATUS_OPTIONS = [
  {
    value: BOOK_STATUSES.TO_READ,
    label: 'À lire',
  },
  {
    value: BOOK_STATUSES.READING,
    label: 'En cours',
  },
  {
    value: BOOK_STATUSES.FINISHED,
    label: 'Terminé',
  },
  {
    value: BOOK_STATUSES.ABANDONED,
    label: 'Abandonné',
  },
]

function BookDetailsLoadingState() {
  return (
    <section
      className="
        min-h-90
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        px-5 py-6
        shadow-sm
        backdrop-blur-[2px]
        sm:px-7 sm:py-8
        md:px-8
        lg:px-11 lg:py-10
      "
      role="status"
      aria-live="polite"
      aria-label="Chargement des détails du livre"
    >
      <div
        className="
          flex h-full min-h-75
          items-center justify-center
          text-center
        "
      >
        <p className="font-handwritten text-xl text-walnut">
          Ouverture du livre...
        </p>
      </div>
    </section>
  )
}

function BookPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.uid
  const routeState = location.state

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }, [id])

  const { book, isBookLoading, error } = useBookPageData({
    bookId: id,
    routeKey: location.key,
    routeState,
  })

  const {
    libraryBook,
    setLibraryBook,
    isLibraryLoading,
    isSaving,
    isRemoveModalOpen,
    libraryError,
    handleAddToLibrary,
    handleStatusChange,
    handleOpenRemoveModal,
    handleCloseRemoveModal,
    handleConfirmRemove,
  } = useBookLibraryState({
    book,
    bookId: id,
    routeKey: location.key,
    routeState,
    userId,
  })

  const canRenderBookDetails =
    Boolean(book) &&
    (!isBookLoading ||
      hasCompleteInitialBookDetails(book))

  const canRenderSupportingSections =
    Boolean(book) &&
    (!isBookLoading || hasUsefulBookDescription(book))

  if (!isBookLoading && !book) {
    return (
      <main className="px-5 py-6 sm:px-7 lg:px-9">
        <p className="font-ui text-sm text-red-700">
          {error || 'Livre introuvable.'}
        </p>
      </main>
    )
  }

  return (
    <>
      <main
        className={`
          w-full
          px-5 pb-14 pt-6
          sm:px-7
          lg:px-9
          ${bookLarge.page}
          ${bookLarge.pagePadding}
        `}
      >
        <BackButton
          onClick={() => navigate(-1)}
          className={`mb-5 ${bookLarge.backButton}`}
        />

        {!canRenderBookDetails ? (
          <BookDetailsLoadingState />
        ) : (
          <>
            <BookDetails
              book={book}
              libraryBook={libraryBook}
              isLibraryLoading={isLibraryLoading}
              isSaving={isSaving}
              libraryError={libraryError}
              statusOptions={STATUS_OPTIONS}
              onAddToLibrary={handleAddToLibrary}
              onStatusChange={handleStatusChange}
              onRemoveFromLibrary={handleOpenRemoveModal}
            />

            {error && (
              <p className="mt-4 font-ui text-sm text-red-700">
                {error}
              </p>
            )}

            {canRenderSupportingSections && (
              <>
                <BookDescriptionSection book={book} />

                <BookPersonalSection
                  userId={userId}
                  bookId={book.googleBooksId}
                  libraryBook={libraryBook}
                  isLibraryLoading={isLibraryLoading}
                  onLibraryBookChange={setLibraryBook}
                />
              </>
            )}
          </>
        )}
      </main>

      <RemoveBookModal
        isOpen={isRemoveModalOpen}
        isRemoving={isSaving}
        onCancel={handleCloseRemoveModal}
        onConfirm={handleConfirmRemove}
      />
    </>
  )
}

export default BookPage
