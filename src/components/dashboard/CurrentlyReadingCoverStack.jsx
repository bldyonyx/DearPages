import { useTranslation } from 'react-i18next'

import BookCover from '../books/BookCover'
import { MAX_VISIBLE_COVERS } from './useCurrentlyReadingCarousel.js'
import { getBookRouteId } from '../../utils/bookPageUtils.js'

function DashboardCover({
  book,
  isSelected,
  prefersReducedMotion,
}) {
  return (
    <BookCover
      title={book.title}
      cover={book.cover}
      isbn={book.isbn}
      source={book.source}
      fallback="title"
      className={`
        aspect-2/3 w-32 overflow-hidden rounded-xl shadow-md
        transition-[transform,box-shadow,opacity] ease-out
        md:w-36 lg:w-40
        [@media_(min-width:2200px)_and_(min-height:1100px)]:w-48
        [@media_(min-width:2400px)_and_(min-height:1300px)]:w-56
        ${prefersReducedMotion ? 'duration-0' : 'duration-500'}
        ${isSelected ? 'scale-105 shadow-lg' : ''}
      `}
      imageClassName="h-full w-full rounded-[inherit] object-cover"
    />
  )
}

function CurrentlyReadingCoverStack({
  navigateToIndex,
  prefersReducedMotion,
  visibleBooks,
}) {
  const { t } = useTranslation()

  return (
    <div
      className="
        flex items-center justify-center px-4 pt-3
        sm:pt-2
        [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
        [@media_(min-width:2200px)_and_(min-height:1100px)]:pt-4
        [@media_(min-width:2400px)_and_(min-height:1300px)]:px-8
      "
    >
      {visibleBooks.map(({ book, bookIndex, stackIndex }) => {
        const isSelected = stackIndex === 0
        const zIndex = MAX_VISIBLE_COVERS - stackIndex
        const bookId = getBookRouteId(book)

        return (
          <button
            key={bookId}
            type="button"
            onClick={() => navigateToIndex(bookIndex)}
            className={`
              relative cursor-pointer
              transition-transform ease-out
              ${
                prefersReducedMotion
                  ? 'duration-0'
                  : 'duration-500'
              }
              ${
                stackIndex === 0
                  ? ''
                  : '-ml-20 lg:-ml-24 [@media_(min-width:2200px)_and_(min-height:1100px)]:-ml-24 [@media_(min-width:2400px)_and_(min-height:1300px)]:-ml-28'
              }
              ${
                isSelected
                  ? '-translate-y-3'
                  : 'hover:-translate-y-1'
              }
            `}
            style={{
              zIndex,
              transform: `translateY(${
                isSelected ? '-0.75rem' : '0'
              }) rotate(${
                stackIndex === 0
                  ? 0
                  : stackIndex === 1
                    ? -1.5
                    : 1.5
              }deg)`,
            }}
            aria-label={t(
              'dashboard.currentlyReading.showBook',
              { title: book.title }
            )}
            data-testid="current-reading-cover"
            data-active={isSelected ? 'true' : 'false'}
            data-book-id={bookId}
            data-stack-position={stackIndex}
          >
            <DashboardCover
              book={book}
              isSelected={isSelected}
              prefersReducedMotion={prefersReducedMotion}
            />
          </button>
        )
      })}
    </div>
  )
}

export default CurrentlyReadingCoverStack
