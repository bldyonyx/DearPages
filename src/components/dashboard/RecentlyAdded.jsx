import { Link } from 'react-router-dom'
import BookCard from '../books/BookCard'
import { dashboardLarge } from './dashboardResponsive.js'

function RecentlyAdded({ books }) {
  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10 bg-cream/80 p-5
        md:p-6
        ${dashboardLarge.card}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className={`
              font-heading text-2xl font-bold text-darkwood
              ${dashboardLarge.title}
            `}
          >
            Ajoutés récemment
          </h2>

          <p
            className={`
              mt-1 font-ui text-sm text-darkwood/60
              ${dashboardLarge.description}
            `}
          >
            Les derniers livres ajoutés à ta bibliothèque.
          </p>
        </div>

        <Link
          to="/library"
          className="
            shrink-0 font-ui text-sm font-bold text-darkwood
            transition-opacity hover:opacity-60
            [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
            [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
          "
        >
          Voir tout →
        </Link>
      </div>

      {books.length === 0 ? (
        <p
          className={`
            mt-6 font-ui text-sm text-darkwood/60
            ${dashboardLarge.description}
          `}
        >
          Aucun livre ajouté pour le moment.
        </p>
      ) : (
        <div
          className={`
            hide-scrollbar mt-6 flex gap-6 overflow-x-auto pb-2
            lg:grid lg:grid-cols-5 lg:gap-8 lg:overflow-visible
            ${dashboardLarge.stackGap}
            ${dashboardLarge.cardInnerGap}
            [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
            [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-10
            [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
            [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-12
          `}
        >
          {books.map((book) => (
            <div
              key={book.googleBooksId}
              className={`
                w-36 shrink-0
                sm:w-40
                lg:mx-auto lg:w-full lg:max-w-40
                [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-48
                [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-56
              `}
            >
              <BookCard
                book={book}
                bookId={book.googleBooksId}
                title={book.title}
                author={book.authors?.join(', ')}
                cover={book.cover}
                isbn={book.isbn}
                source={book.source}
                titleClassName="
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-2xl
                "
                authorClassName="
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
                "
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default RecentlyAdded
