import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Compass,
  Heart,
  House,
  Library,
  Settings,
} from 'lucide-react'

import stripesBrown from '../../assets/textures/stripes-brown.jpg'
import littleCats from '../../assets/images/little-cats.jpg'
import { desktopNavigationItems } from './navigation'

const navigationIcons = {
  '/': House,
  '/discover': Compass,
  '/library': Library,
  '/collections': Heart,
  '/settings': Settings,
}

function Sidebar() {
  const mainNavigationItems = desktopNavigationItems.filter(
    (item) => item.to !== '/settings',
  )

  const settingsItem = desktopNavigationItems.find(
    (item) => item.to === '/settings',
  )

  const getNavLinkClassName = ({ isActive }) =>
    [
      'flex items-center rounded-md',
      'gap-2.5 px-3 py-2.5',
      'text-xs font-bold transition-all',

      // Référence normale ~804–900px
      'lg:gap-3 lg:px-4 lg:py-3 lg:text-sm',

      // Grandes hauteurs
      '[@media(min-height:1000px)]:lg:gap-3.5',
      '[@media(min-height:1000px)]:lg:px-[18px]',
      '[@media(min-height:1000px)]:lg:py-[14px]',
      '[@media(min-height:1000px)]:lg:text-[15px]',

      '[@media(min-height:1200px)]:lg:gap-4',
      '[@media(min-height:1200px)]:lg:px-5',
      '[@media(min-height:1200px)]:lg:py-4',
      '[@media(min-height:1200px)]:lg:text-[16px]',

      '[@media(min-height:1400px)]:lg:gap-[18px]',
      '[@media(min-height:1400px)]:lg:px-[22px]',
      '[@media(min-height:1400px)]:lg:py-[18px]',
      '[@media(min-height:1400px)]:lg:text-[17px]',

      isActive
        ? 'bg-lime text-ink shadow-sm'
        : 'text-cream hover:translate-x-1 hover:text-lime',
    ].join(' ')

  const renderNavigationItem = (item) => {
    const Icon = navigationIcons[item.to]

    return (
      <NavLink
        end={item.to === '/'}
        key={item.to}
        to={item.to}
        className={getNavLinkClassName}
      >
        {Icon && (
          <Icon
            aria-hidden="true"
            className="
              size-4 shrink-0

              lg:size-4.5

              [@media(min-height:1000px)]:lg:size-5
              [@media(min-height:1200px)]:lg:size-[22px]
              [@media(min-height:1400px)]:lg:size-6
            "
            strokeWidth={1.8}
          />
        )}

        <span className="whitespace-nowrap">
          {item.label}
        </span>
      </NavLink>
    )
  }

  return (
    <aside
      className="
        fixed inset-y-0 left-0 z-40
        hidden h-screen
        flex-col

        border-r-2 border-cream/20

        bg-darkwood
        bg-cover
        bg-center
        bg-no-repeat

        text-cream

        lg:flex
        lg:w-72
        lg:px-5
        lg:py-6

        [@media(min-height:1000px)]:lg:w-80
        [@media(min-height:1000px)]:lg:py-7

        [@media(min-height:1200px)]:lg:w-[22rem]
        [@media(min-height:1200px)]:lg:px-6
        [@media(min-height:1200px)]:lg:py-8

        [@media(min-height:1400px)]:lg:w-96
        [@media(min-height:1400px)]:lg:px-7
        [@media(min-height:1400px)]:lg:py-9
      "
      style={{ backgroundImage: `url(${stripesBrown})` }}
    >
      {/* Branding */}
      <div
        className="
          lg:mb-12
          lg:px-4

          [@media(min-height:1000px)]:lg:mb-14
          [@media(min-height:1200px)]:lg:mb-16
          [@media(min-height:1400px)]:lg:mb-[72px]
        "
      >
        <NavLink
          to="/"
          aria-label="Dear Pages — Accueil"
          className="
            flex items-center
            text-cream

            lg:gap-3.5

            [@media(min-height:1000px)]:lg:gap-4
            [@media(min-height:1200px)]:lg:gap-[18px]
            [@media(min-height:1400px)]:lg:gap-5
          "
        >
          <BookOpen
            aria-hidden="true"
            className="
              shrink-0
              text-dustyrose

              lg:size-5.5

              [@media(min-height:1000px)]:lg:size-6
              [@media(min-height:1200px)]:lg:size-7
              [@media(min-height:1400px)]:lg:size-8
            "
            strokeWidth={1.8}
          />

          <span
            className="
              whitespace-nowrap
              font-heading
              font-semibold
              leading-none
              tracking-[0.01em]

              lg:text-[28px]

              [@media(min-height:1000px)]:lg:text-[31px]
              [@media(min-height:1200px)]:lg:text-[35px]
              [@media(min-height:1400px)]:lg:text-[38px]
            "
          >
            Dear Pages
          </span>
        </NavLink>
      </div>

      {/* Navigation principale */}
      <nav
        aria-label="Navigation principale"
        className="
          flex flex-col
          font-ui

          lg:gap-3

          [@media(min-height:1000px)]:lg:gap-4
          [@media(min-height:1200px)]:lg:gap-5
          [@media(min-height:1400px)]:lg:gap-6
        "
      >
        {mainNavigationItems.map(renderNavigationItem)}
      </nav>

      {/*
        Collections
            ↕
           note
            ↕
        Paramètres
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Collections → note */}
        <div className="min-h-4 flex-1" />

        {/* Note décorative */}
        <div className="flex shrink-0 justify-center">
          <div
            aria-hidden="true"
            className="
              relative
              -rotate-3
              overflow-hidden

              lg:h-[205px]
              lg:w-[155px]

              [@media(min-height:1000px)]:lg:h-[235px]
              [@media(min-height:1000px)]:lg:w-[178px]

              [@media(min-height:1200px)]:lg:h-[270px]
              [@media(min-height:1200px)]:lg:w-[204px]

              [@media(min-height:1400px)]:lg:h-[300px]
              [@media(min-height:1400px)]:lg:w-[227px]
            "
          >
            <img
              src={littleCats}
              alt=""
              className="
                absolute
                left-1/2
                top-0
                h-full
                max-w-none
                -translate-x-1/2

                lg:w-[250px]

                [@media(min-height:1000px)]:lg:w-[287px]
                [@media(min-height:1200px)]:lg:w-[330px]
                [@media(min-height:1400px)]:lg:w-[365px]
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                left-1/2
                top-[59%]
                w-[88%]

                -translate-x-1/2
                -translate-y-1/2

                text-center
                text-ink
              "
            >
              <p
                className="
                  font-handwritten
                  leading-[1.15]

                  lg:text-[19px]

                  [@media(min-height:1000px)]:lg:text-[22px]
                  [@media(min-height:1200px)]:lg:text-[25px]
                  [@media(min-height:1400px)]:lg:text-[28px]
                "
              >
                La lecture
                <br />
                agrandit l’âme.
              </p>

              <p
                className="
                  mt-2
                  font-handwritten

                  lg:text-[14px]

                  [@media(min-height:1000px)]:lg:mt-2.5
                  [@media(min-height:1000px)]:lg:text-[16px]

                  [@media(min-height:1200px)]:lg:mt-3
                  [@media(min-height:1200px)]:lg:text-[18px]

                  [@media(min-height:1400px)]:lg:text-[20px]
                "
              >
                — Voltaire
              </p>
            </div>
          </div>
        </div>

        {/* Note → Paramètres */}
        <div className="min-h-4 flex-1" />

        {/* Paramètres */}
        {settingsItem && (
          <nav
            aria-label="Paramètres"
            className="shrink-0 font-ui"
          >
            {renderNavigationItem(settingsItem)}
          </nav>
        )}
      </div>
    </aside>
  )
}

export default Sidebar