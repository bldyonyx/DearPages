import { NavLink } from 'react-router-dom'

import stripesBrown from '../../assets/textures/stripes-brown.jpg'
import { mainNavigationItems } from './navigation'

function MobileNav() {
  return (
    <nav
      aria-label="Navigation mobile principale"
      className="
        fixed bottom-0 left-0 z-20
        w-dvw
        overflow-hidden

        border-t border-walnut/20
        bg-darkwood
        bg-cover
        bg-center
        bg-no-repeat

        px-2 pb-3 pt-2

        font-ui
        text-cream

        lg:hidden
      "
      style={{ backgroundImage: `url(${stripesBrown})` }}
    >
      <div className="flex w-full gap-1">
        {mainNavigationItems.map((item) => (
          <NavLink
            end={item.to === '/'}
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex min-h-14 min-w-0 flex-1',
                'items-center justify-center',
                'rounded-md px-1',
                'text-center text-[0.62rem] font-bold leading-tight',
                'transition-colors',
                'hover:bg-cream/10 hover:text-parchment',
                isActive
                  ? 'bg-lime text-ink shadow-sm'
                  : 'text-cream',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default MobileNav