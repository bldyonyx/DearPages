import { useTranslation } from 'react-i18next'

import { collectionsLarge } from './collectionsResponsive.js'

function CollectionsEmptyState({ onCreateCollection }) {
  const { t } = useTranslation()

  return (
    <section
      className={`
        dp-section-enter
        mt-8 max-w-2xl rounded-3xl
        border border-darkwood/10
        bg-cream/80
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
        {t('collectionsPage.empty.title')}
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
        {t('collectionsPage.empty.description')}
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
        {t('collectionsPage.empty.cta')}
      </button>
    </section>
  )
}

export default CollectionsEmptyState
