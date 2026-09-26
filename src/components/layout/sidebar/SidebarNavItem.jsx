import { NavLink } from 'react-router-dom'
import {
  Compass,
  Heart,
  House,
  Library,
  Settings,
} from 'lucide-react'

const navigationIcons = {
  '/': House,
  '/discover': Compass,
  '/library': Library,
  '/collections': Heart,
  '/settings': Settings,
}

function SidebarNavItem({ item }) {
  const Icon = navigationIcons[item.to]

  const getNavLinkClassName = ({ isActive }) =>
    [
      'flex items-center rounded-md',
      'gap-2.5 px-3 py-2.5',
      'text-xs font-bold transition-all',

      'lg:gap-3 lg:px-4 lg:py-3 lg:text-sm',

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

  return (
    <NavLink
      end={item.to === '/'}
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

      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  )
}

export default SidebarNavItem