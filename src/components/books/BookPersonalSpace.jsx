import { useEffect, useState } from 'react'
import { BookMarked } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import BookCollectionsModal from '../collections/modals/BookCollectionsModal.jsx'
import { getUserCollections } from '../../services/collectionsService.js'

import {
  BOOK_STATUSES,
  updateBookRating,
} from '../../services/libraryService.js'

import BookNotesSection from './BookNotesSection.jsx'
import BookHistoricalTextEditor from './BookHistoricalTextEditor.jsx'
import BookRatingStars from './BookRatingStars.jsx'
import BookRatingsSection from './BookRatingsSection.jsx'
import { isBookNotesUiEnabled } from '../../services/bookNotesService.js'
import { bookLarge } from './bookResponsive.js'

function BookPersonalSpace({
  userId,
  bookId,
  libraryBook,
  onLibraryBookChange,
  personalBackend,
  collectionsGateway,
}) {
  const { t } = useTranslation()
  const generation = personalBackend?.mode === 'generation'

  const [openHistoricalField, setOpenHistoricalField] = useState(null)
  const [rating, setRating] = useState(libraryBook?.rating || 0)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [collectionCount, setCollectionCount] = useState(0)

  const [
    isCollectionsModalOpen,
    setIsCollectionsModalOpen,
  ] = useState(false)

  const status = libraryBook?.status

  useEffect(() => {
    setRating(libraryBook?.rating || 0)
  }, [libraryBook?.rating, bookId, userId])

  useEffect(() => {
    if (generation && !collectionsGateway) return
    let isActive = true

    async function loadCollectionCount() {
      try {
        const collections = generation ? [] : await getUserCollections(userId)

        const nextCollectionCount = generation ? await collectionsGateway.bookCount(personalBackend.context) : collections.filter(
          (collection) => collection.books?.[bookId]
        ).length

        if (isActive) {
          setCollectionCount(nextCollectionCount)
        }
      } catch (collectionsError) {
        console.error(
          'Unable to load book collection count:',
          collectionsError
        )

        if (isActive) {
          setCollectionCount(0)
        }
      }
    }

    loadCollectionCount()

    return () => {
      isActive = false
    }
  }, [bookId, userId, generation, collectionsGateway, personalBackend])

  async function handleRatingChange(newRating) {
    if (generation) return
    setIsSaving(true)
    setError('')

    try {
      await updateBookRating(userId, bookId, newRating)

      setRating(newRating)

      onLibraryBookChange((currentBook) => currentBook && ({
        ...currentBook,
        rating: newRating,
        updatedAt: Date.now(),
      }))
    } catch (firebaseError) {
      console.error(firebaseError)
      setError(t('bookPage.personal.ratingSaveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const showsRating =
    status === BOOK_STATUSES.FINISHED

  return (
    <section
      className={`
        dp-section-enter
        mt-14 w-full min-w-0
        ${bookLarge.personalSection}
        ${bookLarge.sectionGap}
      `}
    >
      <div className={`mb-5 ${bookLarge.personalHeader}`}>
        <p
          className={`
            font-handwritten text-lg text-olive
            ${bookLarge.handwritten}
          `}
        >
          {t('bookPage.personal.eyebrow')}
        </p>

        <h2
          className={`
            font-heading text-3xl font-bold text-darkwood
            ${bookLarge.sectionTitle}
          `}
        >
          {t('bookPage.personal.title')}
        </h2>
      </div>

      <div
        className={`
          rounded-3xl
          border border-darkwood/10
          bg-cream/80
          p-6
          shadow-[0_8px_30px_rgba(83,55,76,0.07)]
          sm:p-7
          ${bookLarge.personalCard}
        `}
      >
        {(!generation || collectionsGateway) && <div
          className="
            mb-6 flex flex-col gap-3
            rounded-2xl
            border border-walnut/10
            bg-mintcream/35
            px-4 py-4
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div className="min-w-0">
            <p
              className={`
                font-ui text-sm font-bold text-darkwood
                ${bookLarge.personalText}
              `}
            >
              {t('bookPage.personal.collections')}
            </p>

            <p
              className={`
                mt-1 font-ui text-xs leading-5 text-walnut/65
                ${bookLarge.personalSmallText}
              `}
            >
              {collectionCount > 0
                ? t('bookPage.personal.collectionCount', {
                    count: collectionCount,
                  })
                : t('bookPage.personal.collectionsEmpty')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCollectionsModalOpen(true)}
            className={`
              inline-flex w-full
              items-center justify-center gap-2
              rounded-2xl
              border border-olive/20
              bg-cream/80
              px-4 py-2.5
              font-ui text-sm
              font-bold text-darkwood
              shadow-[0_2px_8px_rgba(83,55,76,0.04)]
              transition-[border-color,background-color,box-shadow] duration-200 ease-out
              hover:border-olive/30
              hover:bg-lime/35
              hover:shadow-[0_4px_12px_rgba(83,55,76,0.07)]
              sm:w-fit
              lg:shrink-0
              ${bookLarge.personalControl}
            `}
          >
            <BookMarked
              size={17}
              strokeWidth={1.8}
              aria-hidden="true"
              className={`
                text-olive
                ${bookLarge.personalIcon}
              `}
            />

            {t('bookPage.personal.manageCollections')}
          </button>
        </div>}

        {showsRating && (
          <BookRatingsSection key={`${userId}/${bookId}`} userId={userId} bookId={bookId} personalBackend={personalBackend} legacyControl={generation ? null : <div>
            <h3
              className={`
                font-heading text-2xl font-bold text-darkwood
                ${bookLarge.personalSubheading}
              `}
            >
              {t('bookPage.personal.ratingTitle')}
            </h3>

            <div className="mt-3 rounded-2xl border border-walnut/15 bg-cream/70 p-3">
              <BookRatingStars value={rating} onChange={handleRatingChange} disabled={isSaving} />
            </div>
          </div>} />
        )}

        {error && <p role="alert" className="mt-4 font-ui text-sm text-red-700">{error}</p>}

        <div className="mt-8">
          {generation || isBookNotesUiEnabled ? (
            <BookNotesSection key={`${userId}/${bookId}`} userId={userId} bookId={bookId} personalBackend={personalBackend} historicalReview={generation ? undefined : libraryBook?.review} />
          ) : (
            <section className="min-w-0 space-y-4">
              <h3 className={`font-heading text-2xl font-bold text-darkwood ${bookLarge.personalSubheading}`}>
                {t('bookPage.personal.notesTitle')}
              </h3>
              {['note', 'review'].map((field) => (
                <BookHistoricalTextEditor key={`${userId}/${bookId}/${field}`} field={field} value={libraryBook?.[field]}
                  userId={userId} bookId={bookId} onLibraryBookChange={onLibraryBookChange}
                  expanded={openHistoricalField === field}
                  onToggle={() => setOpenHistoricalField((current) => current === field ? null : field)} />
              ))}
            </section>
          )}
        </div>
      </div>

      {(!generation || collectionsGateway) && <BookCollectionsModal
        generationGateway={collectionsGateway}
        bookContext={personalBackend?.context}
        isOpen={isCollectionsModalOpen}
        userId={userId}
        bookId={bookId}
        onClose={() => setIsCollectionsModalOpen(false)}
        onSaved={setCollectionCount}
      />}
    </section>
  )
}

export default BookPersonalSpace
