import { Link } from 'react-router-dom'

function LibraryEmptyState() {
  return (
    <div
      className="
        rounded-[28px]
        border border-walnut/10
        bg-cream/60
        px-6 py-16
        text-center
        shadow-sm
      "
    >
      <p
        className="
          font-heading text-2xl
          font-bold text-darkwood
        "
      >
        Ta bibliothèque est encore vide
      </p>

      <p
        className="
          mx-auto mt-2 max-w-md
          font-ui text-sm
          leading-6 text-walnut/70
        "
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
        "
      >
        Découvrir des livres
      </Link>
    </div>
  )
}

export default LibraryEmptyState