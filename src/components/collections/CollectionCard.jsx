import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

function getBookCount(collection) {
  return Object.keys(collection.books || {}).length
}

function CollectionCard({ collection, onDeleteRequest }) {
  const bookCount = getBookCount(collection)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function handleDeleteClick() {
    setIsMenuOpen(false)
    onDeleteRequest(collection)
  }

  return (
    <article
      className="
        group relative flex h-full min-h-48 min-w-0
        flex-col rounded-[24px]
        border border-walnut/15
        bg-cream/85 p-5
        shadow-sm transition
        hover:-translate-y-1
        hover:border-walnut/30
        hover:shadow-md
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="
            flex h-11 w-11 shrink-0
            items-center justify-center
            rounded-2xl bg-lime/80
            text-darkwood
            transition
            group-hover:brightness-95
          "
          aria-hidden="true"
        >
          <BookOpen className="h-5 w-5" strokeWidth={1.8} />
        </div>

        <div className="flex items-center gap-2">
          <span
            className="
              rounded-full border border-walnut/15
              bg-parchment/55 px-3 py-1
              font-ui text-xs font-bold
              text-walnut
            "
          >
            {bookCount} {bookCount > 1 ? 'livres' : 'livre'}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setIsMenuOpen((current) => !current)
              }
              aria-label={`Actions pour ${collection.name}`}
              aria-expanded={isMenuOpen}
              className="
                flex h-9 w-9 cursor-pointer
                items-center justify-center
                rounded-full border
                border-walnut/10 bg-cream/80
                text-walnut transition-colors
                hover:border-walnut/25
                hover:text-darkwood
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
                  absolute right-0 top-11 z-10
                  min-w-36 rounded-2xl
                  border border-walnut/15
                  bg-cream p-1.5
                  shadow-md
                "
              >
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
        </div>
      </div>

      <Link
        to={`/collections/${collection.id}`}
        className="
          mt-5 flex flex-1 flex-col
          rounded-2xl
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-darkwood/30
        "
        aria-label={`Ouvrir la collection ${collection.name}`}
      >
        <h2
          title={collection.name}
          className="
            overflow-hidden
            font-heading text-2xl
            font-bold leading-tight
            text-darkwood
          "
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {collection.name}
        </h2>

        {collection.description && (
          <p
            className="
              mt-3 overflow-hidden
              font-ui text-sm leading-6
              text-walnut/70
            "
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
            }}
          >
            {collection.description}
          </p>
        )}

        <p
          className="
            mt-auto pt-6
            font-ui text-sm font-bold
            text-darkwood
            transition-opacity
            group-hover:opacity-70
          "
        >
          Voir la collection
        </p>
      </Link>
    </article>
  )
}

export default CollectionCard
