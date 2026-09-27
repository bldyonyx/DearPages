function StatusBadge({ status, className = '' }) {
  const statuses = {
    'to-read': {
      label: 'À lire',
      className: 'bg-walnut/20 text-ink',
    },
    reading: {
      label: 'En cours',
      className: 'bg-lime text-ink',
    },
    finished: {
      label: 'Terminé',
      className: 'bg-sage text-mintcream',
    },
    abandoned: {
      label: 'Abandonné',
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
      {currentStatus.label}
    </span>
  )
}

export default StatusBadge
