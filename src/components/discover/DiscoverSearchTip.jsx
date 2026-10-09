
import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { discoverLarge } from './discoverResponsive'

function DiscoverSearchTip({ className = '' }) {
  const { t } = useTranslation()

  return (
    <aside
      className={`
        flex items-start gap-3
        border-t border-darkwood/10
        pt-5 text-darkwood/60
        ${className}
      `}
    >
      <Lightbulb
        aria-hidden="true"
        strokeWidth={1.7}
        className="mt-0.5 size-4 shrink-0 text-olive"
      />

      <div className="min-w-0">
        <p className="font-ui text-sm font-semibold text-darkwood/75">
          {t('discoverPage.search.tipTitle')}
        </p>

        <p
          className={`
            mt-1 font-ui text-xs leading-relaxed
            sm:text-sm
            ${discoverLarge.description}
          `}
        >
          {t('discoverPage.search.tipBody')}
        </p>
      </div>
    </aside>
  )
}

export default DiscoverSearchTip
