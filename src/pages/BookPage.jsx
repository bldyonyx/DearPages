import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

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

function getBookRouteId(book) {
  return book?.googleBooksId || book?.id || null
}

function getRouteStateBook(routeState, bookId) {
  const routeBook = routeState?.book

  return getBookRouteId(routeBook) === bookId
    ? routeBook
    : null
}

function getRouteStateLibraryBook(routeState, bookId) {
  const routeLibraryBook = routeState?.libraryBook

  return getBookRouteId(routeLibraryBook) === bookId
    ? routeLibraryBook
    : null
}

function BookPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.uid
  const routeState = location.state
  const routeBook = getRouteStateBook(routeState, id)
  const routeLibraryBook = getRouteStateLibraryBook(
    routeState,
    id
  )

  const [book, setBook] = useState(routeBook)
  const [libraryBook, setLibraryBook] =
    useState(routeLibraryBook)

  const [isBookLoading, setIsBookLoading] =
    useState(!routeBook)
  const [isLibraryLoading, setIsLibraryLoading] =
    useState(Boolean(userId))
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoveModalOpen, setIsRemoveModalOpen] =
    useState(false)

  const [error, setError] = useState('')
  const [libraryError, setLibraryError] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function loadBookDetails() {
      const optimisticBook = getRouteStateBook(
        routeState,
        id
      )

      setBook(optimisticBook)
      setIsBookLoading(!optimisticBook)
      setError('')

      try {
        const bookData = await getBookDetails(id)

        if (isCancelled) {
          return
        }

        setBook(bookData)
      } catch (fetchError) {
        console.error(fetchError)

        if (!isCancelled) {
          setError('Impossible de charger ce livre.')
        }
      } finally {
        if (!isCancelled) {
          setIsBookLoading(false)
        }
      }
    }

    loadBookDetails()

    return () => {
      isCancelled = true
    }
  }, [id, location.key, routeState])

  useEffect(() => {
    let isCancelled = false
    const optimisticLibraryBook = getRouteStateLibraryBook(
      routeState,
      id
    )

    // Reset immediately so the previous book's private state never flashes.
    setLibraryBook(optimisticLibraryBook)
    setLibraryError('')

    if (!userId) {
      setIsLibraryLoading(false)
      return () => {
        isCancelled = true
      }
    }

    async function loadLibraryBook() {
      setIsLibraryLoading(true)

      try {
        const storedBook = await getLibraryBook(userId, id)

        if (!isCancelled) {
          setLibraryBook(storedBook)
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (!isCancelled) {
          setLibraryError(
            'Impossible de charger ta bibliotheque pour ce livre.'
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLibraryLoading(false)
        }
      }
    }

    loadLibraryBook()

    return () => {
      isCancelled = true
    }
  }, [id, location.key, routeState, userId])

  async function handleAddToLibrary() {
    if (!userId || !book) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await addBookToLibrary(
        userId,
        book,
        BOOK_STATUSES.TO_READ
      )

      const storedBook = await getLibraryBook(
        userId,
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
    if (!userId || !book || !newStatus) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      if (libraryBook) {
        await updateBookStatus(
          userId,
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
          userId,
          book,
          newStatus
        )

        const storedBook = await getLibraryBook(
          userId,
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
    if (!userId || !book || !libraryBook) {
      return
    }

    setIsSaving(true)
    setLibraryError('')

    try {
      await removeBookFromLibrary(
        userId,
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

        {book.description && (
          <section className="mt-14 w-full max-w-4xl min-w-0">
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
                break-words
              "
            >
              {book.description}
            </p>
          </section>
        )}

        {libraryBook && userId ? (
          <BookPersonalSpace
            userId={userId}
            bookId={book.googleBooksId}
            libraryBook={libraryBook}
            onLibraryBookChange={setLibraryBook}
          />
        ) : isLibraryLoading ? (
          <section className="mt-14 w-full max-w-4xl min-w-0">
            <p className="font-handwritten text-lg text-olive">
              entre toi et les pages
            </p>

            <h2 className="font-heading text-3xl font-bold text-darkwood">
              Mon espace
            </h2>

            <div className="mt-3 h-px w-full bg-walnut/15" />

            <p className="mt-5 font-ui text-sm text-walnut">
              Chargement de ton espace...
            </p>
          </section>
        ) : (
          <section className="mt-14 w-full max-w-4xl min-w-0">
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
