function ErrorState({
  message = 'Une erreur est survenue.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <p className="font-ui text-sm text-darkwood/70">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-ui text-sm font-bold text-darkwood underline underline-offset-4"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}

export default ErrorState
