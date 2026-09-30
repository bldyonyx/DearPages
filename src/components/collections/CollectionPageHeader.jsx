import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'

import { getCollectionIcon } from '../../data/collectionIcons.js'

function CollectionPageHeader({
  collection,
  bookCount,
  isActionsMenuOpen,
  actionsMenuRef,
  onToggleActionsMenu,
  onAddBooks,
  onClearCollection,
}) {
  const collectionIcon = getCollectionIcon(collection.icon)
  const CollectionIcon = collectionIcon.icon

  return (
    <header>
      <Link
        to="/collections"
        className="
          inline-flex items-center gap-2
          rounded-full border border-walnut/10
          bg-cream/75 px-4 py-2
          font-ui text-sm font-bold
          text-walnut shadow-sm
          transition
          hover:-translate-y-0.5
          hover:border-walnut/20
          hover:bg-cream
          hover:text-darkwood
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-darkwood/25
        "
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
          strokeWidth={1.8}
        />

        <span>Retour</span>
      </Link>

      <div className="mt-7">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="
              flex h-12 w-12 shrink-0
              items-center justify-center
              rounded-full border
              border-walnut/15
              bg-parchment/60
              text-walnut
              shadow-sm
            "
            title={collectionIcon.label}
          >
            <CollectionIcon
              aria-hidden="true"
              className="h-6 w-6"
              strokeWidth={1.8}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="
                wrap-break-word
                font-heading text-3xl
                font-bold leading-tight
                text-darkwood
                md:text-4xl
              "
            >
              {collection.name}
            </h1>

            {collection.description && (
              <p
                className="
                  mt-3 max-w-4xl
                  whitespace-normal
                  wrap-break-word
                  font-ui text-sm
                  font-semibold leading-6
                  text-walnut/70
                  md:text-base
                  md:leading-7
                "
                style={{
                  overflowWrap: 'anywhere',
                }}
              >
                {collection.description}
              </p>
            )}
          </div>
        </div>

        <div
          className="
            mt-6 flex flex-col gap-3
            border-b border-walnut/10
            pb-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p
            className="
              font-ui text-sm font-bold
              text-walnut/65
            "
          >
            {bookCount} {bookCount > 1 ? 'livres' : 'livre'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAddBooks}
              className="
                inline-flex cursor-pointer
                items-center justify-center gap-2
                rounded-full bg-lime
                px-5 py-2.5
                font-ui text-sm font-bold
                text-darkwood shadow-sm
                transition
                hover:-translate-y-0.5
                hover:shadow-md
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-darkwood/25
              "
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.8}
              />

              <span>Ajouter des livres</span>
            </button>

            <div
              ref={actionsMenuRef}
              className="relative"
            >
              <button
                type="button"
                onClick={onToggleActionsMenu}
                aria-label={`Actions pour ${collection.name}`}
                aria-expanded={isActionsMenuOpen}
                className="
                  flex h-10 w-10 cursor-pointer
                  items-center justify-center
                  rounded-full border
                  border-walnut/10
                  bg-cream/85
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
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={1.8}
                />
              </button>

              {isActionsMenuOpen && (
                <div
                  className="
                    absolute right-0 top-12 z-30
                    min-w-44 rounded-2xl
                    border border-walnut/15
                    bg-cream p-1.5
                    shadow-md
                  "
                >
                  <button
                    type="button"
                    onClick={onClearCollection}
                    disabled={bookCount === 0}
                    className="
                      flex w-full cursor-pointer
                      items-center gap-2
                      rounded-xl px-3 py-2
                      text-left font-ui text-sm
                      font-bold text-darkwood
                      transition-colors
                      hover:bg-dustyrose/25
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    <Trash2
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={1.8}
                    />

                    <span>Vider la collection</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default CollectionPageHeader