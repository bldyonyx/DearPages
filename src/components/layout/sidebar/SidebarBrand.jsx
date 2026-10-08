import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

function SidebarBrand() {
  const { t } = useTranslation()

  return (
    <div
      className="
        mb-9 px-3
        lg:mb-12 lg:px-4

        [@media(min-height:1000px)]:lg:mb-14
        [@media(min-height:1200px)]:lg:mb-16
        [@media(min-height:1400px)]:lg:mb-18
      "
    >
      <NavLink
        to="/"
        aria-label={t('navigation.homeAria')}
        className="
          flex items-center gap-3 text-cream
          lg:gap-3.5

          [@media(min-height:1000px)]:lg:gap-4
          [@media(min-height:1200px)]:lg:gap-4.5
          [@media(min-height:1400px)]:lg:gap-5
        "
      >
        <BookOpen
          aria-hidden="true"
          className="
            size-4.5 shrink-0 text-dustyrose
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
            text-[22px]
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
  )
}

export default SidebarBrand
