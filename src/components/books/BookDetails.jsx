import { Trash2 } from 'lucide-react'

import BookCover from './BookCover.jsx'
import BookStatusSelect from './BookStatusSelect.jsx'

const CATEGORY_TRANSLATIONS = {
  fiction: 'Fiction',
  nonfiction: 'Non-fiction',
  'non-fiction': 'Non-fiction',
  fantasy: 'Fantasy',
  romance: 'Romance',
  mystery: 'Mystère',
  thriller: 'Thriller',
  suspense: 'Suspense',
  horror: 'Horreur',
  historical: 'Historique',
  adventure: 'Aventure',
  humorous: 'Humour',
  humor: 'Humour',
  comedy: 'Humour',
  biography: 'Biographie',
  autobiography: 'Autobiographie',
  memoir: 'Mémoires',
  poetry: 'Poésie',
  drama: 'Théâtre',
  history: 'Histoire',
  philosophy: 'Philosophie',
  psychology: 'Psychologie',
  religion: 'Religion',
  science: 'Science',
  technology: 'Technologie',
  art: 'Art',
  music: 'Musique',
  cooking: 'Cuisine',
  travel: 'Voyage',
  education: 'Éducation',
  juvenile: 'Jeunesse',
  'young adult': 'Young Adult',
  comics: 'BD',
  'graphic novels': 'Romans graphiques',
  'media tie-in': 'Adaptation',
}

/**
 * Cleans and translates book categories for display.
 * The original book data is left unchanged.
 *
 * @param {string[]} categories - Raw book categories.
 * @returns {string[]} Clean categories displayed in Dear Pages.
 */
function formatCategories(categories = []) {
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
        CATEGORY_TRANSLATIONS[normalizedCategory] ||
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

function BookDetails({
  book,
  libraryBook,
  isLibraryLoading = false,
  isSaving,
  libraryError,
  statusOptions,
  onAddToLibrary,
  onStatusChange,
  onRemoveFromLibrary,
}) {
  const visibleCategories = formatCategories(
    book.categories
  )

  const titleSize = getTitleSize(book.title)
  const isLibraryActionDisabled =
    isSaving || isLibraryLoading

  return (
    <section
      className="
        rounded-[28px]
        border border-walnut/10
        bg-cream/70
        px-5 py-6
        shadow-sm
        backdrop-blur-[2px]
        sm:px-7 sm:py-8
        md:px-8
        lg:px-11 lg:py-10
      "
    >
      <div
        className="
          mx-auto flex max-w-5xl
          min-w-0 flex-col gap-7
          lg:flex-row
          lg:items-center
          lg:gap-10
          xl:gap-12
        "
      >
        <div
          className="
            mx-auto w-full
            max-w-44 shrink-0
            sm:max-w-52.5
            lg:mx-0
          "
        >
          <BookCover
            title={book.title}
            cover={book.cover}
            isbn={book.isbn}
            source={book.source}
            fallback="title"
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
            className="
              mt-2
              overflow-hidden
              font-handwritten
              text-xl text-walnut
              sm:text-2xl
            "
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
            <div className="mt-5">
              {book.publishedDate && (
                <p
                  className="
                    font-ui text-sm
                    text-walnut/65
                  "
                >
                  {book.publishedDate}
                </p>
              )}

              {visibleCategories.length > 0 && (
                <p
                  className="
                    mt-1.5
                    font-ui text-sm
                    text-forest/80
                    break-words
                  "
                >
                  {visibleCategories.join(' · ')}
                </p>
              )}
            </div>
          )}

          <div className="mt-8 lg:mt-10">
            {!libraryBook ? (
              <div className="w-full max-w-sm">
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
                    ? 'Chargement...'
                    : isSaving
                    ? 'Ajout...'
                    : '+ Ajouter à ma bibliothèque'}
                </button>

                <div className="mt-5">
                  <p
                    className="
                      mb-2
                      font-ui text-xs
                      font-bold uppercase
                      tracking-[0.12em]
                      text-walnut
                    "
                  >
                    Statut
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
                <p className="font-ui text-sm text-forest">
                  Dans ma bibliothèque ♡
                </p>

                <div className="mt-5">
                  <p
                    className="
                      mb-2
                      font-ui text-xs
                      font-bold uppercase
                      tracking-[0.12em]
                      text-walnut
                    "
                  >
                    Statut
                  </p>

                  <div
                    className="
                      flex w-full max-w-xl
                      flex-col gap-3
                      xl:flex-row
                      xl:items-center
                    "
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

                      Retirer de ma bibliothèque
                    </button>
                  </div>
                </div>
              </>
            )}

            {libraryError && (
              <p className="mt-3 font-ui text-sm text-red-700">
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
