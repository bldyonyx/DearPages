import { useTranslation } from 'react-i18next'

function ErrorState({
  message,
  onRetry,
}) {
  const { t } = useTranslation()
  const errorMessage = message ?? t('common.error')

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <p className="font-ui text-sm text-darkwood/70">
        {errorMessage}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-ui text-sm font-bold text-darkwood underline underline-offset-4"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export default ErrorState
