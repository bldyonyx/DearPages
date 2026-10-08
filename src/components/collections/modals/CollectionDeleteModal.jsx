import { useTranslation } from 'react-i18next'

import Button from '../../ui/Button.jsx'
import Modal from '../../ui/Modal.jsx'

function CollectionDeleteModal({
  collection,
  isDeleting,
  onClose,
  onDelete,
}) {
  const { t } = useTranslation()

  return (
    <Modal
      isOpen={Boolean(collection)}
      onClose={isDeleting ? () => {} : onClose}
      title={t('collectionsPage.deleteModal.title')}
    >
      <div className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          {t('collectionsPage.deleteModal.body', {
            name: collection?.name || '',
          })}
        </p>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('common.cancel')}
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
            {isDeleting ? t('common.deleting') : t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollectionDeleteModal
