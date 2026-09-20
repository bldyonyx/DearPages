import { BookMinus } from 'lucide-react'

import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function CollectionBookRemoveModal({
  book,
  isRemoving,
  onClose,
  onRemove,
}) {
  const bookTitle = book?.title || 'Ce livre'

  return (
    <Modal
      isOpen={Boolean(book)}
      onClose={isRemoving ? () => {} : onClose}
      title="Retirer de la collection ?"
    >
      <div className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          <span className="font-bold text-darkwood">
            « {bookTitle} »
          </span>{' '}
          sera retiré de cette collection. Il restera dans Ma
          bibliothèque.
        </p>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isRemoving}
          >
            Annuler
          </Button>

          <Button
            type="button"
            onClick={onRemove}
            disabled={isRemoving}
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
            {isRemoving ? 'Retrait...' : 'Retirer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollectionBookRemoveModal
