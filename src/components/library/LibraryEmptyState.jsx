import { Link } from 'react-router-dom'

import { libraryLarge } from './libraryResponsive.js'

function LibraryEmptyState() {
  return (
    <div
      className={`
        rounded-[28px]
        border border-walnut/10
        bg-cream/60
        px-6 py-16
        text-center
        shadow-sm
        ${libraryLarge.emptyPanel}
      `}
    >
      <p
        className={`
          font-heading text-2xl
          font-bold text-darkwood
          ${libraryLarge.emptyTitle}
        `}
      >
        Ta bibliothèque est encore vide
      </p>

      <p
        className={`
          mx-auto mt-2 max-w-md
          font-ui text-sm
          leading-6 text-walnut/70
          ${libraryLarge.description}
        `}
      >
        Découvre des livres et ajoute ceux que tu veux
        garder près de toi.
      </p>

      <Link
        to="/discover"
        className="
          mt-6 inline-flex
          rounded-2xl bg-lime
          px-5 py-3
          font-ui text-sm
          font-bold text-darkwood
          transition
          hover:brightness-95
          [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
          [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
        "
      >
        Découvrir des livres
      </Link>
    </div>
  )
}

export default LibraryEmptyState
