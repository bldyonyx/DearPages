import { useTranslation } from 'react-i18next'
import BookNoteCard from './BookNoteCard.jsx'
import { sanitizeNoteHtml } from '../../utils/noteHtmlSanitizer.js'

/** Display-only compatibility: no conversion, persistent aliases or writes. */
export default function BookHistoricalNotes({ legacy, review, openId, onToggle }) {
  const { t } = useTranslation()
  const hasReview = review !== undefined && review !== null && review !== ''
  const validReview = typeof review === 'string'
  const reviewHtml = validReview ? sanitizeNoteHtml(review) : ''
  const hasNote = legacy?.status === 'unprocessed'
  // Combine identical READ-ONLY sources for presentation only. Never infer a
  // migration relationship between a mutable user note and the review source.
  const combined = hasNote && hasReview && validReview && sanitizeNoteHtml(legacy.contentHtml) === reviewHtml
  const entries = []
  if (hasNote) entries.push({ id: 'history:note', title: t(combined ? 'bookPage.notes.legacyCombinedTitle' : 'bookPage.notes.legacyTitle'), contentHtml: legacy.contentHtml })
  if (hasReview && validReview && !combined) entries.push({ id: 'history:review', title: t('bookPage.notes.legacyReviewTitle'), contentHtml: reviewHtml })
  return <>
    {entries.map((entry) => <BookNoteCard key={entry.id} note={entry} readOnly expanded={openId === entry.id} onToggle={() => onToggle(entry.id)}
      notice={t(entry.id === 'history:review' ? 'bookPage.notes.legacyReviewReadOnly' : 'bookPage.notes.legacyReadOnly')} />)}
    {hasReview && !validReview && <p role="alert" className="font-ui text-sm text-walnut">{t('bookPage.notes.legacyReviewInvalid')}</p>}
  </>
}
