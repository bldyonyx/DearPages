import CollectionBookCard from './cards/CollectionBookCard.jsx'
import { collectionPageLarge } from './collectionPageResponsive.js'

function getBookId(book) {
  return book.googleBooksId || book.id
}

function CollectionBooksGrid({
  books,
  removingBookId,
  onRemoveBook,
}) {
  return (
    <section
      className={`
        mt-8 rounded-[28px]
        border border-walnut/10
        bg-cream/65 p-5
        shadow-sm
        backdrop-blur-[2px]
        sm:p-7
        lg:p-8
        ${collectionPageLarge.sectionGap}
        ${collectionPageLarge.panel}
      `}
    >
      <div
        className={`
          grid grid-cols-2
          gap-x-5 gap-y-14
          sm:grid-cols-3
          md:grid-cols-4
          xl:grid-cols-5
          ${collectionPageLarge.gridGap}
          ${collectionPageLarge.bookGrid}
        `}
      >
        {books.map((book) => {
          const bookId = getBookId(book)

          return (
            <CollectionBookCard
              key={bookId}
              book={book}
              isRemoving={removingBookId === bookId}
              onRemove={onRemoveBook}
            />
          )
        })}
      </div>
    </section>
  )
}

export default CollectionBooksGrid
