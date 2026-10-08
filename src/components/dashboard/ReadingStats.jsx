import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { dashboardLarge } from './dashboardResponsive.js'

function ReadingStats({
  totalBooks,
  currentlyReading,
  favoriteGenre,
}) {
  const { t } = useTranslation()

  return (
    <section
      className={`
        w-full min-w-0 rounded-3xl border border-darkwood/10 bg-cream/80
        p-5
        md:p-6
        ${dashboardLarge.card}
      `}
    >
      {/* Titre */}
      <div>
        <h2
          className={`
            font-heading text-2xl font-bold text-darkwood
            ${dashboardLarge.title}
          `}
        >
          {t('dashboard.stats.title')}
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          {t('dashboard.stats.subtitle')}
        </p>
      </div>

      {/* Statistiques */}
      <div
        className={`
          mt-6
          md:grid md:grid-cols-3 md:items-stretch
          ${dashboardLarge.stackGap}
          [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
          [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
        `}
      >
        {/* Deux premières stats */}
        <div
          className="
            flex w-full min-w-0
            md:col-span-2
          "
        >
          {/* Livres */}
          <Link
            to="/library"
            aria-label={t('dashboard.stats.allLibraryAria')}
            className="
              group
              w-1/2 min-w-0
              rounded-2xl
              px-1 py-2
              text-center
              transition-colors duration-200
              hover:bg-mintcream/45
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-olive/25
              sm:px-3
              [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
            "
          >
            <p
              className="
                font-heading text-3xl
                font-bold text-darkwood
                transition-transform duration-200
                group-hover:-translate-y-0.5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-4xl
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-5xl
              "
            >
              {totalBooks}
            </p>

            <p
              className="
                mt-1 font-ui text-xs
                font-bold text-darkwood
                [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-2
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              "
            >
              {t('dashboard.stats.books')}
            </p>

            <p
              className="
                font-ui text-[0.6rem]
                leading-tight text-darkwood/50
                sm:text-xs
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              "
            >
              {t('dashboard.stats.inLibrary')}
            </p>
          </Link>

          {/* En cours */}
          <div
            className="
              w-1/2 min-w-0
              border-l border-darkwood/10
            "
          >
            <Link
              to="/library?status=reading"
              aria-label={t('dashboard.stats.currentlyReadingAria')}
              className="
                group
                block w-full
                rounded-2xl
                px-1 py-2
                text-center
                transition-colors duration-200
                hover:bg-mintcream/45
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-olive/25
                sm:px-3
                [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
              "
            >
              <p
                className="
                  font-heading text-3xl
                  font-bold text-darkwood
                  transition-transform duration-200
                  group-hover:-translate-y-0.5
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-4xl
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-5xl
                "
              >
                {currentlyReading}
              </p>

              <p
                className="
                  mt-1 font-ui text-xs
                  font-bold text-darkwood
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-2
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
                "
              >
                {t('dashboard.stats.inProgress')}
              </p>

              <p
                className="
                  font-ui text-[0.6rem]
                  leading-tight text-darkwood/50
                  sm:text-xs
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
                "
              >
                {t('dashboard.stats.currently')}
              </p>
            </Link>
          </div>
        </div>

        {/* Genre */}
        <div
          className="
            mt-5 flex w-full min-w-0
            flex-col items-center justify-center
            border-t border-darkwood/10
            px-1 pt-5 text-center
            md:mt-0
            md:border-l md:border-t-0
            md:px-3 md:pt-0
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
          "
        >
          <p
            className="
              max-w-full wrap-break-word
              font-heading text-xl
              font-bold text-darkwood
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-2xl
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-3xl
            "
          >
            {favoriteGenre}
          </p>

          <p
            className="
              mt-1 font-ui text-xs text-darkwood/50
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-2
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
            "
          >
            {t('dashboard.stats.favoriteGenre')}
          </p>
        </div>
      </div>
    </section>
  )
}

export default ReadingStats
