import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import BookNotesEditor from './BookNotesEditor.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import CivilDatePicker from '../ui/CivilDatePicker.jsx'
import { bookLarge } from './bookResponsive.js'

export default function BookNoteForm({ draft, onChange, onSave, onCancel, pending, error }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Input label={t('bookPage.notes.optionalTitle')} id={`${id}-title`} type="text" maxLength={200} value={draft.title} disabled={pending}
          onChange={(event) => onChange({ ...draft, title: event.target.value })} className="min-w-0 w-full rounded-xl py-2.5" />
        <CivilDatePicker id={`${id}-date`} label={t('bookPage.notes.date')} value={draft.date} disabled={pending}
          onChange={(date) => onChange({ ...draft, date })} />
      </div>
      <BookNotesEditor value={draft.contentHtml} label={t('bookPage.notes.content')} disabled={pending}
        onChange={(contentHtml) => onChange({ ...draft, contentHtml })} />
      {error && <p role="alert" className="font-ui text-sm text-red-700">{t(`bookPage.notes.${error}`)}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={pending} className={`rounded-xl ${bookLarge.personalControl}`}>
          {pending ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  )
}
