import { validateBookMutationContext } from './bookMutationContext.js'
import { validateRtdbPathSegment } from './rtdbPathSegment.js'

/** All builders are pure and accept a validated frozen BookMutationContext.
 * Returned strings are relative to the RTDB root, without leading/trailing '/'.
 * Protocol/lifecycle paths intentionally do not include the generation counter.
 * These functions build paths only: they grant no access and check no lifecycle.
 */
export function bookProtocolPath(context) {
  const { uid } = validateBookMutationContext(context)
  return `users/${uid}/bookProtocol`
}

export function bookLifecyclePath(context) {
  const { uid, bookId } = validateBookMutationContext(context)
  return `users/${uid}/bookLifecycle/${bookId}`
}

export function bookDataPath(context) {
  const { uid, bookId, generation } = validateBookMutationContext(context)
  return `users/${uid}/bookData/${bookId}/${generation}`
}

export function bookLibraryPath(context) {
  return `${bookDataPath(context)}/library`
}

function childPath(context, branch, id) {
  const root = `${bookDataPath(context)}/${branch}`
  return id === undefined ? root : `${root}/${validateRtdbPathSegment(id)}`
}

/** Omit noteId to address the notes branch; supply it to address one note. */
export function bookNotesPath(context, noteId) {
  return childPath(context, 'bookNotes', noteId)
}

/** Omit ratingId to address the ratings branch; supply it for one rating. */
export function bookRatingsPath(context, ratingId) {
  return childPath(context, 'bookRatings', ratingId)
}

/** Omit collectionId for the branch; supply it for one collection membership. */
export function bookCollectionMembershipsPath(context, collectionId) {
  return childPath(context, 'collectionMemberships', collectionId)
}

/** Generation-scoped singleton markers, independent for each historical source. */
export function bookNotesLegacyPath(context) {
  return `${bookDataPath(context)}/bookNotesLegacy`
}

export function bookReviewsLegacyPath(context) {
  return `${bookDataPath(context)}/bookReviewsLegacy`
}

export function bookRatingsLegacyPath(context) {
  return `${bookDataPath(context)}/bookRatingsLegacy`
}

/** Catalog metadata is user-scoped, not tied to a book generation. Raw SDK path;
 * omit collectionId for the catalog. URL encoding belongs to the REST boundary.
 */
export function collectionCatalogPath(uid, collectionId) {
  const root = `users/${validateRtdbPathSegment(uid)}/collectionCatalog`
  return collectionId === undefined ? root : `${root}/${validateRtdbPathSegment(collectionId)}`
}
