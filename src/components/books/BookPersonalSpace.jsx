import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

import {
  BOOK_STATUSES,
  updateBookNote,
  updateBookRating,
  updateBookReview,
} from '../../services/libraryService.js'

import BookNotesEditor from './BookNotesEditor.jsx'

function BookPersonalSpace({
  userId,
  bookId,
  libraryBook,
  onLibraryBookChange,
}) {
  const [note, setNote] = useState(libraryBook?.note || '')
  const [review, setReview] = useState(libraryBook?.review || '')
  const [rating, setRating] = useState(libraryBook?.rating || 0)

  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const status = libraryBook?.status

  useEffect(() => {
    setNote(libraryBook?.note || '')
    setReview(libraryBook?.review || '')
    setRating(libraryBook?.rating || 0)
  }, [
    libraryBook?.note,
    libraryBook?.review,
    libraryBook?.rating,
    bookId,
  ])

  async function handleSaveNote() {
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      await updateBookNote(userId, bookId, note)

      onLibraryBookChange((currentBook) => ({
        ...currentBook,
        note,
        updatedAt: Date.now(),
      }))

      setMessage('Note enregistrée ♡')
    } catch (firebaseError) {
      console.error(firebaseError)
      setError('Impossible d’enregistrer ta note.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveReview() {
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      await updateBookReview(userId, bookId, review)

      onLibraryBookChange((currentBook) => ({
        ...currentBook,
        review,
        updatedAt: Date.now(),
      }))

      setMessage('Review enregistrée ♡')
    } catch (firebaseError) {
      console.error(firebaseError)
      setError('Impossible d’enregistrer ta review.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRatingChange(newRating) {
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      await updateBookRating(userId, bookId, newRating)

      setRating(newRating)

      onLibraryBookChange((currentBook) => ({
        ...currentBook,
        rating: newRating,
        updatedAt: Date.now(),
      }))
    } catch (firebaseError) {
      console.error(firebaseError)
      setError('Impossible d’enregistrer ta note.')
    } finally {
      setIsSaving(false)
    }
  }

  const showsNotes =
    status === BOOK_STATUSES.TO_READ ||
    status === BOOK_STATUSES.READING

  const showsReview =
    status === BOOK_STATUSES.FINISHED ||
    status === BOOK_STATUSES.ABANDONED

  const showsRating = status === BOOK_STATUSES.FINISHED

  return (
    <section className="mt-14 max-w-4xl">
      <div className="mb-5">
        <p className="font-handwritten text-lg text-olive">
        entre toi et les pages ♡
        </p>

        <h2 className="font-heading text-3xl font-bold text-darkwood">
          Mon espace
        </h2>
      </div>

      <div
        className="
          rounded-[26px]
          border border-walnut/10
          bg-cream/65
          p-6 shadow-sm
          sm:p-7
        "
      >
        {showsNotes && (
          <div>
            <h3
              className="
                mb-4
                font-heading text-2xl
                font-bold text-darkwood
              "
            >
              Mes notes
            </h3>

            <BookNotesEditor
              value={note}
              onChange={setNote}
              disabled={isSaving}
              placeholder={
                status === BOOK_STATUSES.TO_READ
                  ? 'Pourquoi veux-tu lire ce livre ?'
                  : 'Note tes pensées pendant ta lecture...'
              }
            />

            <div
              className="
                mt-4 flex flex-wrap
                items-center justify-between
                gap-3
              "
            >
              <div>
                {message && (
                  <p className="font-handwritten text-lg text-forest">
                    {message}
                  </p>
                )}

                {error && (
                  <p className="font-ui text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveNote}
                disabled={isSaving}
                className="
                  rounded-xl
                  bg-lime
                  px-5 py-2.5
                  font-ui text-sm
                  font-bold text-darkwood
                  transition
                  hover:brightness-95
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {showsRating && (
          <div>
            <h3 className="font-heading text-2xl font-bold text-darkwood">
              Ma note
            </h3>

            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= rating

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingChange(star)}
                    disabled={isSaving}
                    aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                    className={`
                      transition
                      hover:-translate-y-0.5
                      disabled:cursor-not-allowed
                      ${
                        isSelected
                          ? 'text-dustyrose'
                          : 'text-walnut/35 hover:text-dustyrose/70'
                      }
                    `}
                  >
                    <Star
                      size={30}
                      strokeWidth={1.6}
                      fill={isSelected ? 'currentColor' : 'none'}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showsReview && (
          <div className={showsRating ? 'mt-8' : ''}>
            <h3
              className="
                mb-4
                font-heading text-2xl
                font-bold text-darkwood
              "
            >
              Ma review
            </h3>

            <BookNotesEditor
              value={review}
              onChange={setReview}
              disabled={isSaving}
              placeholder={
                status === BOOK_STATUSES.ABANDONED
                  ? 'Pourquoi as-tu arrêté ce livre ?'
                  : 'Qu’est-ce que tu en as pensé ?'
              }
            />

            <div
              className="
                mt-4 flex flex-wrap
                items-center justify-between
                gap-3
              "
            >
              <div>
                {message && (
                  <p className="font-handwritten text-lg text-forest">
                    {message}
                  </p>
                )}

                {error && (
                  <p className="font-ui text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveReview}
                disabled={isSaving}
                className="
                  rounded-xl
                  bg-lime
                  px-5 py-2.5
                  font-ui text-sm
                  font-bold text-darkwood
                  transition
                  hover:brightness-95
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default BookPersonalSpace