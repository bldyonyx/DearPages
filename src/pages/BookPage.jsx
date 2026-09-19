import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import BookDetails from '../components/books/BookDetails.jsx'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import RemoveBookModal from '../components/books/RemoveBookModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getBookById } from '../services/booksApi.js'
import {
  addBookToLibrary,
  BOOK_STATUSES,
  getLibraryBook,
  removeBookFromLibrary,
  updateBookStatus,
} from '../services/libraryService.js'
import { getOpenLibraryBookById } from '../services/trendingBooksApi.js'

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

/**
 * Vérifie si un identifiant correspond à un Work Open Library.
 *
 * Les livres provenant du rayon "Tendances du moment"
 * utilisent des identifiants comme `OL76590W`.
 *
 * @param {string} bookId - Identifiant présent dans la route.
 * @returns {boolean} True si l'identifiant appartient à Open Library.
 */
function isOpenLibraryWorkId(bookId) {
  return /^OL\d+W$/i.test(bookId)
}

/**
 * Récupère un livre depuis la source correspondant à son identifiant.
 *
 * @param {string} bookId - Identifiant du livre.
 * @returns {Promise<Object|null>} Livre formaté pour Dear Pages.
 */
async function getBookDetails(bookId) {
  if (isOpenLibraryWorkId(bookId)) {
    return getOpenLibraryBookById(bookId)
  }

  return getBookById(bookId)
}

function BookPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [book, setBook] = useState(null)
  const [libraryBook, setLibraryBook] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoveModalOpen, setIsRemoveModalOpen] =
    useState(false)

  const [error, setError] = useState('')
  const [libraryError, setLibraryError] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function loadBookPage() {
      setIsLoading(true)
      setError('')

      try {
        const [bookData, storedBook] = await Promise.all([
          getBookDetails(id),
          user ? getLibraryBook(user.uid, id) : null,
        ])

        if (isCancelled) {
          return
        }

        setBook(bookData)
        setLibraryBook(storedBook)
      } catch (fetchError) {
        console.error(fetchError)

        if (!isCancelled) {
          setError('Impossible de charger ce livre.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadBookPage()

    return () => {
      isCancelled = true
    }
  }, [id, user])

  async function handleAddToLibrary() {
    if (!user || !book) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await addBookToLibrary(
        user.uid,
        book,
        BOOK_STATUSES.TO_READ
      )

      const storedBook = await getLibraryBook(
        user.uid,
        book.googleBooksId
      )

      setLibraryBook(storedBook)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible d’ajouter ce livre à ta bibliothèque.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!user || !book || !newStatus) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      if (libraryBook) {
        await updateBookStatus(
          user.uid,
          book.googleBooksId,
          newStatus
        )

        setLibraryBook((currentBook) => ({
          ...currentBook,
          status: newStatus,
          updatedAt: Date.now(),
        }))
      } else {
        await addBookToLibrary(
          user.uid,
          book,
          newStatus
        )

        const storedBook = await getLibraryBook(
          user.uid,
          book.googleBooksId
        )

        setLibraryBook(storedBook)
      }
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible de modifier le statut de ce livre.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenRemoveModal() {
    setLibraryError('')
    setIsRemoveModalOpen(true)
  }

  function handleCloseRemoveModal() {
    if (isSaving) {
      return
    }

    setIsRemoveModalOpen(false)
  }

  async function handleConfirmRemove() {
    if (!user || !book || !libraryBook) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await removeBookFromLibrary(
        user.uid,
        book.googleBooksId
      )

      setLibraryBook(null)
      setIsRemoveModalOpen(false)
    } catch (firebaseError) {
      console.error(firebaseError)

      setLibraryError(
        'Impossible de retirer ce livre de ta bibliothèque.'
      )

      setIsRemoveModalOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="px-5 py-6 sm:px-7 lg:px-9">
        <p className="font-handwritten text-xl text-walnut">
          Ouverture du livre...
        </p>
      </main>
    )
  }

  if (error || !book) {
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
          isSaving={isSaving}
          libraryError={libraryError}
          statusOptions={STATUS_OPTIONS}
          onAddToLibrary={handleAddToLibrary}
          onStatusChange={handleStatusChange}
          onRemoveFromLibrary={handleOpenRemoveModal}
        />

        {book.description && (
          <section className="mt-14 max-w-4xl">
            <p className="font-handwritten text-lg text-olive">
              quelques mots sur ce livre ♡
            </p>

            <h2 className="font-heading text-3xl font-bold text-darkwood">
              À propos
            </h2>

            <div className="mt-3 h-px w-full bg-walnut/15" />

            <p
              className="
                mt-5
                font-ui text-sm
                leading-7 text-ink
              "
            >
              {book.description}
            </p>
          </section>
        )}

        {libraryBook ? (
          <BookPersonalSpace
            userId={user.uid}
            bookId={book.googleBooksId}
            libraryBook={libraryBook}
            onLibraryBookChange={setLibraryBook}
          />
        ) : (
          <section className="mt-14 max-w-4xl">
            <p className="font-handwritten text-lg text-olive">
              entre toi et les pages ♡
            </p>

            <h2 className="font-heading text-3xl font-bold text-darkwood">
              Mon espace
            </h2>

            <div className="mt-3 h-px w-full bg-walnut/15" />

            <p className="mt-5 font-ui text-sm text-walnut">
              Ajoute ce livre à ta bibliothèque pour garder
              tes pensées et tes notes.
            </p>
          </section>
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