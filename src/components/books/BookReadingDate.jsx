import { useTranslation } from 'react-i18next'
import BookFinalStatusDate from './BookFinalStatusDate.jsx'

// Pure, shared by the real details card and the Firebase-free preview.
export default function BookReadingDate({ libraryBook, disabled = false, isSaving = false, onSave }) {
  const { t } = useTranslation()
  const status = libraryBook?.status
  if (!libraryBook || !['finished', 'abandoned'].includes(status)) return null
  const finished = status === 'finished'
  return <BookFinalStatusDate key={status} className="mt-3"
    title={t(finished ? 'bookPage.personal.finishedTitle' : 'bookPage.personal.abandonedTitle')}
    value={libraryBook[finished ? 'finishedAt' : 'abandonedAt']}
    disabled={disabled || !onSave} isSaving={isSaving} onSave={onSave} />
}
