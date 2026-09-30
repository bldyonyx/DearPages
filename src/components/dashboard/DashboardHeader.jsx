import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Input from '../ui/Input'
import UserAvatar from '../ui/UserAvatar.jsx'
import { dashboardLarge } from './dashboardResponsive.js'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function DashboardHeader({ user }) {
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const navigate = useNavigate()
  const displayName = getDisplayName(user)

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedSearch = search.trim()

    if (!trimmedSearch) return

    navigate(`/discover?q=${encodeURIComponent(trimmedSearch)}`)
  }

  function handleClearSearch() {
    setSearch('')
  }

  return (
    <header className={`py-4 ${dashboardLarge.headerTop}`}>
      <div
        className="
          flex flex-col gap-4
          md:flex-row md:items-center md:justify-between
        "
      >
        {/* Bonjour */}
        <div className="min-w-0">
          <h1
            className="
              font-heading text-3xl font-bold text-darkwood
              md:text-4xl
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-5xl
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-6xl
            "
          >
            Bonjour, {displayName}
          </h1>

          <p
            className="
              mt-2 font-ui text-sm font-semibold text-darkwood/60
              md:text-base
              [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-3
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-lg
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-xl
            "
          >
            Voici un aperçu de tes lectures.
          </p>
        </div>

        {/* Actions */}
        <div className="flex min-w-0 items-center gap-3 md:flex-1 md:justify-end">
          {/* Recherche tablette + desktop */}
          <form
            onSubmit={handleSubmit}
            className="
              relative hidden min-w-0
              md:block md:w-56
              lg:w-64
              xl:w-80
              2xl:w-96
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-md
              [@media_(min-width:2400px)_and_(min-height:1300px)]:w-lg
            "
          >
            <Search
              aria-hidden="true"
              strokeWidth={1.8}
              className="
                pointer-events-none absolute
                left-5 top-1/2 z-10
                h-4 w-4
                -translate-y-1/2
                text-darkwood/50
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-5
                [@media_(min-width:2400px)_and_(min-height:1300px)]:h-6
                [@media_(min-width:2400px)_and_(min-height:1300px)]:w-6
              "
            />

            <Input
              id="dashboard-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un livre..."
              aria-label="Rechercher un livre"
              className="
                w-full rounded-full!
                py-3 pl-12 pr-12
                [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3.5
                [@media_(min-width:2200px)_and_(min-height:1100px)]:pl-14
                [@media_(min-width:2200px)_and_(min-height:1100px)]:pr-14
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
                [@media_(min-width:2400px)_and_(min-height:1300px)]:py-4
                [@media_(min-width:2400px)_and_(min-height:1300px)]:pl-16
                [@media_(min-width:2400px)_and_(min-height:1300px)]:pr-16
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
              "
            />

            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Effacer la recherche"
                className="
                  absolute right-4 top-1/2 z-10
                  flex h-7 w-7
                  -translate-y-1/2
                  cursor-pointer
                  items-center justify-center
                  rounded-full
                  text-darkwood/50
                  transition-colors
                  hover:text-darkwood
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:right-5
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:h-8
                  [@media_(min-width:2200px)_and_(min-height:1100px)]:w-8
                  [@media_(min-width:2400px)_and_(min-height:1300px)]:right-6
                "
              >
                <X
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="
                    h-4 w-4
                    [@media_(min-width:2200px)_and_(min-height:1100px)]:h-5
                    [@media_(min-width:2200px)_and_(min-height:1100px)]:w-5
                  "
                />
              </button>
            )}
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
              <X
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={1.8}
              />
            ) : (
              <Search
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={1.8}
              />
            )}
          </button>

          {/* Profil */}
          <Link
            to="/settings"
            aria-label="Ouvrir les paramètres du profil"
            className="
              shrink-0 cursor-pointer
              transition-transform
              hover:-translate-y-0.5
            "
          >
            <UserAvatar
              user={user}
              className="
                h-14 w-14
                md:h-16 md:w-16
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-18
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-18
                [@media_(min-width:2400px)_and_(min-height:1300px)]:h-20
                [@media_(min-width:2400px)_and_(min-height:1300px)]:w-20
              "
              avatarClassName="
                h-9 w-9
                md:h-10 md:w-10
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-12
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-12
                [@media_(min-width:2400px)_and_(min-height:1300px)]:h-14
                [@media_(min-width:2400px)_and_(min-height:1300px)]:w-14
              "
              initialClassName="
                h-9 w-9 text-base
                md:h-10 md:w-10 md:text-lg
                [@media_(min-width:2200px)_and_(min-height:1100px)]:h-12
                [@media_(min-width:2200px)_and_(min-height:1100px)]:w-12
                [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
                [@media_(min-width:2400px)_and_(min-height:1300px)]:h-14
                [@media_(min-width:2400px)_and_(min-height:1300px)]:w-14
                [@media_(min-width:2400px)_and_(min-height:1300px)]:text-2xl
              "
            />
          </Link>
        </div>
      </div>

      {/* Barre de recherche ouverte sur mobile */}
      {isSearchOpen && (
        <form
          onSubmit={handleSubmit}
          className="relative mt-4 w-full md:hidden"
        >
          <Search
            aria-hidden="true"
            strokeWidth={1.8}
            className="
              pointer-events-none absolute
              left-5 top-1/2 z-10
              h-4 w-4
              -translate-y-1/2
              text-darkwood/50
            "
          />

          <Input
            id="dashboard-search-mobile"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un livre..."
            aria-label="Rechercher un livre"
            autoFocus
            className="w-full rounded-full! py-3 pl-12 pr-12"
          />

          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Effacer la recherche"
              className="
                absolute right-4 top-1/2 z-10
                flex h-7 w-7
                -translate-y-1/2
                cursor-pointer
                items-center justify-center
                rounded-full
                text-darkwood/50
                transition-colors
                hover:text-darkwood
              "
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.8}
              />
            </button>
          )}
        </form>
      )}
    </header>
  )
}

export default DashboardHeader