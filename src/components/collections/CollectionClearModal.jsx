import { BookMinus } from 'lucide-react'

import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function getBookMessage(bookCount) {
  if (bookCount > 1) {
    return `Les ${bookCount} livres seront retirés de cette collection.`
  }

  return 'Le livre sera retiré de cette collection.'
}

function CollectionClearModal({
  isOpen,
  bookCount,
  isClearing,
  error,
  onClose,
  onClear,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isClearing ? () => {} : onClose}
      title="Vider cette collection ?"
    >
      <div className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          {getBookMessage(bookCount)} Ils resteront dans Ma
          bibliothèque.
        </p>

        {error && (
          <p className="rounded-xl border border-dustyrose/30 bg-dustyrose/20 px-3 py-2 font-ui text-sm leading-6 text-darkwood">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isClearing}
          >
            Annuler
          </Button>

          <Button
            type="button"
            onClick={onClear}
            disabled={isClearing}
            className="
              inline-flex items-center justify-center gap-2
              bg-dustyrose text-darkwood
              hover:bg-dustyrose/80
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <BookMinus
              className="h-4 w-4"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            {isClearing
              ? 'Vidage...'
              : 'Vider la collection'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollectionClearModal
