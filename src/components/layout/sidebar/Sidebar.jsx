import stripesBrown from '../../../assets/textures/stripes-brown.jpg'
import { desktopNavigationItems } from '../navigation'

import SidebarBrand from './SidebarBrand'
import SidebarNavItem from './SidebarNavItem'
import SidebarNote from './SidebarNote'

function Sidebar() {
  const mainNavigationItems = desktopNavigationItems.filter(
    (item) => item.to !== '/settings',
  )

  const settingsItem = desktopNavigationItems.find(
    (item) => item.to === '/settings',
  )

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
      <SidebarBrand />

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
        {mainNavigationItems.map((item) => (
          <SidebarNavItem
            key={item.to}
            item={item}
          />
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-4 flex-1" />

        <SidebarNote />

        <div className="min-h-4 flex-1" />

        {settingsItem && (
          <nav
            aria-label="Paramètres"
            className="shrink-0 font-ui"
          >
            <SidebarNavItem item={settingsItem} />
          </nav>
        )}
      </div>
    </aside>
  )
}

export default Sidebar