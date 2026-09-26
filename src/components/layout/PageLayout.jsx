import { BookOpen, Settings } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import greenBackground from '../../assets/textures/green-bg.jpg'
import stripesBrown from '../../assets/textures/stripes-brown.jpg'
import stripesBrownWide from '../../assets/textures/stripes-brown-wide.jpg'
import MobileNav from './MobileNav'
import Sidebar from './sidebar/Sidebar'

function PageLayout() {
  return (
    <div
      className="
        min-h-screen
        w-full
        overflow-x-hidden
        bg-darkwood
        bg-cover
        bg-center
        bg-no-repeat
        font-ui
        text-ink
      "
      style={{ backgroundImage: `url(${stripesBrownWide})` }}
    >
      <Sidebar />

      {/* Mobile + tablette header */}
      <header
        className="
          fixed left-0 top-0 z-20
          flex h-16 w-full
          items-center justify-between

          border-b border-walnut/20

          bg-darkwood
          bg-cover
          bg-center
          bg-no-repeat

          px-5
          text-cream

          lg:hidden
        "
        style={{ backgroundImage: `url(${stripesBrown})` }}
      >
        <NavLink
          to="/"
          aria-label="Dear Pages — Accueil"
          className="
            flex min-w-0
            items-center
            gap-2.5
            text-cream
          "
        >
          <BookOpen
            aria-hidden="true"
            className="
              size-5
              shrink-0
              text-dustyrose
            "
            strokeWidth={1.8}
          />

          <span
            className="
              truncate
              font-heading
              text-[22px]
              font-semibold
              leading-none
            "
          >
            Dear Pages
          </span>
        </NavLink>

        <NavLink
          to="/settings"
          aria-label="Paramètres"
          title="Paramètres"
          className={({ isActive }) =>
            [
              'flex size-10 shrink-0',
              'items-center justify-center',
              'rounded-full',
              'transition-colors',
              isActive
                ? 'bg-lime text-ink'
                : 'text-cream hover:bg-cream/10 hover:text-lime',
            ].join(' ')
          }
        >
          <Settings
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.8}
          />
        </NavLink>
      </header>

      {/* Page content */}
      <main
        className="
          w-full
          min-w-0
          overflow-x-hidden

          pt-16
          text-darkwood

          lg:ml-72
          lg:w-[calc(100%-18rem)]
          lg:p-4
          lg:pt-4
        "
      >
        <div
          className="
            min-h-[calc(100vh-4rem)]
            w-full
            min-w-0

            bg-mintcream
            bg-size-[100%_auto]
            bg-top
            bg-repeat-y

            pb-19

            lg:min-h-[calc(100vh-2rem)]
            lg:rounded-2xl
            lg:pb-0
          "
          style={{ backgroundImage: `url(${greenBackground})` }}
        >
          <Outlet />
        </div>
      </main>

      <MobileNav />
    </div>
  )
}

export default PageLayout