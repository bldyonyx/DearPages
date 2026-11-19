import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

export default function BookRatingStars({ value, onChange, disabled }) {
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
