import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const STATUS_STYLES = {
  'to-read': {
    trigger: `
      border-walnut/20
      bg-parchment/70
      hover:border-walnut/30
      hover:bg-parchment
    `,
    selected: 'bg-parchment text-darkwood',
    icon: 'text-walnut',
  },

  reading: {
    trigger: `
      border-lime/45
      bg-lime/25
      hover:border-lime/60
      hover:bg-lime/35
    `,
    selected: 'bg-lime/50 text-darkwood',
    icon: 'text-olive',
  },

  finished: {
    trigger: `
      border-olive/30
      bg-olive/15
      hover:border-olive/45
      hover:bg-olive/20
    `,
    selected: 'bg-olive/25 text-darkwood',
    icon: 'text-olive',
  },

  abandoned: {
    trigger: `
      border-dustyrose/40
      bg-dustyrose/20
      hover:border-dustyrose/55
      hover:bg-dustyrose/30
    `,
    selected: 'bg-dustyrose/35 text-darkwood',
    icon: 'text-dustyrose',
  },
}

function BookStatusSelect({
  value,
  options,
  disabled = false,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find(
    (option) => option.value === value
  )

  const selectedStyle = STATUS_STYLES[value]

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function handleSelect(status) {
    onChange(status)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0"
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={isOpen}
        className={`
          flex w-full items-center justify-between
          rounded-2xl border
          px-5 py-3.5
          font-ui text-sm text-darkwood
          shadow-[0_2px_8px_rgba(83,55,76,0.04)]
          outline-none
          transition-[border-color,background-color,box-shadow] duration-200 ease-out

          ${
            selectedStyle
              ? selectedStyle.trigger
              : `
                border-walnut/15
                bg-cream/80
                hover:border-walnut/25
                hover:bg-cream
              `
          }

          hover:shadow-[0_4px_12px_rgba(83,55,76,0.07)]

          focus:ring-2
          focus:ring-lime/40

          disabled:cursor-not-allowed
          disabled:opacity-60
        `}
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label || 'Choisir un statut'}
        </span>

        <ChevronDown
          size={18}
          strokeWidth={1.7}
          className={`
            transition-transform duration-200
            ${selectedStyle?.icon || 'text-walnut'}
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {isOpen && (
        <div
          className="
            dp-menu-enter
            absolute left-0 top-[calc(100%+8px)]
            z-30 w-full overflow-hidden
            rounded-2xl
            border border-walnut/15
            bg-cream
            p-1.5
            shadow-lg
          "
        >
          {options.map((option) => {
            const isSelected = option.value === value
            const optionStyle = STATUS_STYLES[option.value]

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  flex w-full items-center justify-between
                  rounded-xl
                  px-4 py-3
                  text-left
                  font-ui text-sm
                  transition-colors duration-150

                  ${
                    isSelected
                      ? optionStyle?.selected ||
                        'bg-lime/55 text-darkwood'
                      : 'text-walnut hover:bg-mintcream'
                  }

                  ${isSelected ? 'font-bold' : ''}
                `}
              >
                <span className="min-w-0 truncate">
                  {option.label}
                </span>

                {isSelected && (
                  <Check
                    size={17}
                    strokeWidth={1.8}
                    className={
                      optionStyle?.icon || 'text-forest'
                    }
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BookStatusSelect
