/** Local civil date for a new draft, independent of the book's metadata. */
export function newBookNoteDraft() {
  return { title: '', contentHtml: '', date: todayCivilDate() }
}
import { todayCivilDate } from './civilDateUtils.js'

