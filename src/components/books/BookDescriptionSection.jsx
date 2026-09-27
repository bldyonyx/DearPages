import { useBookDescriptionTranslation } from '../../hooks/useBookDescriptionTranslation.js'

function BookDescriptionSection({ book }) {
  const descriptionTranslation =
    useBookDescriptionTranslation(book)

  return (
    <section className="mt-14 w-full max-w-4xl min-w-0">
      <p className="font-handwritten text-lg text-olive">
        quelques mots sur ce livre ♡
      </p>

      <div
        className="
          flex flex-wrap items-baseline justify-between
          gap-x-4 gap-y-2
        "
      >
        <h2 className="font-heading text-3xl font-bold text-darkwood">
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
            className="
              font-ui text-xs font-semibold
              text-olive underline-offset-4
              transition
              hover:text-darkwood hover:underline
              disabled:cursor-not-allowed
              disabled:text-walnut/60
              disabled:no-underline
            "
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
          className="
            mt-5
            font-ui text-sm
            leading-7 text-ink
            wrap-break-word
          "
        >
          {descriptionTranslation.displayedDescription}
        </p>
      ) : (
        <p className="mt-5 font-ui text-sm text-walnut">
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
