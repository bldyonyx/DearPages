import { BookMinus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '../../ui/Button.jsx'
import Modal from '../../ui/Modal.jsx'

function CollectionClearModal({
  isOpen,
  bookCount,
  isClearing,
  error,
  onClose,
  onClear,
}) {
  const { t } = useTranslation()

  return (
    <Modal
      isOpen={isOpen}
      onClose={isClearing ? () => {} : onClose}
      title={t('collectionPage.clearModal.title')}
    >
      <div className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          {t('collectionPage.clearModal.message', {
            count: bookCount,
          })}{' '}
          {t('collectionPage.clearModal.suffix')}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-dustyrose/30 bg-dustyrose/20 px-3 py-2 font-ui text-sm leading-6 text-darkwood"
          >
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
            {t('common.cancel')}
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
              ? t('collectionPage.clearModal.clearing')
              : t('collectionPage.clearModal.clear')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollectionClearModal
