import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateBookNote, updateBookReview } from '../../services/libraryService.js'
import { sanitizeNoteHtml } from '../../utils/noteHtmlSanitizer.js'
import Button from '../ui/Button.jsx'
import BookNotesEditor from './BookNotesEditor.jsx'
import BookNoteCard from './BookNoteCard.jsx'

export default function BookHistoricalTextEditor({ field, value, userId, bookId, onLibraryBookChange, expanded, onToggle }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const isNote = field === 'note'
  const title = t(isNote ? 'bookPage.notes.legacyTitle' : 'bookPage.personal.reviewTitle')
  const savedHtml = sanitizeNoteHtml(value)

  async function save(event) {
    event.preventDefault()
    if (saving || draft === null || draft === savedHtml) return
    setSaving(true)
    setError(false)
    try {
      const write = isNote ? updateBookNote : updateBookReview
      const html = sanitizeNoteHtml(draft)
      await write(userId, bookId, html)
      onLibraryBookChange((book) => book && { ...book, [field]: html, updatedAt: Date.now() })
      setDraft(null)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BookNoteCard
      note={{ title, contentHtml: savedHtml }}
      expanded={expanded}
      onToggle={onToggle}
      readOnly
      historicalActions={<Button type="button" variant="secondary" onClick={() => setDraft(savedHtml)}>{t('bookPage.notes.edit')}</Button>}
      editor={draft !== null ? (
        <form onSubmit={save} className="space-y-4">
          <BookNotesEditor label={title} value={draft} onChange={setDraft} disabled={saving} />
          {error && <p role="alert" className="text-sm text-red-700">{t(`bookPage.personal.${field}SaveError`)}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => { setError(false); setDraft(null) }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving || draft === savedHtml}>{t('common.save')}</Button>
          </div>
        </form>
      ) : undefined}
    />
  )
}
