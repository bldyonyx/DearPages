import { useState } from 'react'

import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'

function CollectionCreateModal({
  isOpen,
  onClose,
  onCreate,
  isSubmitting,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')

  function resetForm() {
    setName('')
    setDescription('')
    setFormError('')
  }

  function handleClose() {
    if (isSubmitting) {
      return
    }

    resetForm()
    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedName = name.trim()

    if (!trimmedName) {
      setFormError('Donne un nom à ta collection.')
      return
    }

    setFormError('')

    const wasCreated = await onCreate({
      name: trimmedName,
      description: description.trim(),
    })

    if (wasCreated) {
      resetForm()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nouvelle collection"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="collection-name"
          label="Nom"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (formError) {
              setFormError('')
            }
          }}
          placeholder="Lectures d'automne"
          autoFocus
          disabled={isSubmitting}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="collection-description"
            className="font-ui text-sm text-darkwood"
          >
            Description
          </label>

          <textarea
            id="collection-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Une note douce pour retrouver cette pile plus tard..."
            rows={4}
            disabled={isSubmitting}
            className="
              resize-none rounded-lg
              border border-walnut/20
              bg-cream px-4 py-2
              font-ui text-sm text-darkwood
              outline-none transition-colors
              placeholder:text-darkwood/40
              focus:border-walnut/60
              disabled:cursor-not-allowed
              disabled:opacity-70
            "
          />
        </div>

        {formError && (
          <p className="font-ui text-sm font-bold text-walnut">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {isSubmitting
              ? 'Création...'
              : 'Créer la collection'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CollectionCreateModal
