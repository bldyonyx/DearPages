
/**
 * Point d'entrée public des services de livres.
 *
 * Conserve les imports existants dans l'application
 * tout en répartissant la logique dans src/services/books/.
 */

export {
  searchBooks,
  getBookSuggestions,
} from './books/bookSearchService.js'

export {
  getBooksBySubject,
  getBooksBySubjectWindow,
} from './books/bookSubjectService.js'

export {
  getBookByIsbn,
  getBookById,
} from './books/googleBooksApi.js'
