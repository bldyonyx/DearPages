import {
  get,
  push,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'

import { database } from './firebase.js'

/**
 * Creates the data stored for a user's collection.
 *
 * @param {Object} collection - Collection information.
 * @param {string} collection.name - Collection name.
 * @param {string} [collection.description] - Optional collection description.
 * @returns {Object} Collection data ready for Firebase.
 */
function createCollectionData(collection) {
  const now = Date.now()

  return {
    name: collection.name.trim(),
    description: collection.description?.trim() || '',
    createdAt: now,
    updatedAt: now,
    books: {},
  }
}

/**
 * Gets all collections stored for a user.
 * Collections are returned from newest to oldest update.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @returns {Promise<Object[]>} User's stored collections.
 */
export async function getUserCollections(userId) {
  if (!userId) {
    return []
  }

  const collectionsRef = ref(
    database,
    `users/${userId}/collections`
  )

  const snapshot = await get(collectionsRef)

  if (!snapshot.exists()) {
    return []
  }

  return Object.entries(snapshot.val())
    .map(([collectionId, collection]) => ({
      ...collection,
      id: collectionId,
      books: collection.books || {},
    }))
    .sort(
      (firstCollection, secondCollection) =>
        (secondCollection.updatedAt ||
          secondCollection.createdAt ||
          0) -
        (firstCollection.updatedAt ||
          firstCollection.createdAt ||
          0)
    )
}

/**
 * Gets a collection from a user's private collections.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} collectionId - Collection ID.
 * @returns {Promise<Object|null>} Stored collection or null.
 */
export async function getUserCollection(userId, collectionId) {
  if (!userId || !collectionId) {
    return null
  }

  const collectionRef = ref(
    database,
    `users/${userId}/collections/${collectionId}`
  )

  const snapshot = await get(collectionRef)

  if (!snapshot.exists()) {
    return null
  }

  return {
    ...snapshot.val(),
    id: collectionId,
    books: snapshot.val().books || {},
  }
}

/**
 * Creates a collection in a user's private collections.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {Object} collection - Collection information.
 * @param {string} collection.name - Collection name.
 * @param {string} [collection.description] - Optional collection description.
 * @returns {Promise<string>} Created collection ID.
 */
export async function createCollection(userId, collection) {
  if (!userId || !collection?.name?.trim()) {
    throw new Error('Missing user or collection information.')
  }

  const collectionsRef = ref(
    database,
    `users/${userId}/collections`
  )
  const collectionRef = push(collectionsRef)

  await set(collectionRef, createCollectionData(collection))

  return collectionRef.key
}

/**
 * Updates a collection's editable information.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} collectionId - Collection ID.
 * @param {Object} collection - Collection information.
 * @param {string} collection.name - Collection name.
 * @param {string} [collection.description] - Optional collection description.
 * @returns {Promise<void>}
 */
export async function updateCollection(
  userId,
  collectionId,
  collection
) {
  if (!userId || !collectionId || !collection?.name?.trim()) {
    throw new Error('Missing collection information.')
  }

  const collectionRef = ref(
    database,
    `users/${userId}/collections/${collectionId}`
  )

  await update(collectionRef, {
    name: collection.name.trim(),
    description: collection.description?.trim() || '',
    updatedAt: Date.now(),
  })
}

/**
 * Removes a collection from a user's private collections.
 *
 * This does not remove any book from the user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} collectionId - Collection ID.
 * @returns {Promise<void>}
 */
export async function deleteCollection(userId, collectionId) {
  if (!userId || !collectionId) {
    throw new Error('Missing user or collection information.')
  }

  const collectionRef = ref(
    database,
    `users/${userId}/collections/${collectionId}`
  )

  await remove(collectionRef)
}

/**
 * Adds a book reference to a user's collection.
 *
 * This stores only the book ID and does not duplicate library metadata.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} collectionId - Collection ID.
 * @param {string} bookId - Book ID stored in the user's library.
 * @returns {Promise<void>}
 */
export async function addBookToCollection(
  userId,
  collectionId,
  bookId
) {
  if (!userId || !collectionId || !bookId) {
    throw new Error('Missing collection or book information.')
  }

  const collectionRef = ref(
    database,
    `users/${userId}/collections/${collectionId}`
  )

  await update(collectionRef, {
    [`books/${bookId}`]: true,
    updatedAt: Date.now(),
  })
}

/**
 * Removes a book reference from a user's collection.
 *
 * This does not remove the book from the user's library.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string} collectionId - Collection ID.
 * @param {string} bookId - Book ID stored in the user's library.
 * @returns {Promise<void>}
 */
export async function removeBookFromCollection(
  userId,
  collectionId,
  bookId
) {
  if (!userId || !collectionId || !bookId) {
    throw new Error('Missing collection or book information.')
  }

  const collectionRef = ref(
    database,
    `users/${userId}/collections/${collectionId}`
  )

  await update(collectionRef, {
    [`books/${bookId}`]: null,
    updatedAt: Date.now(),
  })
}
