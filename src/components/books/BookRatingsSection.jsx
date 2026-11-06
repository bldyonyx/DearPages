import useBookRatings from '../../hooks/useBookRatings.js'
import BookRatingsView from './BookRatingsView.jsx'
export default function BookRatingsSection({ userId, bookId, legacyControl, personalBackend }) {
  const model = useBookRatings(userId, bookId, personalBackend)
  return model.enabled ? <BookRatingsView key={`${userId}/${bookId}/${personalBackend?.context.generation ?? 'legacy'}`} model={model} /> : legacyControl
}
