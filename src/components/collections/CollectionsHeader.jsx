import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import HeaderActions from '../layout/HeaderActions.jsx'
import { collectionsLarge } from './collectionsResponsive.js'

function CollectionsHeader({
  user,
  onCreateCollection,
}) {
  const { t } = useTranslation()

  return (
    <header className={`dp-page-enter py-4 ${collectionsLarge.headerTop}`}>
      <div
        className="
          flex flex-col gap-4
          md:flex-row md:items-center md:justify-between
        "
      >
        <div className="min-w-0">
          <h1
            className={`
              font-heading text-3xl font-bold text-darkwood md:text-4xl
              ${collectionsLarge.pageTitle}
            `}
          >
            {t('collectionsPage.title')}
          </h1>

          <p
            className={`
              mt-2 font-ui text-sm font-semibold text-darkwood/60
              md:text-base
              ${collectionsLarge.pageDescription}
            `}
          >
            {t('collectionsPage.subtitle')}
          </p>
        </div>

        <div
          className="
            flex min-w-0 flex-wrap
            items-center gap-3
            md:flex-1
            md:flex-nowrap
            md:justify-end
          "
        >
          <HeaderActions
            user={user}
            className="order-1 md:order-2 md:flex-none"
          />

          <div className="order-2 basis-full md:order-1 md:basis-auto">
            <button
              type="button"
              onClick={onCreateCollection}
              className="
                inline-flex h-10 w-full
                cursor-pointer
                shrink-0 items-center
                justify-center gap-2
                rounded-full border
                border-lime/70
                bg-lime/70 px-4
                font-bold text-darkwood
                shadow-sm
                hover:bg-lime
                md:h-11 md:w-auto md:px-5
              "
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
                strokeWidth={1.8}
              />

              <span>{t('collectionsPage.newCollection')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default CollectionsHeader
