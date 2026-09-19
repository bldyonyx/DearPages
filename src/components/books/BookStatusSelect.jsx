import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={isOpen}
        className="
          flex w-full items-center justify-between
          rounded-2xl border border-walnut/15
          bg-cream/80 px-5 py-3.5
          font-ui text-sm text-darkwood
          shadow-sm outline-none
          transition
          hover:border-walnut/25
          hover:bg-cream
          focus:ring-2 focus:ring-lime/40
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >
        <span>
          {selectedOption?.label || 'Choisir un statut'}
        </span>

        <ChevronDown
          size={18}
          strokeWidth={1.7}
          className={`
            text-walnut transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {isOpen && (
        <div
          className="
            absolute left-0 top-[calc(100%+8px)]
            z-30 w-full overflow-hidden
            rounded-2xl border border-walnut/15
            bg-cream p-1.5 shadow-lg
          "
        >
          {options.map((option) => {
            const isSelected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  flex w-full items-center justify-between
                  rounded-xl px-4 py-3
                  text-left font-ui text-sm
                  transition
                  ${
                    isSelected
                      ? 'bg-lime/55 font-bold text-darkwood'
                      : 'text-walnut hover:bg-mintcream'
                  }
                `}
              >
                <span>{option.label}</span>

                {isSelected && (
                  <Check
                    size={17}
                    strokeWidth={1.8}
                    className="text-forest"
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