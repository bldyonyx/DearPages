import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { get, ref, set, update } from 'firebase/database'
import { auth, database } from './firebase.js'
import { initializeOnboardingPreferences } from './preferencesService.js'

const googleProvider = new GoogleAuthProvider()

/**
 * Creates or updates the private profile stored for a Dear Pages user.
 *
 * @param {import('firebase/auth').User} user
 * @param {string} [displayName]
 * @returns {Promise<void>}
 */
async function saveUserProfile(user, displayName = '') {
  const userRef = ref(database, `users/${user.uid}/profile`)
  const profile = {
    displayName: displayName || user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
  }
  const snapshot = await get(userRef)

  if (snapshot.exists()) {
    await update(userRef, profile)
    return
  }

  await set(userRef, {
    ...profile,
    createdAt: Date.now(),
  })
}

/**
 * Creates a Dear Pages account using an email address and password.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise<{
 *   user: import('firebase/auth').User,
 *   preferences: Object
 * }>}
 */
export async function signUpWithEmail(
  email,
  password,
  displayName
) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  )

  const trimmedDisplayName = displayName.trim()

  await updateProfile(credential.user, {
    displayName: trimmedDisplayName,
  })
  await saveUserProfile(credential.user, trimmedDisplayName)
  const preferences = await initializeOnboardingPreferences(
    credential.user.uid
  )

  return {
    user: credential.user,
    preferences,
  }
}

/**
 * Signs in to Dear Pages using an email address and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  )

  return credential.user
}

/**
 * Signs in with Google and creates or updates
 * the user's Dear Pages profile.
 *
 * @returns {Promise<{
 *   user: import('firebase/auth').User,
 *   isNewUser: boolean,
 *   preferences: Object | null
 * }>}
 */
export async function signInWithGoogle() {
  const credential = await signInWithPopup(
    auth,
    googleProvider
  )
  const isNewUser = Boolean(
    getAdditionalUserInfo(credential)?.isNewUser
  )

  await saveUserProfile(credential.user)

  const preferences = isNewUser
    ? await initializeOnboardingPreferences(credential.user.uid)
    : null

  return {
    user: credential.user,
    isNewUser,
    preferences,
  }
}

/**
 * Signs the current user out of Dear Pages.
 *
 * @returns {Promise<void>}
 */
export async function logOut() {
  await signOut(auth)
}
