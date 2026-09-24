import { useState } from 'react'
import {
  Eye,
  EyeOff,
} from 'lucide-react'

import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

function AccountDeleteModal({
  isOpen,
  isDeleting,
  error,
  user,
  onClose,
  onDelete,
}) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const usesPasswordProvider = Boolean(
    user?.providerData?.some(
      (provider) => provider.providerId === 'password'
    )
  )

  function handleSubmit(event) {
    event.preventDefault()
    onDelete({ password })
  }

  function handleClose() {
    setPassword('')
    setShowPassword(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : handleClose}
      title="Supprimer ton compte ?"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="font-ui text-sm leading-6 text-darkwood/70">
          Cette action est définitive. Ta bibliothèque, tes
          collections, tes notes, tes avis et tes préférences seront
          supprimés.
        </p>

        {usesPasswordProvider && (
          <label className="block">
            <span className="font-ui text-xs font-bold text-darkwood/60">
              Confirme avec ton mot de passe
            </span>

            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                disabled={isDeleting}
                required
                className="
                  w-full rounded-2xl border border-walnut/20
                  bg-white/35 py-3 pl-4 pr-12 font-ui text-sm text-ink
                  outline-none transition placeholder:text-walnut/45
                  focus:border-olive/60 focus:ring-2 focus:ring-lime/40
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
                className="
                  absolute right-4 top-1/2
                  -translate-y-1/2 text-walnut
                  transition-opacity hover:opacity-60
                "
              >
                {showPassword ? (
                  <EyeOff size={20} strokeWidth={1.7} />
                ) : (
                  <Eye size={20} strokeWidth={1.7} />
                )}
              </button>
            </div>
          </label>
        )}

        {!usesPasswordProvider && (
          <p className="font-ui text-xs leading-5 text-darkwood/55">
            Une fenêtre Google peut s'ouvrir pour confirmer ton
            identité avant la suppression.
          </p>
        )}

        {error && (
          <p className="font-ui text-sm font-bold text-walnut">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Annuler
          </Button>

          <Button
            type="submit"
            variant="secondary"
            disabled={isDeleting}
            className="
              border-dustyrose/60 bg-dustyrose text-darkwood
              hover:border-dustyrose/70 hover:bg-[#c59f9e]
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {isDeleting
              ? 'Suppression...'
              : 'Supprimer définitivement'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AccountDeleteModal
