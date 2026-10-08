import {
  useCallback,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

import CurrentlyReadingBookInfo from './CurrentlyReadingBookInfo.jsx'
import CurrentlyReadingCoverStack from './CurrentlyReadingCoverStack.jsx'
import { dashboardLarge } from './dashboardResponsive.js'
import { useCurrentlyReadingCarousel } from './useCurrentlyReadingCarousel.js'

function CurrentlyReadingEmptyState() {
  const { t } = useTranslation()

  return (
    <section
      className={`
        flex h-full min-h-96 flex-col
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        p-5
        md:p-6
        [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-112
        [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-120
        ${dashboardLarge.card}
      `}
    >
      <div>
        <h2
          className={`
            font-heading text-2xl font-bold text-darkwood
            ${dashboardLarge.title}
          `}
        >
          {t('dashboard.currentlyReading.title')}
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          {t('dashboard.currentlyReading.emptySubtitle')}
        </p>
      </div>

      <div
        className="
          flex flex-1
          flex-col
          items-center
          justify-center
          px-4 py-8
          text-center
        "
      >
        <div
          className="
            flex h-14 w-14
            items-center justify-center
            rounded-full
            bg-mintcream/70
            text-olive
            [@media_(min-width:2200px)_and_(min-height:1100px)]:h-16
            [@media_(min-width:2200px)_and_(min-height:1100px)]:w-16
          "
        >
          <BookOpen
            aria-hidden="true"
            strokeWidth={1.5}
            className="
              h-6 w-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-7
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-7
            "
          />
        </div>

        <p
          className="
            mt-4 max-w-sm
            font-ui text-sm
            leading-relaxed
            text-darkwood/55
            [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-5
            [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
            [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
          "
        >
          {t('dashboard.currentlyReading.emptyMessage')}
        </p>

        <Link
          to="/discover"
          className="
            mt-5 inline-flex
            items-center justify-center
            rounded-full
            border border-olive/15
            bg-lime
            px-5 py-2.5
            font-ui text-xs
            font-bold text-darkwood
            shadow-[0_3px_10px_rgba(83,55,76,0.05)]
            transition-[transform,filter] duration-200 ease-out
            hover:-translate-y-0.5
            hover:brightness-95
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-olive/30
            [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3
            [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
            [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
          "
        >
          {t('dashboard.currentlyReading.findNext')}
        </Link>
      </div>
    </section>
  )
}

function CurrentlyReading({
  books,
  updatingBookId,
  onStatusChange,
}) {
  const { t } = useTranslation()
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusError, setStatusError] = useState('')

  const closeStatusControls = useCallback(() => {
    setIsStatusOpen(false)
    setStatusError('')
  }, [])

  const {
    boundedActiveIndex,
    currentBook,
    navigateBy,
    navigateToIndex,
    prefersReducedMotion,
    visibleBooks,
  } = useCurrentlyReadingCarousel(
    books,
    closeStatusControls
  )

  if (books.length === 0) {
    return <CurrentlyReadingEmptyState />
  }

  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10 bg-cream/80 p-5
        md:p-6
        [@media_(min-width:2200px)_and_(min-height:1100px)]:min-h-96
        [@media_(min-width:2400px)_and_(min-height:1300px)]:min-h-120
        ${dashboardLarge.card}
      `}
    >
      <div>
        <h2
          className={`
            font-heading text-2xl font-bold text-darkwood
            ${dashboardLarge.title}
          `}
        >
          {t('dashboard.currentlyReading.title')}
        </h2>

        <p
          className={`
            mt-1 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          {t('dashboard.currentlyReading.subtitle')}
        </p>
      </div>

      <div
        className={`
          mt-6 grid items-center gap-8
          sm:grid-cols-2
          ${dashboardLarge.stackGap}
          ${dashboardLarge.cardInnerGap}
          [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
          [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-10
          [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
          [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-12
        `}
      >
        <CurrentlyReadingCoverStack
          navigateToIndex={navigateToIndex}
          prefersReducedMotion={prefersReducedMotion}
          visibleBooks={visibleBooks}
        />

        <CurrentlyReadingBookInfo
          activeIndex={boundedActiveIndex}
          books={books}
          currentBook={currentBook}
          isStatusOpen={isStatusOpen}
          navigateBy={navigateBy}
          navigateToIndex={navigateToIndex}
          onStatusChange={onStatusChange}
          setIsStatusOpen={setIsStatusOpen}
          setStatusError={setStatusError}
          statusError={statusError}
          updatingBookId={updatingBookId}
        />
      </div>
    </section>
  )
}

export default CurrentlyReading
