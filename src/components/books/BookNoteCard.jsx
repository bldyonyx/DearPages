import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import BookNoteForm from './BookNoteForm.jsx'
import { sanitizeNoteHtml } from '../../utils/noteHtmlSanitizer.js'
import { bookLarge } from './bookResponsive.js'
import { formatCivilDate, isCivilDate } from '../../utils/civilDateUtils.js'

export default function BookNoteCard({ note, pending, error, onSave, onDelete, readOnly = false, isLegacyCopy = false, expanded, onToggle, notice, historicalActions }) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const label = isCivilDate(note.date) ? formatCivilDate(note.date, i18n?.resolvedLanguage || 'fr') : t('bookPage.date.unknown')
  return (
    <article aria-label={note.title || t('bookPage.notes.untitled')} aria-busy={pending || undefined} className="min-w-0 rounded-2xl border border-walnut/15 bg-cream/70">
      <h4>
        <button id={`${id}-trigger`} type="button" aria-expanded={Boolean(expanded)} aria-controls={`${id}-panel`} onClick={onToggle}
          aria-label={`${note.title || t('bookPage.notes.untitled')} · ${label}`}
          className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors duration-200 ease-out hover:bg-mintcream/55 active:bg-mintcream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/35 sm:px-5">
          <span className="min-w-0">
            {note.title && <span className="block break-words font-heading text-lg font-bold text-darkwood">{note.title}</span>}
            <time dateTime={isCivilDate(note.date) ? note.date : undefined} className={`font-ui text-xs font-normal text-walnut/65 ${bookLarge.personalSmallText}`}>{label}</time>
          </span>
          <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-olive transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </h4>
      {!expanded && pending && <p role="status" className="px-4 pb-3 font-ui text-xs text-walnut">{t('common.saving')}</p>}
      {!expanded && error && <p role="alert" className="px-4 pb-3 font-ui text-sm text-red-700">{t(`bookPage.notes.${error}`)}</p>}
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!expanded}>
      {expanded && <div className="dp-menu-enter px-4 pb-4 sm:px-5 sm:pb-5">
      {editing && !readOnly ? (
        <BookNoteForm draft={draft} onChange={setDraft} pending={pending} error={error}
          onCancel={() => setEditing(false)} onSave={async (input) => {
            if (await onSave(note.id, input)) { setEditing(false); setDraft(null) }
          }} />
      ) : (
        <>
          {notice && <p className="mb-3 font-ui text-xs leading-5 text-walnut/65">{notice}</p>}
          {isLegacyCopy && <p className="mt-2 font-ui text-xs leading-5 text-walnut/65">{t('bookPage.notes.migratedDate')}</p>}
          <div className={`dp-note-rich-text break-words font-ui text-sm leading-7 text-ink ${bookLarge.personalText}`}
            dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.contentHtml) }} />
          {!readOnly && <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => {
              setDraft((current) => current || { title: note.title || '', date: note.date, contentHtml: note.contentHtml })
              setEditing(true)
            }} className="inline-flex items-center gap-2 rounded-xl"><Pencil size={14} aria-hidden="true" />{t('bookPage.notes.edit')}</Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 rounded-xl"><Trash2 size={14} aria-hidden="true" />{t('common.delete')}</Button>
          </div>}
          {historicalActions && <div className="mt-4 flex flex-wrap justify-end gap-2">{historicalActions}</div>}
          {error && !confirming && <p role="alert" className="mt-3 font-ui text-sm text-red-700">{t(`bookPage.notes.${error}`)}</p>}
        </>
      )}
      </div>}
      </div>
      <Modal isOpen={confirming} onClose={() => { if (!pending) setConfirming(false) }} title={t('bookPage.notes.deleteTitle')}>
        <p className="font-ui text-sm leading-6 text-walnut">{t('bookPage.notes.deleteBody')}</p>
        {error && <p role="alert" className="mt-3 font-ui text-sm text-red-700">{t(`bookPage.notes.${error}`)}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
          <Button type="button" disabled={pending} onClick={async () => { if (await onDelete(note.id)) setConfirming(false) }}>
            {pending ? t('common.deleting') : t('common.delete')}
          </Button>
        </div>
      </Modal>
    </article>
  )
}
