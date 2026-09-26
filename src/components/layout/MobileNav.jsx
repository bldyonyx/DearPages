import { NavLink } from 'react-router-dom'
import {
  Compass,
  Heart,
  House,
  Library,
} from 'lucide-react'

import stripesBrown from '../../assets/textures/stripes-brown.jpg'
import { mainNavigationItems } from './navigation'

const mobileNavigation = {
  '/': {
    label: 'Accueil',
    icon: House,
  },
  '/discover': {
    label: 'Découvrir',
    icon: Compass,
  },
  '/library': {
    label: 'Bibliothèque',
    icon: Library,
  },
  '/collections': {
    label: 'Collections',
    icon: Heart,
  },
}

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
        {mainNavigationItems.map((item) => {
          const mobileItem = mobileNavigation[item.to]
          const Icon = mobileItem?.icon

          return (
            <NavLink
              end={item.to === '/'}
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) =>
                [
                  'flex min-w-0 flex-1 flex-col',
                  'items-center justify-center',
                  'gap-1 rounded-md',
                  'min-h-14 px-1 py-1.5',
                  'transition-colors',
                  'hover:bg-cream/10 hover:text-parchment',
                  isActive
                    ? 'bg-lime text-ink shadow-sm'
                    : 'text-cream',
                ].join(' ')
              }
            >
              {Icon && (
                <Icon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                  strokeWidth={1.8}
                />
              )}

              <span
                className="
                  max-w-full
                  truncate
                  text-center
                  text-[0.58rem]
                  font-bold
                  leading-none
                "
              >
                {mobileItem?.label ?? item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileNav