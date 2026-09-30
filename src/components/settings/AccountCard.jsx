import { settingsLarge } from './settingsResponsive.js'

function AccountCard({
  deleteError,
  error,
  isDeletingAccount,
  isLoggingOut,
  onDeleteRequest,
  onLogout,
}) {
  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10
        bg-cream/80 p-5 shadow-sm
        sm:p-6
        ${settingsLarge.card}
      `}
    >
      <div className="sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <p
            className={`
              font-handwritten text-xl text-walnut sm:text-2xl
              ${settingsLarge.handwritten}
            `}
          >
            ton compte
          </p>

          <h2
            className={`
              mt-1 font-heading text-3xl font-bold leading-tight text-darkwood
              ${settingsLarge.cardTitle}
            `}
          >
            Compte
          </h2>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="
            mt-5 w-full rounded-2xl border border-walnut/25
            bg-mintcream px-5 py-3 text-sm font-bold
            text-darkwood transition hover:border-walnut/45
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35 disabled:cursor-not-allowed
            disabled:opacity-50 sm:mt-0 sm:w-auto
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3.5
            [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
            [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
          "
        >
          {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </div>

      {error && (
        <p
          className={`
            mt-4 text-sm font-bold text-walnut
            ${settingsLarge.description}
          `}
        >
          {error}
        </p>
      )}

      <div className="mt-6 border-t border-walnut/10 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              className={`
                font-ui text-sm font-bold text-darkwood
                ${settingsLarge.description}
              `}
            >
              Supprimer mon compte
            </h3>

            <p
              className={`
                mt-1 max-w-xl font-ui text-sm leading-6 text-darkwood/60
                ${settingsLarge.description}
              `}
            >
              Supprime définitivement ton compte et toutes tes
              données Dear Pages.
            </p>
          </div>

          <button
            type="button"
            onClick={onDeleteRequest}
            disabled={isDeletingAccount}
            className="
              w-full rounded-2xl border border-dustyrose/60
              bg-dustyrose/35 px-5 py-3 font-ui text-sm
              font-bold text-darkwood transition
              hover:bg-dustyrose/55 focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-dustyrose/60
              disabled:cursor-not-allowed disabled:opacity-50
              sm:w-auto
              [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
              [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3.5
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
            "
          >
            Supprimer mon compte
          </button>
        </div>

        {deleteError && (
          <p
            className={`
              mt-4 text-sm font-bold text-walnut
              ${settingsLarge.description}
            `}
          >
            {deleteError}
          </p>
        )}
      </div>
    </section>
  )
}

export default AccountCard
