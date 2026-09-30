import { Pencil } from 'lucide-react'

import UserAvatar from '../ui/UserAvatar.jsx'
import { settingsLarge } from './settingsResponsive.js'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function ProfileCard({
  user,
  displayName,
  isEditing,
  isSaving,
  error,
  successMessage,
  onEdit,
  onCancel,
  onDisplayNameChange,
  onSave,
}) {
  const currentDisplayName = getDisplayName(user)

  function handleSubmit(event) {
    event.preventDefault()
    onSave()
  }

  return (
    <section
      className={`
        rounded-3xl border border-walnut/15
        bg-cream/90 p-5 shadow-sm
        sm:p-6
        ${settingsLarge.card}
      `}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar
          user={user}
          className="
            h-20 w-20
            sm:h-24 sm:w-24
          "
          avatarClassName="
            h-13 w-13
            sm:h-15 sm:w-15
          "
          initialClassName="
            h-13 w-13 text-3xl
            sm:h-15 sm:w-15 sm:text-4xl
          "
        />

        <div className="min-w-0 flex-1">
          <p
            className={`
              font-handwritten text-xl text-walnut sm:text-2xl
              ${settingsLarge.handwritten}
            `}
          >
            ton profil
          </p>

          {isEditing ? (
            <form
              onSubmit={handleSubmit}
              className="mt-2 max-w-xl"
            >
              <label
                htmlFor="settings-display-name"
                className="
                  font-ui text-xs font-bold
                  text-darkwood/55
                "
              >
                Nom affiché
              </label>

              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(event) =>
                  onDisplayNameChange(event.target.value)
                }
                maxLength={50}
                autoFocus
                disabled={isSaving}
                className="
                  mt-1.5 w-full
                  border-0 border-b border-walnut/25
                  bg-transparent
                  px-0 py-2
                  font-heading text-2xl font-bold
                  text-darkwood
                  outline-none
                  transition-colors
                  focus:border-walnut/60
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  sm:text-3xl
                "
              />

              {error && (
                <p
                  role="alert"
                  className="
                    mt-2 font-ui text-xs font-bold
                    text-walnut
                  "
                >
                  {error}
                </p>
              )}

              <div
                className="
                  mt-3 flex flex-wrap items-center gap-4
                "
              >
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving}
                  className="
                    cursor-pointer
                    font-ui text-xs font-bold
                    text-darkwood/55
                    transition-colors
                    hover:text-darkwood
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="
                    cursor-pointer
                    rounded-full
                    bg-dustyrose/55
                    px-4 py-2
                    font-ui text-xs font-bold
                    text-darkwood
                    transition
                    hover:-translate-y-0.5
                    hover:bg-dustyrose/75
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {isSaving
                    ? 'Enregistrement...'
                    : 'Enregistrer ♡'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h2
                className={`
                  min-w-0 wrap-break-word
                  font-heading text-3xl font-bold
                  leading-tight text-darkwood
                  ${settingsLarge.cardTitle}
                `}
              >
                {currentDisplayName}
              </h2>

              <button
                type="button"
                onClick={onEdit}
                aria-label="Modifier le nom affiché"
                title="Modifier le nom"
                className="
                  flex h-8 w-8 shrink-0
                  cursor-pointer items-center
                  justify-center
                  rounded-full
                  text-walnut/55
                  transition
                  hover:bg-walnut/10
                  hover:text-walnut
                "
              >
                <Pencil
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.8}
                />
              </button>
            </div>
          )}

          {user?.email && (
            <p
              className={`
                mt-2 wrap-break-word text-sm font-bold
                text-darkwood/60
                ${settingsLarge.smallText}
              `}
            >
              {user.email}
            </p>
          )}

          {!isEditing && successMessage && (
            <p
              className="
                mt-2 font-ui text-xs font-bold
                text-forest
              "
            >
              {successMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProfileCard