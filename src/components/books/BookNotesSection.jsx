import useBookNotes from '../../hooks/useBookNotes.js'
import BookNotesView from './BookNotesView.jsx'

export default function BookNotesSection({ userId, bookId, historicalReview }) {
  const model = useBookNotes(userId, bookId)
  return <BookNotesView model={model} historicalReview={historicalReview} />
}
