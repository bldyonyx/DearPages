import BookPersonalSpace from './BookPersonalSpace.jsx'

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
      <section className="mt-14 w-full max-w-4xl min-w-0">
        <p className="font-handwritten text-lg text-olive">
          entre toi et les pages
        </p>

        <h2 className="font-heading text-3xl font-bold text-darkwood">
          Mon espace
        </h2>

        <div className="mt-3 h-px w-full bg-walnut/15" />

        <p className="mt-5 font-ui text-sm text-walnut">
          Chargement de ton espace...
        </p>
      </section>
    )
  }

  return (
    <section className="mt-14 w-full max-w-4xl min-w-0">
      <p className="font-handwritten text-lg text-olive">
        entre toi et les pages ♡
      </p>

      <h2 className="font-heading text-3xl font-bold text-darkwood">
        Mon espace
      </h2>

      <div className="mt-3 h-px w-full bg-walnut/15" />

      <p className="mt-5 font-ui text-sm text-walnut">
        Ajoute ce livre à ta bibliothèque pour garder tes
        pensées et tes notes.
      </p>
    </section>
  )
}

export default BookPersonalSection
