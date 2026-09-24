import { Link } from 'react-router-dom'
import BookCard from '../books/BookCard'

function ForYouSection({
  books,
  preferences,
}) {
  if (books.length === 0) return null

  return (
    <section
      className="
        rounded-3xl
        border border-walnut/15
        bg-cream/65
        p-5
        md:p-6
        lg:p-8
      "
    >
      {/* Header */}
      <div
        className="
          flex flex-col gap-5
          md:flex-row md:items-start md:justify-between
        "
      >
        <div className="min-w-0">
            <p className="font-handwritten text-lg text-walnut">
            ton mood lecture ♡
            </p>

            <h2 className="mt-1 font-heading text-3xl font-bold text-darkwood">
            Peut-être pour toi
            </h2>

            <p className="mt-1 font-ui text-sm text-darkwood/60">
            Quelques livres qui pourraient te plaire.
            </p>

          {/* Préférences */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {preferences.map((preference) => (
              <span
                key={preference}
                className="
                  rounded-full
                  bg-mintcream
                  px-3 py-1.5
                  font-ui text-xs font-bold
                  text-darkwood/70
                "
              >
                {preference}
              </span>
            ))}

            <Link
              to="/settings"
              className="
                ml-1
                font-ui text-xs
                text-darkwood/45
                underline
                decoration-darkwood/20
                underline-offset-3
                transition-colors
                hover:text-darkwood
              "
            >
              Modifier mes goûts
            </Link>
          </div>
        </div>

        {/* Action principale */}
        <Link
          to="/discover?view=for-you"
          className="
            w-fit shrink-0 cursor-pointer
            font-ui text-xs font-bold
            text-darkwood
            transition-colors
            hover:text-walnut
            md:rounded-full
            md:border md:border-walnut/20
            md:bg-mintcream
            md:px-4 md:py-2
            md:hover:bg-lime
            md:hover:text-darkwood
          "
        >
          Voir toutes les suggestions →
        </Link>
      </div>

      {/* Livres recommandés */}
      <div
        className="
          mt-7 grid
          grid-cols-2
          gap-5
          md:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-5
          lg:gap-8
        "
      >
        {books.slice(0, 5).map((book, index) => (
          <div
            key={book.id}
            className={`
              mx-auto w-full max-w-40
              ${index >= 2 ? 'hidden md:block' : ''}
              ${index >= 3 ? 'md:hidden lg:block' : ''}
              ${index >= 4 ? 'lg:hidden xl:block' : ''}
            `}
          >
            <BookCard
              bookId={book.id}
              title={book.title}
              author={book.authors.join(', ')}
              cover={book.cover}
              isbn={book.isbn}
              source={book.source}
            />
          </div>
        ))}
      </div>

    </section>
  )
}

export default ForYouSection
