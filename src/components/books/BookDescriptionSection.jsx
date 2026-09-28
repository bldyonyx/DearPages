import { useBookDescriptionTranslation } from '../../hooks/useBookDescriptionTranslation.js'
import { bookLarge } from './bookResponsive.js'

function BookDescriptionSection({ book }) {
  const descriptionTranslation =
    useBookDescriptionTranslation(book)

  return (
    <section
      className={`
        mt-14 w-full min-w-0
        ${bookLarge.section}
        ${bookLarge.sectionGap}
      `}
    >
      <p
        className={`
          font-handwritten text-lg text-olive
          ${bookLarge.handwritten}
        `}
      >
        quelques mots sur ce livre ♡
      </p>

      <div
        className="
          flex flex-wrap items-baseline justify-between
          gap-x-4 gap-y-2
        "
      >
        <h2
          className={`
            font-heading text-3xl font-bold text-darkwood
            ${bookLarge.sectionTitle}
          `}
        >
          À propos
        </h2>

        {descriptionTranslation.isTranslationAvailable && (
          <button
            type="button"
            onClick={
              descriptionTranslation.isShowingTranslation
                ? descriptionTranslation.showOriginalDescription
                : descriptionTranslation.translateDescription
            }
            disabled={descriptionTranslation.isTranslating}
            className={`
              font-ui text-xs font-semibold
              text-olive underline-offset-4
              transition
              hover:text-darkwood hover:underline
              disabled:cursor-not-allowed
              disabled:text-walnut/60
              disabled:no-underline
              ${bookLarge.personalSmallText}
            `}
          >
            {descriptionTranslation.isTranslating
              ? 'Traduction...'
              : descriptionTranslation.translationActionLabel}
          </button>
        )}
      </div>

      <div className="mt-3 h-px w-full bg-walnut/15" />

      {descriptionTranslation.hasDescription ? (
        <p
          className={`
            mt-5
            max-w-4xl
            font-ui text-sm
            leading-7 text-ink
            wrap-anywhere
            ${bookLarge.description}
          `}
        >
          {descriptionTranslation.displayedDescription}
        </p>
      ) : (
        <p
          className={`
            mt-5 font-ui text-sm text-walnut
            ${bookLarge.personalText}
          `}
        >
          Résumé indisponible.
        </p>
      )}

      {descriptionTranslation.translationError && (
        <p className="mt-3 font-ui text-xs text-red-700">
          {descriptionTranslation.translationError}
        </p>
      )}
    </section>
  )
}

export default BookDescriptionSection
