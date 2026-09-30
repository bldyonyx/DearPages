function LoadingState({ message = 'Chargement...' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-10"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-walnut/20 border-t-darkwood"
        aria-hidden="true"
      />

      <p className="font-ui text-sm text-darkwood/60">
        {message}
      </p>
    </div>
  )
}

export default LoadingState
