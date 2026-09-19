import { Trash2, X } from 'lucide-react'

function RemoveBookModal({
  isOpen,
  isRemoving,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-darkwood/45
        px-5
        backdrop-blur-[2px]
      "
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-book-title"
        className="
          relative w-full max-w-md
          rounded-[28px]
          border border-walnut/10
          bg-cream
          p-7
          shadow-xl
          sm:p-8
        "
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isRemoving}
          aria-label="Fermer"
          className="
            absolute right-5 top-5
            flex h-9 w-9
            items-center justify-center
            rounded-full
            text-walnut
            transition
            hover:bg-parchment
            hover:text-darkwood
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <X size={18} strokeWidth={1.8} />
        </button>

        <div
          className="
            flex h-12 w-12
            items-center justify-center
            rounded-2xl
            bg-dustyrose/30
            text-walnut
          "
        >
          <Trash2 size={21} strokeWidth={1.7} />
        </div>

        <p className="mt-5 font-handwritten text-lg text-olive">
          juste pour etre sure ♡
        </p>

        <h2
          id="remove-book-title"
          className="
            mt-1
            font-heading
            text-3xl font-bold
            text-darkwood
          "
        >
          Retirer ce livre ?
        </h2>

        <p
          className="
            mt-3
            max-w-sm
            font-ui text-sm
            leading-6 text-walnut
          "
        >
          Ce livre sera retiré de ta bibliothèque.
          Tes notes, ta review et ta note étoilée seront
          également supprimées.
        </p>

        <div
          className="
            mt-7 flex
            flex-col-reverse gap-3
            sm:flex-row
            sm:justify-end
          "
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isRemoving}
            className="
              rounded-2xl
              border border-walnut/15
              bg-parchment/50
              px-5 py-3
              font-ui text-sm
              font-bold text-walnut
              transition
              hover:bg-parchment
              hover:text-darkwood
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isRemoving}
            className="
              inline-flex
              items-center justify-center
              gap-2 rounded-2xl
              bg-dustyrose
              px-5 py-3
              font-ui text-sm
              font-bold text-darkwood
              transition
              hover:brightness-95
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <Trash2 size={16} strokeWidth={1.8} />

            {isRemoving ? 'Suppression...' : 'Retirer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RemoveBookModal