import { useTranslation } from 'react-i18next'

function StatusBadge({ status, className = '' }) {
  const { t } = useTranslation()
  const statuses = {
    'to-read': {
      className: 'bg-walnut/20 text-ink',
    },
    reading: {
      className: 'bg-lime text-ink',
    },
    finished: {
      className: 'bg-sage text-mintcream',
    },
    abandoned: {
      className: 'bg-dustyrose text-ink',
    },
  }

  const currentStatus = statuses[status]

  if (!currentStatus) {
    return null
  }

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-3 py-1
        font-ui text-xs font-bold
        ${currentStatus.className}
        ${className}
      `}
    >
      {t(`status.${status}`)}
    </span>
  )
}

export default StatusBadge
