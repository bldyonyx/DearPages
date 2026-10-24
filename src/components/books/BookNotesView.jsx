import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw } from 'lucide-react'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import Modal from '../ui/Modal.jsx'
import BookNoteCard from './BookNoteCard.jsx'
import BookNoteForm from './BookNoteForm.jsx'
import BookHistoricalNotes from './BookHistoricalNotes.jsx'
import { newBookNoteDraft } from '../../utils/bookNoteDraft.js'
import { bookLarge } from './bookResponsive.js'

// Pure UI: also used by the local preview without importing Firebase.
export default function BookNotesView({ model, historicalReview }) {
  const { t } = useTranslation()
  const titleId = useId()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [conversion, setConversion] = useState(null)
  function toggle(id) { setAdding(false); setOpenId((current) => current === id ? null : id) }
  const { notes, legacy, legacyReview, loading, loaded, loadError, pending, errors, enabled } = model
  const canWrite = enabled && loaded && !loading && !loadError
  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className={`font-heading text-2xl font-bold text-darkwood ${bookLarge.personalSubheading}`}>{t('bookPage.personal.notesTitle')}</h3>
        {enabled && <Button type="button" disabled={!canWrite || adding} onClick={() => {
          setDraft((current) => current || newBookNoteDraft()); setOpenId(null); setAdding(true)
        }} className={`inline-flex items-center gap-2 rounded-xl ${bookLarge.personalControl}`}><Plus size={16} aria-hidden="true" />{t('bookPage.notes.add')}</Button>}
      </div>
      {!enabled && <p className="font-ui text-sm leading-6 text-walnut">{t('bookPage.notes.emulatorOnly')}</p>}
      {loading && <p role="status" className="font-ui text-sm text-walnut">{t('bookPage.notes.loading')}</p>}
      {model.conversionStatus && <p role="status" className="font-ui text-sm leading-6 text-forest">{t(`bookPage.notes.${model.conversionStatus}`)}</p>}
      {loadError && <div role="alert" className="space-y-3 font-ui text-sm text-red-700">
        <p>{t('bookPage.notes.loadError')}</p>
        <Button type="button" variant="secondary" onClick={model.reload} disabled={loading}>{t('bookPage.notes.retry')}</Button>
      </div>}
      {adding && <div className="rounded-2xl border border-olive/20 bg-mintcream/35 p-4 sm:p-5">
        <h4 className="mb-4 font-heading text-xl font-bold text-darkwood">{t('bookPage.notes.newNote')}</h4>
        <BookNoteForm draft={draft} onChange={setDraft} pending={pending.new || !canWrite} error={errors.new}
          onCancel={() => setAdding(false)} onSave={async (input) => {
            if (await model.create(input)) { setAdding(false); setDraft(null) }
          }} />
      </div>}
      {loaded && !loadError && ['invalid', 'conflict'].includes(legacy?.status) && <p role="alert" className="rounded-2xl border border-walnut/15 bg-mintcream/35 p-4 font-ui text-sm leading-6 text-walnut">{t(`bookPage.notes.legacy${legacy.status === 'invalid' ? 'Invalid' : 'Conflict'}`)}</p>}
      {loaded && !loading && !loadError && !notes.length && ['empty', 'processed'].includes(legacy?.status) && !adding && <p className={`py-4 font-handwritten text-lg text-walnut/70 ${bookLarge.handwritten}`}>{t('bookPage.notes.empty')}</p>}
      <div className="space-y-3">{notes.map((note) => <BookNoteCard key={note.id} note={note} pending={pending[note.id] || loading || !canWrite}
        expanded={openId === `note:${note.id}`} onToggle={() => toggle(`note:${note.id}`)}
        isLegacyCopy={(note.id === 'legacy-note-v1' && legacy?.status === 'processed') || (note.id === 'legacy-review-v1' && legacyReview?.status === 'processed')}
        error={errors[note.id]} onPin={model.pin} onSave={model.save} onDelete={model.remove} readOnly={!enabled || (note.id === 'legacy-note-v1' && legacy?.status === 'conflict') || (note.id === 'legacy-review-v1' && legacyReview?.status === 'conflict')} />)}</div>
      <div className="space-y-3"><BookHistoricalNotes legacy={loaded && !loadError ? legacy : null}
        legacyReview={enabled ? (loaded && !loadError ? legacyReview : { status: 'unknown' }) : null}
        review={enabled ? undefined : historicalReview} openId={openId} onToggle={toggle} pending={pending} canConvert={canWrite}
        onConvertRequest={(kind, source) => setConversion({ kind, expectedVersion: source.sourceVersion })} /></div>
      <Modal isOpen={Boolean(conversion)} title={t('bookPage.notes.conversionTitle')}
        onClose={() => { if (!pending[`convert:${conversion?.kind}`]) setConversion(null) }}>
        <p className="font-ui text-sm leading-6 text-walnut">{t(conversion?.kind === 'review' ? 'bookPage.notes.conversionReviewBody' : 'bookPage.notes.conversionNoteBody')}</p>
        <p className="mt-3 font-ui text-xs leading-5 text-walnut/65">{t('bookPage.notes.conversionDateHint')}</p>
        {errors[`convert:${conversion?.kind}`] && <p role="alert" className="mt-3 font-ui text-sm text-red-700">{t(`bookPage.notes.${errors[`convert:${conversion.kind}`]}`)}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={pending[`convert:${conversion?.kind}`]} onClick={() => setConversion(null)}>{t('common.cancel')}</Button>
          <Button type="button" disabled={pending[`convert:${conversion?.kind}`] || !canWrite} onClick={async () => {
            const options = { expectedVersion: conversion.expectedVersion }
            if (conversion.kind === 'review') options.title = t('bookPage.notes.reviewInitialTitle')
            if (await model.convert(conversion.kind, options)) setConversion(null)
          }}>{pending[`convert:${conversion?.kind}`] ? t('bookPage.notes.converting') : t('bookPage.notes.confirmConversion')}</Button>
        </div>
      </Modal>
      {enabled && loaded && !loadError && <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="min-w-0 flex-1 font-ui text-xs leading-5 text-walnut/60">{t('bookPage.notes.draftHint')}</p>
        <IconButton label={t('bookPage.notes.refreshLabel')} hint={t('bookPage.notes.refreshHint')} onClick={model.reload} disabled={loading || Object.values(pending).some(Boolean)}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /></IconButton>
      </div>}
    </section>
  )
}
