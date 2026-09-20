import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function CollectionDeleteModal({
  collection,
  isDeleting,
  onClose,
  onDelete,
}) {
  return (
    <Modal
      isOpen={Boolean(collection)}
      onClose={isDeleting ? () => {} : onClose}
      title="Supprimer la collection"
    >
      <div className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          Tu vas supprimer la collection{' '}
          <span className="font-bold text-darkwood">
            {collection?.name}
          </span>
          . Les livres qu'elle contient resteront dans Ma
          bibliothèque.
        </p>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Annuler
          </Button>

          <Button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="
              bg-dustyrose text-darkwood
              hover:bg-dustyrose/80
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollectionDeleteModal
