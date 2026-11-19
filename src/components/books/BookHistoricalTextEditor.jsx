import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateBookNote, updateBookReview } from '../../services/libraryService.js'
import { sanitizeNoteHtml } from '../../utils/noteHtmlSanitizer.js'
import Button from '../ui/Button.jsx'
import BookNotesEditor from './BookNotesEditor.jsx'
import { bookLarge } from './bookResponsive.js'

export default function BookHistoricalTextEditor({ field, value, userId, bookId, onLibraryBookChange }) {
  const { t } = useTranslation()
  const titleId = useId()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const isNote = field === 'note'
  const title = t(isNote ? 'bookPage.personal.notesTitle' : 'bookPage.personal.reviewTitle')
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
    <section aria-labelledby={titleId} className="min-w-0 space-y-4">
      <h3 id={titleId} className={`font-heading text-2xl font-bold text-darkwood ${bookLarge.personalSubheading}`}>{title}</h3>
      {draft === null ? (
        <>
          {savedHtml && <div className="break-words font-ui text-walnut" dangerouslySetInnerHTML={{ __html: savedHtml }} />}
          <Button type="button" variant="secondary" onClick={() => setDraft(savedHtml)}>{t('bookPage.notes.edit')}</Button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <BookNotesEditor label={title} value={draft} onChange={setDraft} disabled={saving} />
          {error && <p role="alert">{t(`bookPage.personal.${field}SaveError`)}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => { setError(false); setDraft(null) }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving || draft === savedHtml}>{t('common.save')}</Button>
          </div>
        </form>
      )}
    </section>
  )
}
