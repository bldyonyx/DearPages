import { ref, set } from 'firebase/database'

import { database } from './firebase.js'

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
 * @returns {Promise<void>}
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

  await set(preferencesRef, {
    favoriteGenres,
    annualGoal,
    onboardingCompleted: true,
    updatedAt: Date.now(),
  })
}
