import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

const TEXT_SIZES = {
  small: {
    label: 'Petit',
    value: '2',
  },
  normal: {
    label: 'Normal',
    value: '3',
  },
  large: {
    label: 'Grand',
    value: '5',
  },
}

function BookNotesEditor({
  value = '',
  onChange,
  placeholder = 'Écris quelque chose sur ce livre...',
  disabled = false,
}) {
  const editorRef = useRef(null)
  const sizeMenuRef = useRef(null)

  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isSizeMenuOpen, setIsSizeMenuOpen] =
    useState(false)
  const [selectedSize, setSelectedSize] =
    useState('normal')

  useEffect(() => {
    const editor = editorRef.current

    if (!editor || editor.innerHTML === value) {
      return
    }

    editor.innerHTML = value
  }, [value])

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(event.target)
      ) {
        setIsSizeMenuOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [])

  function updateActiveFormats() {
    if (!editorRef.current) {
      return
    }

    const selection = window.getSelection()

    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editorRef.current.contains(selection.anchorNode)
    ) {
      return
    }

    setIsBold(document.queryCommandState('bold'))
    setIsItalic(document.queryCommandState('italic'))
  }

  function applyCommand(command, commandValue = null) {
    if (disabled) {
      return
    }

    editorRef.current?.focus()

    document.execCommand(
      command,
      false,
      commandValue
    )

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }

    updateActiveFormats()
  }

  function handleSizeChange(size) {
    setSelectedSize(size)
    setIsSizeMenuOpen(false)

    applyCommand(
      'fontSize',
      TEXT_SIZES[size].value
    )
  }

  function handleInput() {
    if (!editorRef.current) {
      return
    }

    onChange(editorRef.current.innerHTML)
    updateActiveFormats()
  }

  return (
    <div
      className="
        overflow-visible rounded-2xl
        border border-walnut/15
        bg-mintcream/40
      "
    >
      <div
        className="
          flex flex-wrap items-center gap-2
          rounded-t-2xl
          border-b border-walnut/15
          px-3 py-2
        "
      >
        <button
          type="button"
          onClick={() => applyCommand('bold')}
          disabled={disabled}
          aria-label="Gras"
          aria-pressed={isBold}
          className={`
            flex size-9 items-center justify-center
            rounded-lg font-ui font-bold
            transition
            disabled:opacity-40
            ${
              isBold
                ? 'bg-lime text-darkwood'
                : 'text-darkwood hover:bg-lime/40'
            }
          `}
        >
          B
        </button>

        <button
          type="button"
          onClick={() => applyCommand('italic')}
          disabled={disabled}
          aria-label="Italique"
          aria-pressed={isItalic}
          className={`
            flex size-9 items-center justify-center
            rounded-lg font-heading text-lg italic
            transition
            disabled:opacity-40
            ${
              isItalic
                ? 'bg-lime text-darkwood'
                : 'text-darkwood hover:bg-lime/40'
            }
          `}
        >
          I
        </button>

        <div
          ref={sizeMenuRef}
          className="relative min-w-0 sm:ml-1"
        >
          <button
            type="button"
            disabled={disabled}
            aria-label="Taille du texte"
            aria-haspopup="listbox"
            aria-expanded={isSizeMenuOpen}
            onClick={() =>
              setIsSizeMenuOpen((current) => !current)
            }
            className={`
              flex min-w-24 items-center
              justify-between gap-3
              rounded-xl px-3 py-2
              font-ui text-xs
              text-darkwood
              transition
              disabled:cursor-not-allowed
              disabled:opacity-40
              ${
                isSizeMenuOpen
                  ? 'bg-lime/50'
                  : 'hover:bg-lime/40'
              }
            `}
          >
            {TEXT_SIZES[selectedSize].label}

            <ChevronDown
              size={14}
              strokeWidth={1.8}
              className={`
                transition-transform duration-200
                ${
                  isSizeMenuOpen
                    ? 'rotate-180'
                    : ''
                }
              `}
            />
          </button>

          {isSizeMenuOpen && !disabled && (
            <div
              role="listbox"
              aria-label="Taille du texte"
              className="
                absolute right-0 top-full z-30
                mt-2 w-36
                overflow-hidden
                rounded-xl
                border border-walnut/15
                bg-cream
                p-1.5
                shadow-lg
              "
            >
              {Object.entries(TEXT_SIZES).map(
                ([size, option]) => {
                  const isSelected =
                    selectedSize === size

                  return (
                    <button
                      key={size}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        handleSizeChange(size)
                      }
                      className={`
                        flex w-full items-center
                        justify-between
                        rounded-lg
                        px-3 py-2
                        text-left
                        font-ui text-xs
                        transition
                        ${
                          isSelected
                            ? 'bg-lime/60 text-darkwood'
                            : 'text-walnut hover:bg-mintcream'
                        }
                      `}
                    >
                      {option.label}

                      {isSelected && (
                        <Check
                          size={14}
                          strokeWidth={2}
                          className="text-forest"
                        />
                      )}
                    </button>
                  )
                }
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        {!value && (
          <p
            className="
              pointer-events-none absolute
              left-4 top-4
              font-ui text-sm
              text-walnut/45
            "
          >
            {placeholder}
          </p>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          className="
            min-h-44
            rounded-b-2xl
            px-4 py-4
            font-ui text-sm
            leading-7 text-ink
            outline-none
          "
        />
      </div>
    </div>
  )
}

export default BookNotesEditor
