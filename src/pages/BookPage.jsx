
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import BookDetails from '../components/books/BookDetails.jsx'
import BookEditionsSection from '../components/books/BookEditionsSection.jsx'
import BookPersonalSection from '../components/books/BookPersonalSection.jsx'
import RemoveBookModal from '../components/books/RemoveBookModal.jsx'
import { bookLarge } from '../components/books/bookResponsive.js'
import BackButton from '../components/ui/BackButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBookLibraryState } from '../hooks/useBookLibraryState.js'
import { useBookPageData } from '../hooks/useBookPageData.js'
import { BOOK_STATUSES } from '../services/libraryService.js'
import {
  getBookRouteId,
  hasCompleteInitialBookDetails,
} from '../utils/bookPageUtils.js'

const STATUS_OPTIONS = [
  { value: BOOK_STATUSES.TO_READ, labelKey: 'status.to-read' },
  { value: BOOK_STATUSES.READING, labelKey: 'status.reading' },
  { value: BOOK_STATUSES.FINISHED, labelKey: 'status.finished' },
  { value: BOOK_STATUSES.ABANDONED, labelKey: 'status.abandoned' },
]

function BookDetailsLoadingState({ shouldAnimate = true }) {
  const { t } = useTranslation()

  return (
    <section
      className={`
        ${shouldAnimate ? 'dp-section-enter' : ''}
        min-h-90 rounded-3xl
        border border-darkwood/10
        bg-cream/80 px-5 py-6 shadow-sm
        sm:px-7 sm:py-8 md:px-8
        lg:px-11 lg:py-10
      `}
      role="status"
      aria-live="polite"
      aria-label={t('bookPage.loadingDetailsAria')}
    >
      <div
        className="
          flex h-full min-h-75
          items-center justify-center text-center
        "
      >
        <p className="font-handwritten text-xl text-walnut">
          {t('bookPage.openingBook')}
        </p>
      </div>
    </section>
  )
}

function BookPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.uid
  const routeState = location.state

  const [isEditionsOpen, setIsEditionsOpen] = useState(false)

  const closeEditions = useCallback(() => {
    setIsEditionsOpen(false)
  }, [])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })

    setIsEditionsOpen(false)
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
    (!isBookLoading || hasCompleteInitialBookDetails(book))

  const currentBookId = getBookRouteId(book) || id

  if (!isBookLoading && !book) {
    return (
      <main className="px-5 py-6 sm:px-7 lg:px-9">
        <p role="alert" className="font-ui text-sm text-red-700">
          {error || t('bookPage.notFound')}
        </p>
      </main>
    )
  }

  return (
    <>
      <main
        className={`
          w-full px-5 pb-14 pt-6
          sm:px-7 lg:px-9
          ${bookLarge.page}
          ${bookLarge.pagePadding}
        `}
      >
        <div key={id} className="dp-page-enter">
          <BackButton
            onClick={() => navigate(-1)}
            className={`mb-5 ${bookLarge.backButton}`}
          />

          {!canRenderBookDetails ? (
            <BookDetailsLoadingState shouldAnimate={false} />
          ) : (
            <BookDetails
              book={book}
              libraryBook={libraryBook}
              shouldAnimate={false}
              isLibraryLoading={isLibraryLoading}
              isSaving={isSaving}
              libraryError={libraryError}
              statusOptions={STATUS_OPTIONS}
              onAddToLibrary={handleAddToLibrary}
              onStatusChange={handleStatusChange}
              onRemoveFromLibrary={handleOpenRemoveModal}
              onOpenEditions={() => setIsEditionsOpen(true)}
            />
          )}
        </div>

        {canRenderBookDetails && (
          <div key={`book-sections-${id}`}>
            {error && (
              <p
                role="alert"
                className="mt-4 font-ui text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <BookDescriptionSection
              book={book}
              isBookLoading={isBookLoading}
            />

            {!isBookLoading && (
              <BookPersonalSection
                userId={userId}
                bookId={currentBookId}
                libraryBook={libraryBook}
                isLibraryLoading={isLibraryLoading}
                onLibraryBookChange={setLibraryBook}
              />
            )}
          </div>
        )}
      </main>

      {book && (
        <BookEditionsSection
          book={book}
          isOpen={isEditionsOpen}
          onClose={closeEditions}
        />
      )}

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
