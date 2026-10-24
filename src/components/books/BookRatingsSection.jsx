import useBookRatings from '../../hooks/useBookRatings.js'
import BookRatingsView from './BookRatingsView.jsx'
export default function BookRatingsSection({ userId, bookId, legacyControl }) {
  const model = useBookRatings(userId, bookId)
  return model.enabled ? <BookRatingsView key={`${userId}/${bookId}`} model={model} /> : legacyControl
}
