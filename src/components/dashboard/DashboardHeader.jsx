import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import flower from '../../assets/images/flower.png'
import Input from '../ui/Input'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function getAvatarInitial(displayName) {
  return displayName.trim().charAt(0).toUpperCase() || '?'
}

function DashboardHeader({ user }) {
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const navigate = useNavigate()
  const displayName = getDisplayName(user)
  const avatarInitial = getAvatarInitial(displayName)

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedSearch = search.trim()

    if (!trimmedSearch) return

    navigate(`/discover?q=${encodeURIComponent(trimmedSearch)}`)
  }

  return (
    <header className="py-4">
      <div
        className="
          flex flex-col gap-4
          md:flex-row md:items-center md:justify-between
        "
      >
        {/* Bonjour */}
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
            Bonjour, {displayName}
          </h1>

          <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
            Voici un aperçu de tes lectures.
          </p>
        </div>

        {/* Actions */}
        <div className="flex min-w-0 items-center gap-3 md:flex-1 md:justify-end">
          {/* Recherche tablette + desktop */}
            <form
              onSubmit={handleSubmit}
              className="
                hidden min-w-0
                md:block md:w-56
                lg:w-64
                xl:w-80
                2xl:w-96
              "
            >
            <Input
              id="dashboard-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un livre..."
              aria-label="Rechercher un livre"
              className="w-full rounded-full! px-6 py-3"
            />
          </form>

          {/* Recherche mobile */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((current) => !current)}
            aria-label={
              isSearchOpen
                ? 'Fermer la recherche'
                : 'Rechercher un livre'
            }
            aria-expanded={isSearchOpen}
            className="
              flex h-11 w-11 shrink-0 cursor-pointer
              items-center justify-center
              rounded-full border border-walnut/30
              bg-cream text-darkwood
              md:hidden
            "
          >
            {isSearchOpen ? (
              <span className="text-xl leading-none">×</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="
              flex h-11 w-11 shrink-0 cursor-pointer
              items-center justify-center
              rounded-full border border-walnut/30
              bg-cream text-xl text-darkwood
              transition-transform
              hover:-translate-y-0.5
              md:h-12 md:w-12
            "
          >
            ♡
          </button>

          {/* Profil */}
          <Link
            to="/settings"
            aria-label="Ouvrir les paramètres du profil"
            className="
              relative flex h-14 w-14 shrink-0 cursor-pointer
              items-center justify-center
              transition-transform
              hover:-translate-y-0.5
              md:h-16 md:w-16
            "
          >
            <img
              src={flower}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain"
            />

            <span
              className="
                relative z-10 flex h-9 w-9
                items-center justify-center
                rounded-full bg-cream
                font-heading text-base font-bold text-darkwood
            md:h-10 md:w-10 md:text-lg
          "
        >
          {avatarInitial}
        </span>
          </Link>
        </div>
      </div>

      {/* Barre de recherche ouverte sur mobile */}
      {isSearchOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 w-full md:hidden"
        >
          <Input
            id="dashboard-search-mobile"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un livre..."
            aria-label="Rechercher un livre"
            autoFocus
            className="w-full rounded-full! px-6 py-3"
          />
        </form>
      )}
    </header>
  )
}

export default DashboardHeader
