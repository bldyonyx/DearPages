import CollectionBookCard from './cards/CollectionBookCard.jsx'

function CollectionBooksGrid({
  books,
  removingBookId,
  onRemoveBook,
}) {
  return (
    <section
      className="
        mt-8 rounded-[28px]
        border border-walnut/10
        bg-cream/65 p-5
        shadow-sm
        sm:p-7
      "
    >
      <div
        className="
          grid gap-x-6 gap-y-8
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
        "
      >
        {books.map((book) => {
          const bookId = book.googleBooksId || book.id

          return (
            <CollectionBookCard
              key={bookId}
              book={book}
              isRemoving={removingBookId === bookId}
              onRemove={() => onRemoveBook(book)}
            />
          )
        })}
      </div>
    </section>
  )
}

export default CollectionBooksGrid