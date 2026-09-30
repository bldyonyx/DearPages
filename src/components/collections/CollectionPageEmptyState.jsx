import { BookOpen, Plus } from 'lucide-react'

import { collectionPageLarge } from './collectionPageResponsive.js'

function CollectionPageEmptyState({ onAddBooks }) {
  return (
    <section
      className={`
        mx-auto mt-8 max-w-2xl
        rounded-3xl
        border border-darkwood/10
        bg-cream/80 px-6 py-12
        shadow-sm
        sm:px-8
        sm:py-14
        ${collectionPageLarge.sectionGap}
        ${collectionPageLarge.emptyPanel}
      `}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div
          className="
            flex h-14 w-14
            items-center justify-center
            rounded-full border
            border-walnut/15
            bg-parchment/60
            text-walnut
            shadow-sm
          "
        >
          <BookOpen
            aria-hidden="true"
            className="h-6 w-6"
            strokeWidth={1.8}
          />
        </div>

        <h2
          className={`
            mt-5 font-heading
            text-2xl font-bold
            text-darkwood
            ${collectionPageLarge.emptyTitle}
          `}
        >
          Cette collection est encore vide
        </h2>

        <p
          className={`
            mt-2 max-w-md
            font-ui text-sm
            font-semibold leading-6
            text-walnut/65
            ${collectionPageLarge.text}
          `}
        >
          Ajoute quelques livres pour commencer à remplir
          cette collection.
        </p>

        <button
          type="button"
          onClick={onAddBooks}
          className="
            mt-6 inline-flex cursor-pointer
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
      </div>
    </section>
  )
}

export default CollectionPageEmptyState
