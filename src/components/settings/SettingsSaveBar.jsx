function SettingsSaveBar({
  error,
  hasChanges,
  isDisabled,
  isSaving,
  onSave,
  successMessage,
}) {
  return (
    <section
      className="
        rounded-3xl border border-walnut/15
        bg-cream/90 p-5 shadow-sm
        sm:flex sm:items-center sm:justify-between
        sm:gap-5 sm:p-6
      "
    >
      <div className="min-w-0">
        <h2 className="font-heading text-2xl font-bold text-darkwood">
          Modifications
        </h2>

        <p className="mt-2 text-sm font-semibold text-darkwood/60">
          {hasChanges
            ? 'Des changements attendent leur sauvegarde.'
            : 'Tout est à jour.'}
        </p>

        <div className="mt-3 min-h-5">
          {successMessage && (
            <p className="text-sm font-bold text-forest">
              {successMessage}
            </p>
          )}

          {error && (
            <p className="text-sm font-bold text-walnut">
              {error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={isDisabled}
        className="
          mt-4 w-full rounded-2xl bg-lime px-5 py-3
          text-sm font-bold text-darkwood transition
          hover:-translate-y-0.5 hover:brightness-95
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-olive/35 disabled:cursor-not-allowed
          disabled:opacity-45 disabled:hover:translate-y-0
          sm:mt-0 sm:w-auto sm:shrink-0
        "
      >
        {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </section>
  )
}

export default SettingsSaveBar
