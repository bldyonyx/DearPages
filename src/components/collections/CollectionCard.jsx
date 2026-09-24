import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
} from 'lucide-react'

import BookCover from '../books/BookCover.jsx'

function getBookCount(collection) {
  return Object.keys(collection.books || {}).length
}

function CollectionCoverPreview({ preview }) {
  const book = preview.book
  const title = book?.title || 'Livre sans couverture'

  return (
    <div
      className="
        aspect-2/3 min-w-0 overflow-hidden
        rounded-[10px] border
        border-walnut/10 bg-parchment
        shadow-sm
      "
    >
      <BookCover
        title={title}
        cover={book?.cover}
        isbn={book?.isbn}
        source={book?.source}
        fallback="title"
        className="h-full w-full"
        imageClassName="h-full w-full object-cover"
        titleClassName="
          break-words font-heading text-xs font-bold
          leading-tight text-darkwood/75
        "
      />
    </div>
  )
}

function CollectionCard({
  collection,
  previewBooks = [],
  onDeleteRequest,
  onEditRequest,
  onPinRequest,
}) {
  const bookCount = getBookCount(collection)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function handleDeleteClick(event) {
    event.stopPropagation()
    setIsMenuOpen(false)
    onDeleteRequest(collection)
  }

  function handleEditClick(event) {
    event.stopPropagation()
    setIsMenuOpen(false)
    onEditRequest(collection)
  }

  function handlePinClick(event) {
    event.stopPropagation()
    setIsMenuOpen(false)
    onPinRequest(collection)
  }

  function handleMenuClick(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsMenuOpen((current) => !current)
  }

  return (
    <article
      className="
        group relative h-full min-h-56 min-w-0
        rounded-[24px] border border-walnut/15
        bg-cream/90 shadow-sm transition
        hover:-translate-y-0.5
        hover:border-walnut/25
        hover:shadow-md
      "
    >
      <Link
        to={`/collections/${collection.id}`}
        className="
          flex h-full min-w-0 flex-col
          rounded-[24px] p-5
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-darkwood/30
        "
        aria-label={`Ouvrir la collection ${collection.name}`}
      >
        <div className="flex min-w-0 items-start gap-4 pr-11">
          <div className="min-w-0 flex-1">
            <h2
              title={collection.name}
              className="
                overflow-hidden break-words
                font-heading text-2xl
                font-bold leading-tight
                text-darkwood
              "
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflowWrap: 'anywhere',
              }}
            >
              {collection.name}
            </h2>

            <p className="mt-1 font-ui text-xs font-bold text-walnut/65">
              {bookCount} {bookCount > 1 ? 'livres' : 'livre'}
            </p>
          </div>
        </div>

        {collection.description && (
          <p
            className="
              mt-3 min-w-0 overflow-hidden
              break-words font-ui text-sm
              leading-6 text-walnut/70
            "
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflowWrap: 'anywhere',
            }}
          >
            {collection.description}
          </p>
        )}

        <div
          className="
            mt-auto grid min-h-28
            grid-cols-4 items-end gap-3
            pt-6
          "
        >
          {bookCount === 0 ? (
            <div
              className="
                col-span-4 flex min-h-24
                items-center rounded-2xl
                border border-dashed
                border-walnut/15
                bg-parchment/35 px-4
              "
            >
              <p className="font-ui text-xs font-bold text-walnut/55">
                aucun livre pour le moment ♡
              </p>
            </div>
          ) : (
            previewBooks.map((preview) => (
              <CollectionCoverPreview
                key={preview.id}
                preview={preview}
              />
            ))
          )}
        </div>
      </Link>

      <div className="absolute right-4 top-4 z-20">
        <button
          type="button"
          onClick={handleMenuClick}
          aria-label={`Actions pour ${collection.name}`}
          aria-expanded={isMenuOpen}
          className="
            flex h-9 w-9 cursor-pointer
            items-center justify-center
            rounded-full border
            border-walnut/10 bg-cream/85
            text-walnut shadow-sm
            transition-colors
            hover:border-walnut/25
            hover:bg-cream
            hover:text-darkwood
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-darkwood/25
          "
        >
          <MoreHorizontal
            className="h-5 w-5"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        {isMenuOpen && (
          <div
            className="
              absolute right-0 top-11 z-30
              min-w-40 rounded-2xl
              border border-walnut/15
              bg-cream p-1.5
              shadow-md
            "
          >
            <button
              type="button"
              onClick={handlePinClick}
              className="
                flex w-full cursor-pointer
                items-center gap-2
                rounded-xl px-3 py-2
                text-left font-ui text-sm
                font-bold text-darkwood
                transition-colors
                hover:bg-lime/30
              "
            >
              <Pin
                className="h-4 w-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              {collection.pinned
                ? 'Désépingler'
                : 'Épingler'}
            </button>

            <button
              type="button"
              onClick={handleEditClick}
              className="
                flex w-full cursor-pointer
                items-center gap-2
                rounded-xl px-3 py-2
                text-left font-ui text-sm
                font-bold text-darkwood
                transition-colors
                hover:bg-lime/30
              "
            >
              <Pencil
                className="h-4 w-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              Modifier
            </button>

            <button
              type="button"
              onClick={handleDeleteClick}
              className="
                flex w-full cursor-pointer
                items-center gap-2
                rounded-xl px-3 py-2
                text-left font-ui text-sm
                font-bold text-darkwood
                transition-colors
                hover:bg-dustyrose/25
              "
            >
              <Trash2
                className="h-4 w-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              Supprimer
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export default CollectionCard
