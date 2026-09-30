import { collectionsLarge } from './collectionsResponsive.js'

function CollectionsEmptyState({ onCreateCollection }) {
  return (
    <section
      className={`
        mt-8 max-w-2xl rounded-3xl
        border border-walnut/10
        bg-cream/75
        px-6 py-10
        shadow-sm
        sm:px-7 sm:py-12
        ${collectionsLarge.sectionGap}
        ${collectionsLarge.emptyPanel}
      `}
    >
      <p
        className={`
          font-heading text-2xl
          font-bold text-darkwood
          ${collectionsLarge.cardTitle}
        `}
      >
        Aucune collection pour le moment
      </p>

      <p
        className={`
          mt-2 max-w-md
          font-ui text-sm
          leading-6 text-walnut/70
          md:text-base
          ${collectionsLarge.description}
        `}
      >
        Crée une première collection pour regrouper tes
        envies, tes coups de coeur ou tes lectures à venir.
      </p>

      <button
        type="button"
        onClick={onCreateCollection}
        className="
          mt-6 cursor-pointer
          font-ui text-sm
          font-bold text-darkwood
          underline decoration-walnut/30
          underline-offset-4
          transition-opacity
          hover:opacity-70
        "
      >
        Créer ma première collection →
      </button>
    </section>
  )
}

export default CollectionsEmptyState
