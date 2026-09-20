import { useEffect, useState } from 'react'

import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'

function CollectionEditModal({
  collection,
  isSaving,
  onClose,
  onSave,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!collection) {
      return
    }

    setName(collection.name || '')
    setDescription(collection.description || '')
    setFormError('')
  }, [collection])

  function handleClose() {
    if (isSaving) {
      return
    }

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

    await onSave({
      name: trimmedName,
      description: description.trim(),
    })
  }

  return (
    <Modal
      isOpen={Boolean(collection)}
      onClose={handleClose}
      title="Modifier la collection"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="edit-collection-name"
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
          disabled={isSaving}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edit-collection-description"
            className="font-ui text-sm text-darkwood"
          >
            Description
          </label>

          <textarea
            id="edit-collection-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Une note douce pour retrouver cette pile plus tard..."
            rows={4}
            disabled={isSaving}
            className="
              hide-scrollbar h-28 resize-none
              overflow-y-auto rounded-lg
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
            disabled={isSaving}
          >
            Annuler
          </Button>

          <Button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CollectionEditModal
