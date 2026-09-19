import { Trash2 } from 'lucide-react'

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

  return (
    <section
      className="
        rounded-[28px]
        border border-walnut/10
        bg-cream/70
        px-7 py-8
        shadow-sm
        backdrop-blur-[2px]
        sm:px-9
        lg:px-11 lg:py-10
      "
    >
      <div
        className="
          mx-auto flex max-w-5xl
          flex-col gap-9
          md:flex-row
          md:items-center
          md:gap-12
        "
      >
        <div
          className="
            mx-auto w-full
            max-w-52.5 shrink-0
            md:mx-0
          "
        >
          {book.cover ? (
            <img
              src={book.cover}
              alt={`Couverture de ${book.title}`}
              className="
                aspect-2/3 w-full
                rounded-[18px]
                object-cover
                shadow-md
              "
            />
          ) : (
            <div
              className="
                flex aspect-2/3
                items-center justify-center
                rounded-[18px]
                bg-parchment
                p-6 text-center
                shadow-sm
              "
            >
              <span className="font-heading text-xl text-darkwood">
                {book.title}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
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
              font-handwritten
              text-xl text-walnut
              sm:text-2xl
            "
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
                  "
                >
                  {visibleCategories.join(' · ')}
                </p>
              )}
            </div>
          )}

          <div className="mt-10">
            {!libraryBook ? (
              <div className="max-w-sm">
                <button
                  type="button"
                  onClick={onAddToLibrary}
                  disabled={isSaving}
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
                  {isSaving
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
                    disabled={isSaving}
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
                      flex max-w-xl
                      flex-col gap-3
                      sm:flex-row
                      sm:items-center
                    "
                  >
                    <div className="min-w-0 flex-1">
                      <BookStatusSelect
                        value={libraryBook.status}
                        options={statusOptions}
                        disabled={isSaving}
                        onChange={onStatusChange}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={onRemoveFromLibrary}
                      disabled={isSaving}
                      className="
                        inline-flex shrink-0
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
                      "
                    >
                      <Trash2
                        size={17}
                        strokeWidth={1.7}
                      />

                      Retirer
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