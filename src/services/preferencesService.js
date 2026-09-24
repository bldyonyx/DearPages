import {
  get,
  ref,
  set,
  update,
} from 'firebase/database'

import { database } from './firebase.js'

const MAX_ANNUAL_GOAL = 200

function createCompletedOnboardingPreferences(
  favoriteGenres,
  annualGoal
) {
  return {
    favoriteGenres,
    annualGoal,
    onboardingCompleted: true,
    updatedAt: Date.now(),
  }
}

/**
 * Initializes onboarding preferences for a newly created user.
 *
 * This must only be called for real new accounts. Existing users without
 * preferences are treated as legacy users and must not be converted to false.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @returns {Promise<Object>} Initial preferences saved to Firebase.
 * @throws {Error} If the user information is missing.
 */
export async function initializeOnboardingPreferences(userId) {
  if (!userId) {
    throw new Error('Missing user information.')
  }

  const preferencesRef = ref(
    database,
    `users/${userId}/preferences`
  )
  const preferences = {
    onboardingCompleted: false,
    updatedAt: Date.now(),
  }

  await update(preferencesRef, preferences)

  return preferences
}

/**
 * Gets the preferences stored for a user.
 *
 * A null return value means preferences are absent. That is intentionally
 * distinct from onboardingCompleted: false, which means onboarding is required.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @returns {Promise<Object|null>} Stored preferences or null for legacy users.
 */
export async function getUserPreferences(userId) {
  if (!userId) {
    return null
  }

  const preferencesRef = ref(
    database,
    `users/${userId}/preferences`
  )

  const snapshot = await get(preferencesRef)

  return snapshot.exists() ? snapshot.val() : null
}

/**
 * Saves the preferences chosen at the end of onboarding.
 *
 * Data is written to:
 * users/{userId}/preferences
 *
 * Stored shape:
 * {
 *   favoriteGenres: string[],
 *   annualGoal: number,
 *   onboardingCompleted: true,
 *   updatedAt: number
 * }
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {string[]} favoriteGenres - Selected genre subjects, not labels.
 * @param {number} annualGoal - Validated yearly reading goal.
 * @returns {Promise<Object>} Preferences saved to Firebase.
 * @throws {Error} If required preference information is missing or invalid.
 */
export async function saveOnboardingPreferences(
  userId,
  favoriteGenres,
  annualGoal
) {
  if (!userId) {
    throw new Error('Missing user information.')
  }

  if (
    !Array.isArray(favoriteGenres) ||
    favoriteGenres.length === 0 ||
    favoriteGenres.some((genre) => typeof genre !== 'string')
  ) {
    throw new Error('Missing favorite genres.')
  }

  if (!Number.isInteger(annualGoal) || annualGoal < 1) {
    throw new Error('Invalid annual reading goal.')
  }

  const preferencesRef = ref(
    database,
    `users/${userId}/preferences`
  )

  const preferences = createCompletedOnboardingPreferences(
    favoriteGenres,
    annualGoal
  )

  await set(preferencesRef, preferences)

  return preferences
}

/**
 * Updates reading preferences from Settings without replacing the full
 * preferences object, so onboardingCompleted and future fields are preserved.
 *
 * @param {string} userId - Firebase Authentication user ID.
 * @param {{ favoriteGenres?: string[], annualGoal?: number }} changes
 * Reading preference fields to update.
 * @returns {Promise<Object>} Partial preferences saved to Firebase.
 * @throws {Error} If required user information is missing or changes are invalid.
 */
export async function updateReadingPreferences(userId, changes) {
  if (!userId) {
    throw new Error('Missing user information.')
  }

  if (!changes || Object.keys(changes).length === 0) {
    throw new Error('Missing preference changes.')
  }

  const preferences = {
    updatedAt: Date.now(),
  }

  if (Object.hasOwn(changes, 'favoriteGenres')) {
    if (
      !Array.isArray(changes.favoriteGenres) ||
      changes.favoriteGenres.length === 0 ||
      changes.favoriteGenres.some(
        (genre) => typeof genre !== 'string'
      )
    ) {
      throw new Error('Missing favorite genres.')
    }

    preferences.favoriteGenres = changes.favoriteGenres
  }

  if (Object.hasOwn(changes, 'annualGoal')) {
    if (
      !Number.isInteger(changes.annualGoal) ||
      changes.annualGoal < 1 ||
      changes.annualGoal > MAX_ANNUAL_GOAL
    ) {
      throw new Error('Invalid annual reading goal.')
    }

    preferences.annualGoal = changes.annualGoal
  }

  const preferencesRef = ref(
    database,
    `users/${userId}/preferences`
  )

  await update(preferencesRef, preferences)

  return preferences
}
