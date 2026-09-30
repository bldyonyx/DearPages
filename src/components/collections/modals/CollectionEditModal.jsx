import { useEffect, useState } from 'react'

import {
  COLLECTION_ICONS,
  DEFAULT_COLLECTION_ICON,
} from '../../../data/collectionIcons.js'
import Button from '../../ui/Button.jsx'
import Input from '../../ui/Input.jsx'
import Modal from '../../ui/Modal.jsx'

function CollectionEditModal({
  collection,
  isSaving,
  onClose,
  onSave,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(DEFAULT_COLLECTION_ICON)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!collection) {
      return
    }

    setName(collection.name || '')
    setDescription(collection.description || '')
    setIcon(collection.icon || DEFAULT_COLLECTION_ICON)
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
      icon,
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

        <fieldset className="flex flex-col gap-2">
          <legend className="font-ui text-sm text-darkwood">
            Icône
          </legend>

          <div
            className="
              grid grid-cols-6 gap-2
              sm:grid-cols-12
            "
          >
            {COLLECTION_ICONS.map((option) => {
              const Icon = option.icon
              const isSelected = icon === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setIcon(option.id)}
                  disabled={isSaving}
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  title={option.label}
                  className={`
                    flex aspect-square w-full
                    cursor-pointer items-center
                    justify-center rounded-xl
                    border transition
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-darkwood/25
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    ${
                      isSelected
                        ? `
                          border-walnut/40
                          bg-lime/55
                          text-darkwood
                          shadow-sm
                        `
                        : `
                          border-walnut/15
                          bg-cream
                          text-walnut/70
                          hover:border-walnut/30
                          hover:bg-parchment/60
                          hover:text-darkwood
                        `
                    }
                  `}
                >
                  <Icon
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={1.8}
                  />
                </button>
              )
            })}
          </div>
        </fieldset>

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
