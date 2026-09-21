import { Link } from 'react-router-dom'
import BookCard from '../books/BookCard'

function RecentlyAdded({ books }) {
  return (
    <section className="rounded-3xl border border-darkwood/10 bg-cream/80 p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-darkwood">
            Ajoutés récemment
          </h2>

          <p className="mt-1 font-ui text-sm text-darkwood/60">
            Les derniers livres ajoutés à ta bibliothèque.
          </p>
        </div>

        <Link
          to="/library"
          className="shrink-0 font-ui text-sm font-bold text-darkwood transition-opacity hover:opacity-60"
        >
          Voir tout →
        </Link>
      </div>

      {books.length === 0 ? (
        <p className="mt-6 font-ui text-sm text-darkwood/60">
          Aucun livre ajouté pour le moment.
        </p>
      ) : (
        <div className="hide-scrollbar mt-6 flex gap-6 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:gap-8 lg:overflow-visible">
          {books.map((book) => (
            <div
              key={book.googleBooksId}
              className="w-36 shrink-0 sm:w-40 lg:mx-auto lg:w-full lg:max-w-40"
            >
              <BookCard
                bookId={book.googleBooksId}
                title={book.title}
                author={book.authors?.join(', ')}
                cover={book.cover}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default RecentlyAdded
