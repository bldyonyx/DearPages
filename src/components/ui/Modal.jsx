import { useId } from 'react'

function Modal({
  isOpen,
  onClose,
  title,
  children,
}) {
  const titleId = useId()

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-darkwood/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-walnut/20 bg-cream p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="font-heading text-xl font-bold text-darkwood"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer font-ui text-darkwood/60 hover:text-darkwood"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export default Modal
