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

      {/* Header mobile + tablette portrait */}
      <div
        className="
          fixed left-0 top-0 z-20
          flex h-14 w-full
          items-center justify-between gap-3
          border-b border-walnut/20
          bg-darkwood bg-cover bg-center bg-no-repeat
          px-4 text-cream

          lg:hidden
        "
        style={{ backgroundImage: `url(${stripesBrown})` }}
      >
        <NavLink
          to="/"
          className="
            min-w-0 truncate
            font-heading
            text-xl
            font-bold
            text-cream
          "
        >
          Dear Pages
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              'shrink-0 rounded-md px-3 py-2 text-xs font-bold transition-colors',
              isActive
                ? 'bg-lime text-ink shadow-sm'
                : 'text-cream hover:text-lime',
            ].join(' ')
          }
        >
          Paramètres
        </NavLink>
      </div>

      {/* Page content */}
      <main
        className="
          w-full
          min-w-0
          overflow-x-hidden
          pt-14
          text-darkwood

          lg:ml-72
          lg:w-[calc(100%-18rem)]
          lg:p-4

          [@media(min-height:1000px)]:lg:ml-80
          [@media(min-height:1000px)]:lg:w-[calc(100%-20rem)]

          [@media(min-height:1200px)]:lg:ml-88
          [@media(min-height:1200px)]:lg:w-[calc(100%-22rem)]

          [@media(min-height:1400px)]:lg:ml-96
          [@media(min-height:1400px)]:lg:w-[calc(100%-24rem)]
        "
      >
        <div
          className="
            min-h-[calc(100vh-3.5rem)]
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