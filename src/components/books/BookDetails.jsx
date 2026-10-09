import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GOOGLE_COVER_PAGE_WIDTH } from '../../services/books/coverUtils.js'
import BookCover from './BookCover.jsx'
import BookStatusSelect from './BookStatusSelect.jsx'
import { bookLarge } from './bookResponsive.js'

const CATEGORY_LABEL_KEYS = {
  fiction: 'bookPage.categories.fiction',
  nonfiction: 'bookPage.categories.nonfiction',
  'non-fiction': 'bookPage.categories.nonfiction',
  fantasy: 'bookPage.categories.fantasy',
  romance: 'bookPage.categories.romance',
  mystery: 'bookPage.categories.mystery',
  thriller: 'bookPage.categories.thriller',
  suspense: 'bookPage.categories.suspense',
  horror: 'bookPage.categories.horror',
  historical: 'bookPage.categories.historical',
  adventure: 'bookPage.categories.adventure',
  humorous: 'bookPage.categories.humorous',
  humor: 'bookPage.categories.humor',
  comedy: 'bookPage.categories.comedy',
  biography: 'bookPage.categories.biography',
  autobiography: 'bookPage.categories.autobiography',
  memoir: 'bookPage.categories.memoir',
  poetry: 'bookPage.categories.poetry',
  drama: 'bookPage.categories.drama',
  history: 'bookPage.categories.history',
  philosophy: 'bookPage.categories.philosophy',
  psychology: 'bookPage.categories.psychology',
  religion: 'bookPage.categories.religion',
  science: 'bookPage.categories.science',
  technology: 'bookPage.categories.technology',
  art: 'bookPage.categories.art',
  music: 'bookPage.categories.music',
  cooking: 'bookPage.categories.cooking',
  travel: 'bookPage.categories.travel',
  education: 'bookPage.categories.education',
  juvenile: 'bookPage.categories.juvenile',
  'young adult': 'bookPage.categories.young adult',
  comics: 'bookPage.categories.comics',
  'graphic novels': 'bookPage.categories.graphic novels',
  'media tie-in': 'bookPage.categories.media tie-in',
}

/**
 * Cleans and translates book categories for display.
 * The original book data is left unchanged.
 *
 * @param {string[]} categories - Raw book categories.
 * @returns {string[]} Clean categories displayed in Dear Pages.
 */
function formatCategories(categories = [], t) {
  const ignoredCategories = [
    'general',
    'literary collections',
  ]

  const formattedCategories = categories
    .flatMap((category) => category.split('/'))
    .map((category) => category.trim())
    .filter(Boolean)
    .filter(
      (category) =>
        !ignoredCategories.includes(category.toLowerCase())
    )
    .map((category) => {
      const normalizedCategory = category.toLowerCase()

      return (
        (CATEGORY_LABEL_KEYS[normalizedCategory]
          ? t(CATEGORY_LABEL_KEYS[normalizedCategory])
          : null) ||
        category
      )
    })
    .filter(
      (category, index, categoryList) =>
        categoryList.findIndex(
          (item) =>
            item.toLowerCase() === category.toLowerCase()
        ) === index
    )

  return formattedCategories.slice(0, 3)
}

/**
 * Returns a smaller responsive font size for unusually long
 * book titles so external metadata cannot overwhelm the layout.
 *
 * @param {string} title - Book title.
 * @returns {string} Tailwind classes for the title size.
 */
function getTitleSize(title = '') {
  if (title.length > 140) {
    return 'text-2xl sm:text-3xl'
  }

  if (title.length > 80) {
    return 'text-3xl sm:text-4xl'
  }

  return 'text-4xl sm:text-5xl'
}

function getLargeTitleSize(title = '') {
  if (title.length > 140) {
    return bookLarge.longTitle
  }

  if (title.length > 80) {
    return bookLarge.mediumTitle
  }

  return bookLarge.title
}

function BookDetails({
  book,
  libraryBook,
  shouldAnimate = true,
  isLibraryLoading = false,
  isSaving,
  libraryError,
  statusOptions,
  onAddToLibrary,
  onStatusChange,
  onRemoveFromLibrary,
}) {
  const { t } = useTranslation()
  const visibleCategories = formatCategories(
    book.categories,
    t
  )

  const titleSize = getTitleSize(book.title)
  const largeTitleSize = getLargeTitleSize(book.title)
  const isLibraryActionDisabled =
    isSaving || isLibraryLoading

  return (
    <section
      className={`
        ${shouldAnimate ? 'dp-section-enter' : ''}
        rounded-3xl
        border border-darkwood/10
        bg-cream/80
        px-5 py-6
        shadow-[0_8px_30px_rgba(83,55,76,0.07)]
        sm:px-7 sm:py-8
        md:px-8
        lg:px-11 lg:py-10
      `}
    >
      <div
        className={`
          flex w-full
          min-w-0 flex-col gap-7
          lg:flex-row
          lg:items-center
          lg:gap-10
          xl:gap-12
          ${bookLarge.detailsInner}
        `}
      >
        <div
          className={`
            mx-auto w-full
            max-w-44 shrink-0
            sm:max-w-52.5
            lg:mx-0
            ${bookLarge.cover}
          `}
        >
          <BookCover
            title={book.title}
            cover={book.cover}
            isbn={book.isbn}
            source={book.source}
            fallback="title"
            googleCoverWidth={GOOGLE_COVER_PAGE_WIDTH}
            coverLoading="eager"
            className="
              aspect-2/3 w-full
              overflow-hidden rounded-[18px]
              bg-parchment shadow-md
            "
            imageClassName="h-full w-full object-cover"
          />
        </div>

        <div className="w-full min-w-0 flex-1">
          <h1
            title={book.title}
            className={`
              max-w-3xl
              overflow-hidden
              font-heading
              font-bold
              leading-tight
              text-darkwood
              ${titleSize}
              ${largeTitleSize}
            `}
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 4,
            }}
          >
            {book.title}
          </h1>

          <p
            className={`
              mt-2
              overflow-hidden
              font-handwritten
              text-xl text-walnut
              sm:text-2xl
              ${bookLarge.author}
            `}
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {book.authors.join(', ')}
          </p>

          {(book.publishedDate ||
            visibleCategories.length > 0) && (
            <div className={`mt-5 ${bookLarge.metadata}`}>
              {book.publishedDate && (
                <p
                  className={`
                    font-ui text-sm
                    text-walnut/65
                    ${bookLarge.metadataText}
                  `}
                >
                  {book.publishedDate}
                </p>
              )}

              {visibleCategories.length > 0 && (
                <p
                  className={`
                    mt-1.5
                    font-ui text-sm
                    text-forest/80
                    wrap-break-word
                    ${bookLarge.metadataText}
                  `}
                >
                  {visibleCategories.join(' · ')}
                </p>
              )}
            </div>
          )}

          <div className={`mt-8 lg:mt-10 ${bookLarge.controls}`}>
            {!libraryBook ? (
              <div
                className={`
                  w-full max-w-sm
                  ${bookLarge.primaryControls}
                `}
              >
                <button
                  type="button"
                  onClick={onAddToLibrary}
                  disabled={isLibraryActionDisabled}
                  className="
                    w-full rounded-2xl
                    bg-lime
                    px-5 py-3.5
                    font-ui text-sm
                    font-bold text-darkwood
                    transition
                    hover:-translate-y-0.5
                    hover:brightness-95
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {isLibraryLoading
                    ? t('bookPage.details.loading')
                    : isSaving
                      ? t('bookPage.details.adding')
                      : t('bookPage.details.addToLibrary')}
                </button>

                <div className="mt-5">
                  <p
                    className={`
                      mb-2
                      font-ui text-xs
                      font-bold uppercase
                      tracking-[0.12em]
                      text-walnut
                      ${bookLarge.controlLabel}
                    `}
                  >
                    {t('bookPage.details.status')}
                  </p>

                  <BookStatusSelect
                    value=""
                    options={statusOptions}
                    disabled={isLibraryActionDisabled}
                    onChange={onStatusChange}
                  />
                </div>
              </div>
            ) : (
              <>
                <p
                  className={`
                    font-ui text-sm text-forest
                    ${bookLarge.libraryStatus}
                  `}
                >
                  {t('bookPage.details.inLibrary')}
                </p>

                <div className="mt-5">
                  <p
                    className={`
                      mb-2
                      font-ui text-xs
                      font-bold uppercase
                      tracking-[0.12em]
                      text-walnut
                      ${bookLarge.controlLabel}
                    `}
                  >
                    {t('bookPage.details.status')}
                  </p>

                  <div
                    className={`
                      flex w-full max-w-xl
                      flex-col gap-3
                      xl:flex-row
                      xl:items-center
                      ${bookLarge.libraryControls}
                    `}
                  >
                    <div className="w-full min-w-44 xl:min-w-48 xl:flex-1">
                      <BookStatusSelect
                        value={libraryBook.status}
                        options={statusOptions}
                        disabled={isLibraryActionDisabled}
                        onChange={onStatusChange}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={onRemoveFromLibrary}
                      disabled={isLibraryActionDisabled}
                      className="
                        inline-flex w-full shrink-0
                        items-center justify-center
                        gap-2 rounded-2xl
                        border border-dustyrose/60
                        bg-cream/70
                        px-4 py-3.5
                        font-ui text-sm
                        text-walnut
                        transition
                        hover:bg-dustyrose/25
                        hover:text-darkwood
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                        xl:w-auto
                      "
                    >
                      <Trash2
                        size={17}
                        strokeWidth={1.7}
                      />

                      {t('bookPage.details.removeFromLibrary')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {libraryError && (
              <p role="alert" className="mt-3 font-ui text-sm text-red-700">
                {libraryError}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default BookDetails
