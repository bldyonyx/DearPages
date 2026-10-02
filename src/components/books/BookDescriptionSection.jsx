import { useBookDescriptionTranslation } from '../../hooks/useBookDescriptionTranslation.js'
import { bookLarge } from './bookResponsive.js'

function DescriptionLoadingState() {
  return (
    <div
      className="
        mt-5 max-w-4xl
        animate-pulse
      "
      role="status"
      aria-live="polite"
      aria-label="Chargement du résumé"
    >
      <div className="h-3.5 w-full rounded-full bg-walnut/10" />
      <div className="mt-3 h-3.5 w-[94%] rounded-full bg-walnut/10" />
      <div className="mt-3 h-3.5 w-[88%] rounded-full bg-walnut/10" />
      <div className="mt-3 h-3.5 w-[76%] rounded-full bg-walnut/10" />

      <span className="sr-only">
        Chargement du résumé...
      </span>
    </div>
  )
}

function BookDescriptionSection({
  book,
  isBookLoading = false,
}) {
  const descriptionTranslation =
    useBookDescriptionTranslation(book)

  const isDescriptionLoading =
    isBookLoading &&
    !descriptionTranslation.hasDescription

  return (
    <section
      className={`
        dp-section-enter
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

        {!isDescriptionLoading &&
          descriptionTranslation.isTranslationAvailable && (
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

      {isDescriptionLoading ? (
        <DescriptionLoadingState />
      ) : descriptionTranslation.hasDescription ? (
        <p
          className={`
            mt-5
            font-ui text-sm
            leading-7 text-ink
            wrap-anywhere
            transition-opacity duration-200
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
