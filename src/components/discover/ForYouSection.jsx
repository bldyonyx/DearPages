import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import BookCard from '../books/BookCard'
import { discoverLarge } from './discoverResponsive'

function ForYouSection({
  books,
  preferences,
}) {
  if (books.length === 0) return null

  return (
    <section
      className={`
        rounded-3xl
        border border-walnut/15
        bg-cream/65
        p-5
        md:p-6
        lg:p-8
        ${discoverLarge.card}
      `}
    >
      <div
        className="
          flex flex-col gap-5
          md:flex-row md:items-start md:justify-between
        "
      >
        <div className="min-w-0">
          <p
            className={`
              font-handwritten text-lg text-walnut
              ${discoverLarge.handwritten}
            `}
          >
            ton mood lecture ♡
          </p>

          <h2
            className={`
              mt-1 font-heading text-3xl font-bold text-darkwood
              ${discoverLarge.featuredTitle}
            `}
          >
            Peut-être pour toi
          </h2>

          <p
            className={`
              mt-1 font-ui text-sm text-darkwood/60
              ${discoverLarge.description}
            `}
          >
            Quelques livres qui pourraient te plaire.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-5 [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-3">
            {preferences.map((preference) => (
              <span
                key={preference}
                className="
                  rounded-full
                  bg-mintcream
                  px-3 py-1.5
                  font-ui text-xs font-bold
                  text-darkwood/70
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:px-4
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:py-2
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
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
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
              "
            >
              Modifier mes goûts
            </Link>
          </div>
        </div>

        <Link
          to="/discover?view=for-you"
          className={`
            inline-flex w-fit shrink-0 cursor-pointer
            items-center gap-1.5
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
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-5
            [@media_(min-width:2200px)_and_(min-height:1100px)]:py-2.5
            ${discoverLarge.actionText}
          `}
        >
          <span>Voir toutes les suggestions</span>

          <ArrowRight
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      <div
        className={`
          mt-7 grid
          grid-cols-2
          gap-5
          md:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-5
          lg:gap-8
          ${discoverLarge.bookGrid}
          ${discoverLarge.stackGap}
          ${discoverLarge.gridGap}
        `}
      >
        {books.slice(0, 7).map((book, index) => (
          <div
            key={book.id}
            className={`
              mx-auto w-full max-w-40
              ${discoverLarge.bookWrap}
              ${discoverLarge.bookVisibility}
              ${index >= 2 ? 'hidden md:block' : ''}
              ${index >= 3 ? 'md:hidden lg:block' : ''}
              ${index >= 4 ? 'lg:hidden xl:block' : ''}
            `}
          >
            <BookCard
              book={book}
              bookId={book.id}
              title={book.title}
              author={book.authors.join(', ')}
              cover={book.cover}
              isbn={book.isbn}
              source={book.source}
              titleClassName={discoverLarge.bookTitle}
              authorClassName={discoverLarge.bookAuthor}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default ForYouSection