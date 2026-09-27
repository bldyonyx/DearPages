import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import BookDetails from '../components/books/BookDetails.jsx'
import BookPersonalSection from '../components/books/BookPersonalSection.jsx'
import RemoveBookModal from '../components/books/RemoveBookModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBookLibraryState } from '../hooks/useBookLibraryState.js'
import { useBookPageData } from '../hooks/useBookPageData.js'
import { BOOK_STATUSES } from '../services/libraryService.js'

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

  if (isBookLoading && !book) {
    return (
      <main className="px-5 py-6 sm:px-7 lg:px-9">
        <p className="font-handwritten text-xl text-walnut">
          Ouverture du livre...
        </p>
      </main>
    )
  }

  if (!book) {
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
        className="
          mx-auto w-full max-w-6xl
          px-5 pb-14 pt-2
          sm:px-7
          lg:px-9
        "
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
            mb-5 inline-flex
            items-center gap-2
            rounded-full
            bg-cream/75
            px-4 py-2
            font-ui text-sm
            text-walnut
            shadow-sm
            transition
            hover:-translate-x-0.5
            hover:bg-cream
            hover:text-darkwood
          "
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Retour
        </button>

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

        <BookDescriptionSection book={book} />

        <BookPersonalSection
          userId={userId}
          bookId={book.googleBooksId}
          libraryBook={libraryBook}
          isLibraryLoading={isLibraryLoading}
          onLibraryBookChange={setLibraryBook}
        />
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