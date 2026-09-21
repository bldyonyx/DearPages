const FILTERS = [
  {
    value: 'all',
    label: 'Tous',
    accent: 'bg-darkwood',
    countStyle: 'bg-parchment text-darkwood',
  },
  {
    value: 'to-read',
    label: 'À lire',
    accent: 'bg-walnut/40',
    countStyle: 'bg-walnut/20 text-ink',
  },
  {
    value: 'reading',
    label: 'En cours',
    accent: 'bg-lime',
    countStyle: 'bg-lime text-ink',
  },
  {
    value: 'finished',
    label: 'Terminés',
    accent: 'bg-sage',
    countStyle: 'bg-sage text-mintcream',
  },
  {
    value: 'abandoned',
    label: 'Abandonnés',
    accent: 'bg-dustyrose',
    countStyle: 'bg-dustyrose text-ink',
  },
]

function LibraryFilters({
  activeFilter,
  onFilterChange,
  counts,
  totalBooks,
}) {
  return (
    <div>
      {/* Compteur mobile */}
      <p
        className="
          mb-3 text-right
          font-ui text-xs
          text-walnut/55
          md:hidden
        "
      >
        {totalBooks}{' '}
        {totalBooks === 1 ? 'livre' : 'livres'}
      </p>

      <div
        className="
          flex items-end
          border-b border-walnut/15
          md:justify-between
        "
      >
        {/* Filtres */}
        <div
          className="
            flex min-w-0 flex-1
            items-center gap-5
            overflow-x-auto
            px-1 pb-3

            scrollbar-thin
            [scrollbar-color:rgba(102,72,57,0.25)_transparent]

            [&::-webkit-scrollbar]:h-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-walnut/25

            md:flex-wrap
            md:gap-x-6
            md:gap-y-3
            md:overflow-visible
            md:pb-0

            md:scrollbar-none
            md:[&::-webkit-scrollbar]:hidden
          "
        >
          {FILTERS.map((filter) => {
            const isActive =
              activeFilter === filter.value

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() =>
                  onFilterChange(filter.value)
                }
                className={`
                  relative flex shrink-0
                  cursor-pointer
                  items-center gap-2
                  pb-3
                  font-ui text-sm
                  transition-colors
                  ${
                    isActive
                      ? 'font-bold text-darkwood'
                      : 'text-walnut/65 hover:text-darkwood'
                  }
                `}
              >
                <span>
                  {filter.label}
                </span>

                <span
                  className={`
                    flex min-w-6
                    items-center justify-center
                    rounded-full
                    px-2 py-1
                    text-xs
                    ${filter.countStyle}
                    ${
                      isActive
                        ? 'opacity-100'
                        : 'opacity-60'
                    }
                  `}
                >
                  {counts[filter.value] || 0}
                </span>

                {isActive && (
                  <span
                    className={`
                      absolute inset-x-0
                      -bottom-px h-0.5
                      rounded-full
                      ${filter.accent}
                    `}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Compteur tablette + desktop */}
        <p
          className="
            hidden shrink-0
            pb-3 pl-6
            font-ui text-sm
            text-walnut/55
            md:block
          "
        >
          {totalBooks}{' '}
          {totalBooks === 1 ? 'livre' : 'livres'}
        </p>
      </div>
    </div>
  )
}

export default LibraryFilters