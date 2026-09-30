import BookPersonalSpace from './BookPersonalSpace.jsx'
import { bookLarge } from './bookResponsive.js'

function BookPersonalSection({
  bookId,
  isLibraryLoading,
  libraryBook,
  onLibraryBookChange,
  userId,
}) {
  if (libraryBook && userId) {
    return (
      <BookPersonalSpace
        userId={userId}
        bookId={bookId}
        libraryBook={libraryBook}
        onLibraryBookChange={onLibraryBookChange}
      />
    )
  }

  if (isLibraryLoading) {
    return (
      <section
        className={`
          mt-14 w-full min-w-0
          ${bookLarge.personalSection}
          ${bookLarge.sectionGap}
        `}
      >
        <p
          className={`
            font-handwritten text-lg text-olive
            ${bookLarge.handwritten}
          `}
        >
          entre toi et les pages
        </p>

        <h2
          className={`
            font-heading text-3xl font-bold text-darkwood
            ${bookLarge.sectionTitle}
          `}
        >
          Mon espace
        </h2>

        <div className="mt-3 h-px w-full bg-walnut/15" />

        <p
          role="status"
          aria-live="polite"
          className={`
            mt-5 font-ui text-sm text-walnut
            ${bookLarge.personalText}
          `}
        >
          Chargement de ton espace...
        </p>
      </section>
    )
  }

  return (
    <section
      className={`
        mt-14 w-full min-w-0
        ${bookLarge.personalSection}
        ${bookLarge.sectionGap}
      `}
    >
      <p
        className={`
          font-handwritten text-lg text-olive
          ${bookLarge.handwritten}
        `}
      >
        entre toi et les pages ♡
      </p>

      <h2
        className={`
          font-heading text-3xl font-bold text-darkwood
          ${bookLarge.sectionTitle}
        `}
      >
        Mon espace
      </h2>

      <div className="mt-3 h-px w-full bg-walnut/15" />

      <p
        className={`
          mt-5 font-ui text-sm text-walnut
          ${bookLarge.personalText}
        `}
      >
        Ajoute ce livre à ta bibliothèque pour garder tes
        pensées et tes notes.
      </p>
    </section>
  )
}

export default BookPersonalSection
