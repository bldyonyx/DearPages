import useBookNotes from '../../hooks/useBookNotes.js'
import BookNotesView from './BookNotesView.jsx'

export default function BookNotesSection({ userId, bookId, historicalReview, personalBackend }) {
  const model = useBookNotes(userId, bookId, personalBackend)
  return <BookNotesView key={personalBackend ? `${userId}/${bookId}/${personalBackend.context.generation}` : undefined} model={model} historicalReview={historicalReview} />
}
