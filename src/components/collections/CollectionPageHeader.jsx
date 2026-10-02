import {
  BookMinus,
  MoreHorizontal,
  Pencil,
  Plus,
} from 'lucide-react'

import { getCollectionIcon } from '../../data/collectionIcons.js'
import BackButton from '../ui/BackButton.jsx'
import { collectionPageLarge } from './collectionPageResponsive.js'

function getBookLabel(bookCount) {
  return `${bookCount} ${bookCount > 1 ? 'livres' : 'livre'}`
}

function CollectionPageHeader({
  collection,
  bookCount,
  isActionsMenuOpen,
  actionsMenuRef,
  onToggleActionsMenu,
  onAddBooks,
  onEditCollection,
  onClearCollection,
}) {
  const collectionIcon = getCollectionIcon(collection.icon)
  const CollectionIcon = collectionIcon.icon

  return (
    <header
      className={`dp-page-enter min-w-0 py-4 ${collectionPageLarge.headerTop}`}
    >
      <BackButton
        to="/collections"
        className={collectionPageLarge.backButton}
      />

      <div
        className={`mt-5 min-w-0 ${collectionPageLarge.headerContent}`}
      >
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span
            className={`
              mt-0.5 flex h-11 w-11
              shrink-0 items-center
              justify-center rounded-full
              border border-lime/50
              bg-lime/25 text-darkwood
              sm:h-12 sm:w-12
              ${collectionPageLarge.icon}
            `}
            title={collectionIcon.label}
          >
            <CollectionIcon
              className={`
                h-5 w-5
                sm:h-6 sm:w-6
                ${collectionPageLarge.iconSvg}
              `}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0 flex-1">
            <h1
              className={`
                font-heading text-3xl
                font-bold leading-tight
                text-darkwood
                md:text-4xl
                ${collectionPageLarge.title}
              `}
              style={{
                overflowWrap: 'anywhere',
              }}
            >
              {collection.name}
            </h1>
          </div>
        </div>

        {collection.description && (
          <p
            className={`
              mt-4 w-full max-w-5xl
              whitespace-normal
              font-ui text-sm
              leading-7 text-walnut/75
              md:text-base
              ${collectionPageLarge.description}
            `}
            style={{
              overflowWrap: 'anywhere',
              wordBreak: 'normal',
            }}
          >
            {collection.description}
          </p>
        )}

        <div
          className="
            mt-5 flex min-w-0
            flex-col gap-3
            sm:flex-row
            sm:flex-wrap
            sm:items-center
            sm:justify-between
            lg:items-start
          "
        >
          <span
            className="
              inline-flex w-fit
              rounded-full
              border border-walnut/15
              bg-cream/75 px-3 py-1.5
              font-ui text-xs font-bold
              text-walnut
            "
          >
            {getBookLabel(bookCount)}
          </span>

          <div
            className="
              flex min-w-0 flex-wrap
              items-center justify-end
              gap-3
              sm:flex-nowrap
            "
          >
            <button
              type="button"
              onClick={onAddBooks}
              className="
                inline-flex min-h-10
                min-w-0 flex-1
                cursor-pointer items-center
                justify-center gap-2
                rounded-full
                border border-lime/70
                bg-lime/70 px-3
                font-ui text-sm
                font-bold text-darkwood
                whitespace-normal
                shadow-sm
                transition-colors
                hover:bg-lime
                sm:flex-none sm:px-4
                sm:whitespace-nowrap
              "
            >
              <Plus
                className="h-4 w-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              Ajouter des livres
            </button>

            <div
              ref={actionsMenuRef}
              className="relative shrink-0"
            >
              <button
                type="button"
                onClick={onToggleActionsMenu}
                aria-label="Actions de collection"
                aria-haspopup="menu"
                aria-expanded={isActionsMenuOpen}
                className="
                  inline-flex h-10 w-10
                  cursor-pointer items-center
                  justify-center rounded-full
                  border border-walnut/15
                  bg-cream/70 text-walnut
                  shadow-sm
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

              {isActionsMenuOpen && (
                <div
                  role="menu"
                  className="
                    dp-menu-enter
                    absolute right-0 top-12 z-10
                    w-max min-w-52
                    max-w-[calc(100vw-3rem)]
                    rounded-2xl
                    border border-walnut/15
                    bg-cream p-1.5
                    shadow-md
                  "
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onEditCollection}
                    className="
                      flex w-full cursor-pointer
                      items-center gap-2
                      rounded-xl px-3 py-2
                      text-left font-ui text-sm
                      font-bold text-darkwood
                      transition-colors
                      hover:bg-lime/25
                    "
                  >
                    <Pencil
                      className="h-4 w-4"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />

                    Modifier la collection
                  </button>

                  {bookCount > 0 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onClearCollection}
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
                      <BookMinus
                        className="h-4 w-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />

                      Vider la collection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 h-px w-full bg-walnut/15" />
    </header>
  )
}

export default CollectionPageHeader
