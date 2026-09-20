import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'

import {
  addBookToCollection,
  removeBookFromCollection,
} from '../../services/collectionsService.js'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function getBookAuthors(book) {
  return book.authors?.join(', ') || 'Auteur inconnu'
}

function CollectionBooksModal({
  isOpen,
  userId,
  collection,
  libraryBooks,
  onClose,
  onSaved,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [initialSelectedIds, setInitialSelectedIds] =
    useState(new Set())
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !collection) {
      return
    }

    const currentIds = new Set(
      Object.keys(collection.books || {})
    )

    setSelectedIds(currentIds)
    setInitialSelectedIds(new Set(currentIds))
    setSearch('')
    setError('')
  }, [collection, isOpen])

  const hasChanges = useMemo(() => {
    if (initialSelectedIds.size !== selectedIds.size) {
      return true
    }

    return [...selectedIds].some(
      (bookId) => !initialSelectedIds.has(bookId)
    )
  }, [initialSelectedIds, selectedIds])

  const visibleBooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return libraryBooks
    }

    return libraryBooks.filter((book) => {
      const title = book.title?.toLowerCase() || ''
      const authors =
        book.authors?.join(' ').toLowerCase() || ''

      return (
        title.includes(normalizedSearch) ||
        authors.includes(normalizedSearch)
      )
    })
  }, [libraryBooks, search])

  function handleClose() {
    if (isSaving) {
      return
    }

    onClose()
  }

  function toggleBook(bookId) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(bookId)) {
        nextIds.delete(bookId)
      } else {
        nextIds.add(bookId)
      }

      return nextIds
    })
  }

  async function handleSave(event) {
    event.preventDefault()

    if (!userId || !collection?.id) {
      return
    }

    const bookIdsToAdd = [...selectedIds].filter(
      (bookId) => !initialSelectedIds.has(bookId)
    )

    const bookIdsToRemove = [...initialSelectedIds].filter(
      (bookId) => !selectedIds.has(bookId)
    )

    try {
      setIsSaving(true)
      setError('')

      await Promise.all([
        ...bookIdsToAdd.map((bookId) =>
          addBookToCollection(userId, collection.id, bookId)
        ),
        ...bookIdsToRemove.map((bookId) =>
          removeBookFromCollection(
            userId,
            collection.id,
            bookId
          )
        ),
      ])

      onSaved(
        Object.fromEntries(
          [...selectedIds].map((bookId) => [bookId, true])
        )
      )
      onClose()
    } catch (saveError) {
      console.error(
        'Unable to save collection books:',
        saveError
      )

      setError(
        'Impossible de modifier les livres de cette collection pour le moment.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ajouter des livres"
    >
      {libraryBooks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-heading text-xl font-bold text-darkwood">
            Ta bibliothèque est vide
          </p>

          <p className="mx-auto mt-2 max-w-xs font-ui text-sm leading-6 text-walnut/70">
            Ajoute d'abord des livres à Ma bibliothèque pour les
            ranger dans une collection.
          </p>

          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <Input
            id="collection-books-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Rechercher un livre ou un auteur..."
            aria-label="Rechercher dans ma bibliothèque"
            className="mb-4 w-full rounded-full! px-5 py-2.5"
          />

          <div className="hide-scrollbar max-h-88 space-y-2 overflow-y-auto pr-1">
            {visibleBooks.length > 0 ? (
              visibleBooks.map((book) => {
                const bookId = getBookId(book)
                const isSelected = selectedIds.has(bookId)

                return (
                  <button
                    key={bookId}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggleBook(bookId)}
                    disabled={isSaving}
                    className={`
                      flex w-full cursor-pointer
                      items-center gap-3 rounded-2xl
                      border px-3 py-2.5
                      text-left transition-colors
                      disabled:cursor-not-allowed
                      disabled:opacity-70
                      ${
                        isSelected
                          ? 'border-lime/70 bg-lime/20'
                          : 'border-walnut/10 bg-cream/70 hover:border-walnut/25'
                      }
                    `}
                  >
                    <span
                      className="
                        flex h-14 w-10 shrink-0
                        items-center justify-center
                        overflow-hidden rounded-lg
                        bg-parchment
                      "
                    >
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="px-1 text-center font-heading text-xs font-bold text-darkwood">
                          {book.title}
                        </span>
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate font-ui text-sm font-bold text-darkwood">
                        {book.title}
                      </span>

                      <span className="mt-1 block truncate font-ui text-xs text-walnut/65">
                        {getBookAuthors(book)}
                      </span>
                    </span>

                    <span
                      className={`
                        ml-auto flex h-6 w-6
                        shrink-0 items-center
                        justify-center rounded-full
                        border transition-colors
                        ${
                          isSelected
                            ? 'border-lime bg-lime text-darkwood'
                            : 'border-walnut/20 bg-cream/80'
                        }
                      `}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <Check
                          className="h-4 w-4"
                          strokeWidth={2}
                        />
                      )}
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="py-8 text-center font-ui text-sm text-walnut/70">
                Aucun livre trouvé.
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 font-ui text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              disabled={isSaving || !hasChanges}
              className="
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default CollectionBooksModal
