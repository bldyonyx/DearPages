import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Pencil, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
import Button from '../ui/Button.jsx'
import IconButton from '../ui/IconButton.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'
import CivilDatePicker from '../ui/CivilDatePicker.jsx'
import { formatCivilDate, todayCivilDate } from '../../utils/civilDateUtils.js'
import { bookLarge } from './bookResponsive.js'

function Stars({ value, onChange, disabled }) {
  const { t } = useTranslation()
  if (!onChange) return <span role="img" aria-label={t('bookPage.personal.starLabel', { count: value })} className="inline-flex shrink-0 gap-0.5 sm:gap-1">
    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={30} strokeWidth={1.6} aria-hidden="true" fill={star <= value ? 'currentColor' : 'none'} className={`size-5 sm:size-7 ${star <= value ? 'text-dustyrose' : 'text-walnut/35'}`} />)}
  </span>
  return <div role="group" aria-label={t('bookPage.ratings.value')} className="flex flex-wrap gap-1">
    {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" disabled={disabled} aria-pressed={star === value}
      aria-label={t('bookPage.personal.starLabel', { count: star })} onClick={() => onChange(star)}
      className={`rounded-lg transition-colors duration-200 hover:text-dustyrose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/35 disabled:opacity-50 ${star <= value ? 'text-dustyrose' : 'text-walnut/35'}`}>
      <Star size={30} strokeWidth={1.6} aria-hidden="true" fill={star <= value ? 'currentColor' : 'none'} />
    </button>)}
  </div>
}

export default function BookRatingsView({ model }) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const [history, setHistory] = useState(false)
  const [draft, setDraft] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [conversion, setConversion] = useState(null)
  const { ratings, legacy, loading, loaded, loadError, busy, error, notice } = model
  const disabled = busy || loading || !loaded || loadError
  function row(rating) {
    const readOnly = rating.id === 'legacy-rating-v1' && legacy?.status === 'conflict'
    return <article key={rating.id} aria-label={t('bookPage.ratings.entry')} className="min-w-0 space-y-1 rounded-2xl border border-walnut/15 bg-cream/70 p-3">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <Stars value={rating.value} />
        {!readOnly && <div className="flex shrink-0">
          <IconButton label={t('bookPage.ratings.edit')} disabled={disabled} onClick={() => setDraft({ expected: { ...rating }, value: rating.value, date: rating.date, impression: rating.impression ?? '' })}><Pencil size={16} strokeWidth={1.7} aria-hidden="true" /></IconButton>
          <IconButton label={t('bookPage.ratings.delete')} disabled={disabled} onClick={() => setDeleting({ ...rating })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></IconButton>
        </div>}
      </div>
      {rating.impression?.trim() && <p className="break-words font-ui text-sm leading-5 text-walnut [overflow-wrap:anywhere]">{rating.impression}</p>}
      <time dateTime={rating.date || undefined} className="block font-ui text-xs text-walnut/65">{rating.date ? formatCivilDate(rating.date, i18n.resolvedLanguage || 'fr') : t('bookPage.date.unknown')}</time>
    </article>
  }
  return <section aria-labelledby={`${id}-title`} aria-busy={busy || loading || undefined} className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <h3 id={`${id}-title`} className={`font-heading text-2xl font-bold text-darkwood ${bookLarge.personalSubheading}`}>{t('bookPage.personal.ratingTitle')}</h3>
        <IconButton label={t('bookPage.ratings.refresh')} hint={t('bookPage.ratings.refreshHint')} disabled={busy || loading} onClick={model.reload}><RefreshCw size={16} strokeWidth={1.7} aria-hidden="true" /></IconButton>
      </div>
      <Button type="button" variant="ghost" size="compact" aria-label={t('bookPage.ratings.add')} disabled={disabled} onClick={() => setDraft({ id: model.allocate(), value: 0, date: todayCivilDate(), impression: '' })} className="ml-auto inline-flex items-center gap-2 rounded-xl"><Plus size={16} strokeWidth={1.7} aria-hidden="true" />{t('bookPage.ratings.addShort')}</Button>
    </div>
    {loading && <p role="status" className="font-ui text-sm text-walnut">{t('bookPage.ratings.loading')}</p>}
    {busy && <p role="status" className="font-ui text-sm text-walnut">{t('common.saving')}</p>}
    {loadError && <p role="alert" className="font-ui text-sm text-red-700">{t('bookPage.ratings.loadError')}</p>}
    {error && <p role="alert" className="font-ui text-sm text-red-700">{t(`bookPage.ratings.${error}`)}</p>}
    {notice && <p role="status" className="font-ui text-sm text-forest">{t(`bookPage.ratings.${notice}`)}</p>}
    {loaded && !loadError && !ratings.length && <p className="font-handwritten text-lg text-walnut/70">{t('bookPage.ratings.empty')}</p>}
    {ratings[0] && row(ratings[0])}
    {legacy?.status === 'unprocessed' && <aside className="space-y-3 rounded-2xl border border-walnut/15 bg-mintcream/35 p-4">
      <p className="font-ui text-sm leading-6 text-walnut">{t('bookPage.ratings.legacy')}</p>
      <p className="font-ui text-sm text-walnut">{t('bookPage.ratings.legacyValue', { value: legacy.value })} · {t('bookPage.date.unknown')}</p>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => setConversion(legacy.value)}>{t('bookPage.ratings.convert')}</Button>
    </aside>}
    {['conflict', 'invalid'].includes(legacy?.status) && <p role="alert" className="font-ui text-sm text-red-700">{t('bookPage.ratings.legacyConflict')}</p>}
    {ratings.length > 1 && (
      <Button type="button" variant="ghost" size="compact" aria-expanded={history} aria-controls={`${id}-history`} onClick={() => setHistory(open => !open)} className="mr-auto inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl">
        <span className="min-w-0 text-left">{t(history ? 'bookPage.ratings.hideHistory' : 'bookPage.ratings.history', { count: ratings.length - 1 })}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${history ? 'rotate-180' : ''}`} />
      </Button>
    )}
    {ratings.length > 1 && <div id={`${id}-history`} hidden={!history} className="space-y-3">{history && ratings.slice(1).map(row)}</div>}
    <Modal isOpen={Boolean(draft)} title={t(draft?.expected ? 'bookPage.ratings.edit' : 'bookPage.ratings.add')} onClose={() => { if (!busy) setDraft(null) }}>
      {draft && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault()
        const input = { value: draft.value, date: draft.date, impression: draft.impression }
        if (await (draft.expected ? model.save(draft.expected, input) : model.create(draft.id, input))) setDraft(null)
      }}>
        <Stars value={draft.value} onChange={value => setDraft(current => ({ ...current, value }))} disabled={disabled} />
        <div className="space-y-1">
          <Input id={`${id}-impression`} label={t('bookPage.ratings.impression')} type="text" maxLength={160} value={draft.impression} disabled={disabled}
            aria-describedby={`${id}-impression-hint`} onChange={event => setDraft(current => ({ ...current, impression: event.target.value }))} />
          <p id={`${id}-impression-hint`} className="text-right font-ui text-xs leading-5 text-walnut/65">{t('bookPage.ratings.impressionHint', { count: draft.impression.length })}</p>
        </div>
        <CivilDatePicker id={`${id}-date`} label={t('bookPage.ratings.date')} value={draft.date} disabled={disabled} onChange={date => setDraft(current => ({ ...current, date }))} />
        {!draft.date && <p className="font-ui text-xs text-walnut/65">{t('bookPage.date.unknown')}</p>}
        {error && <p role="alert" className="font-ui text-sm text-red-700">{t(`bookPage.ratings.${error}`)}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={disabled || !draft.value}>{t('common.save')}</Button>
        </div>
      </form>}
    </Modal>
    <Modal isOpen={Boolean(deleting)} title={t('bookPage.ratings.deleteTitle')} onClose={() => { if (!busy) setDeleting(null) }}>
      <p className="font-ui text-sm leading-6 text-walnut">{t('bookPage.ratings.deleteBody')}</p>
      {error && <p role="alert" className="mt-3 font-ui text-sm text-red-700">{t(`bookPage.ratings.${error}`)}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
        <Button type="button" disabled={disabled} onClick={async () => { if (await model.remove(deleting)) setDeleting(null) }}>{t('common.delete')}</Button>
      </div>
    </Modal>
    <Modal isOpen={conversion !== null} title={t('bookPage.ratings.convert')} onClose={() => { if (!busy) setConversion(null) }}>
      <p className="font-ui text-sm leading-6 text-walnut">{t('bookPage.ratings.convertBody')}</p>
      {error && <p role="alert" className="mt-3 font-ui text-sm text-red-700">{t(`bookPage.ratings.${error}`)}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setConversion(null)}>{t('common.cancel')}</Button>
        <Button type="button" disabled={disabled} onClick={async () => { if (await model.convert(conversion)) setConversion(null) }}>{t('bookPage.notes.confirmConversion')}</Button>
      </div>
    </Modal>
  </section>
}
