import { settingsLarge } from './settingsResponsive.js'

function SettingsSaveBar({
  error,
  hasChanges,
  isDisabled,
  isSaving,
  onSave,
  successMessage,
}) {
  let statusMessage = 'Tout est à jour.'

  if (hasChanges) {
    statusMessage =
      'Des modifications sont prêtes à être enregistrées.'
  }

  if (successMessage) {
    statusMessage = successMessage
  }

  if (error) {
    statusMessage = error
  }

  if (isSaving) {
    statusMessage = 'Enregistrement...'
  }

  const isStatusError = Boolean(error)
  const isStatusSuccess = Boolean(successMessage) && !error

  return (
    <div
      className="
        border-t border-walnut/15 pt-5
        sm:flex sm:items-center sm:justify-between sm:gap-5
      "
    >
      <div className="min-w-0">
        <p
          role={isSaving ? 'status' : undefined}
          aria-live={isSaving ? 'polite' : undefined}
          className={[
            'text-sm font-bold',
            settingsLarge.description,
            isStatusError
              ? 'text-walnut'
              : isStatusSuccess
                ? 'text-forest'
                : 'text-darkwood/60',
          ].join(' ')}
        >
          {statusMessage}
        </p>
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
          [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
          [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3.5
          [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
          [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
        "
      >
        {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </div>
  )
}

export default SettingsSaveBar
