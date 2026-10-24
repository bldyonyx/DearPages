import { useTranslation } from 'react-i18next'
import BookNoteCard from './BookNoteCard.jsx'
import { sanitizeNoteHtml } from '../../utils/noteHtmlSanitizer.js'
import Button from '../ui/Button.jsx'

/** Historical sources stay read-only; conversion requires a separate confirmation. */
export default function BookHistoricalNotes({ legacy, legacyReview, review, openId, onToggle, canConvert, onConvertRequest, pending = {} }) {
  const { t } = useTranslation()
  const hasReview = legacyReview ? legacyReview.status === 'unprocessed' : review !== undefined && review !== null && review !== ''
  const validReview = typeof review === 'string'
  const reviewHtml = legacyReview?.status === 'unprocessed' ? legacyReview.contentHtml : validReview ? sanitizeNoteHtml(review) : ''
  const safeReview = legacyReview ? legacyReview.status === 'unprocessed' : validReview
  const hasNote = legacy?.status === 'unprocessed'
  // Combine identical READ-ONLY sources for presentation only. Never infer a
  // migration relationship between a mutable user note and the review source.
  const combined = hasNote && hasReview && safeReview && sanitizeNoteHtml(legacy.contentHtml) === reviewHtml
  const entries = []
  if (hasNote) entries.push({ id: 'history:note', title: t(combined ? 'bookPage.notes.legacyCombinedTitle' : 'bookPage.notes.legacyTitle'), contentHtml: legacy.contentHtml, kinds: combined ? ['note', 'review'] : ['note'] })
  if (hasReview && safeReview && !combined) entries.push({ id: 'history:review', title: t('bookPage.notes.legacyReviewTitle'), contentHtml: reviewHtml, kinds: ['review'] })
  return <>
    {entries.map((entry) => <BookNoteCard key={entry.id} note={entry} readOnly expanded={openId === entry.id} onToggle={() => onToggle(entry.id)}
      historicalActions={canConvert && entry.kinds.map((kind) => <Button key={kind} type="button" variant="secondary" disabled={pending[`convert:${kind}`] || !(kind === 'note' ? legacy : legacyReview)?.sourceVersion}
        onClick={() => onConvertRequest(kind, kind === 'note' ? legacy : legacyReview)}>{t(kind === 'note' ? 'bookPage.notes.convertNote' : 'bookPage.notes.convertReview')}</Button>)}
      notice={t(entry.id === 'history:review' ? 'bookPage.notes.legacyReviewReadOnly' : 'bookPage.notes.legacyReadOnly')} />)}
    {((hasReview && !safeReview) || legacyReview?.status === 'invalid') && <p role="alert" className="font-ui text-sm text-walnut">{t('bookPage.notes.legacyReviewInvalid')}</p>}
    {legacyReview?.status === 'conflict' && <p role="alert" className="font-ui text-sm text-walnut">{t('bookPage.notes.legacyReviewConflict')}</p>}
  </>
}
