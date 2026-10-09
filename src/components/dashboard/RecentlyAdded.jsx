import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import BookCard from '../books/BookCard'
import { dashboardLarge } from './dashboardResponsive.js'
import { getBookRouteId } from '../../utils/bookPageUtils.js'

function RecentlyAdded({ books }) {
  const { t } = useTranslation()

  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10 bg-cream/80 p-5
        md:p-6
        ${dashboardLarge.card}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className={`
              font-heading text-2xl font-bold text-darkwood
              ${dashboardLarge.title}
            `}
          >
            {t('dashboard.recentlyAdded.title')}
          </h2>

          <p
            className={`
              mt-1 font-ui text-sm text-darkwood/60
              ${dashboardLarge.description}
            `}
          >
            {t('dashboard.recentlyAdded.subtitle')}
          </p>
        </div>

        <Link
          to="/library"
          className="
            flex shrink-0 items-center gap-1.5
            font-ui text-sm font-bold text-darkwood
            transition-opacity hover:opacity-60
            [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
            [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
          "
        >
          <span>{t('dashboard.recentlyAdded.viewAll')}</span>

          <ArrowRight
            aria-hidden="true"
            className="
              h-4 w-4
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-5
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-5
              [@media_(min-width:2400px)_and_(min-height:1300px)]:h-6
              [@media_(min-width:2400px)_and_(min-height:1300px)]:w-6
            "
            strokeWidth={1.8}
          />
        </Link>
      </div>

      {books.length === 0 ? (
        <p
          className={`
            mt-6 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          {t('dashboard.recentlyAdded.empty')}
        </p>
      ) : (
        <div
          className={`
            hide-scrollbar mt-6 flex gap-6 overflow-x-auto pb-2
            lg:grid lg:grid-cols-5 lg:gap-8 lg:overflow-visible
            ${dashboardLarge.stackGap}
            ${dashboardLarge.cardInnerGap}
            [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
            [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-10
            [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
            [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-12
          `}
        >
          {books.map((book) => (
            <div
              key={getBookRouteId(book)}
              className="
                w-36 shrink-0
                sm:w-40
                lg:mx-auto lg:w-full lg:max-w-40
                [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-48
                [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-56
              "
            >
              <BookCard
                book={book}
                bookId={getBookRouteId(book)}
                title={book.title}
                author={book.authors?.join(', ')}
                cover={book.cover}
                isbn={book.isbn}
                source={book.source}
                titleClassName="
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-2xl
                "
                authorClassName="
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
                "
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default RecentlyAdded
