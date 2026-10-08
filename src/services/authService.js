import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { get, ref, remove, set, update } from 'firebase/database'
import { auth, database } from './firebase.js'
import { initializeOnboardingPreferences } from './preferencesService.js'

const googleProvider = new GoogleAuthProvider()

/**
 * Creates or updates the private profile stored for a Dear Pages user.
 *
 * Existing custom display names are preserved unless a display name is
 * explicitly provided.
 *
 * @param {import('firebase/auth').User} user
 * @param {string} [displayName]
 * @returns {Promise<void>}
 */
async function saveUserProfile(user, displayName = '') {
  const userRef = ref(database, `users/${user.uid}/profile`)
  const snapshot = await get(userRef)
  const trimmedDisplayName = displayName.trim()

  if (snapshot.exists()) {
    const existingProfile = snapshot.val() || {}

    await update(userRef, {
      displayName:
        trimmedDisplayName ||
        existingProfile.displayName ||
        user.displayName ||
        '',
      email: user.email || '',
      photoURL: user.photoURL || '',
    })

    return
  }

  await set(userRef, {
    displayName: trimmedDisplayName || user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
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

  await saveUserProfile(
    credential.user,
    trimmedDisplayName
  )

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
 * Returns a French login error message without inferring details Firebase does
 * not reliably expose when email enumeration protection is enabled.
 *
 * @param {{ code?: string }} firebaseError
 * @returns {string}
 */
export function getEmailSignInErrorMessage(
  firebaseError,
  t = null
) {
  const translate = (key, fallback) =>
    typeof t === 'function' ? t(key) : fallback

  switch (firebaseError?.code) {
    case 'auth/user-not-found':
      return translate(
        'auth.login.errors.userNotFound',
        'Aucun compte n’existe avec cette adresse e-mail.'
      )
    case 'auth/wrong-password':
      return translate(
        'auth.login.errors.wrongPassword',
        'Mot de passe incorrect.'
      )
    case 'auth/invalid-email':
      return translate(
        'auth.login.errors.invalidEmail',
        'Adresse e-mail invalide.'
      )
    case 'auth/user-disabled':
      return translate(
        'auth.login.errors.userDisabled',
        'Ce compte a été désactivé.'
      )
    case 'auth/too-many-requests':
      return translate(
        'auth.login.errors.tooManyRequests',
        'Trop de tentatives. Réessaie dans quelques minutes.'
      )
    case 'auth/network-request-failed':
      return translate(
        'auth.login.errors.network',
        'Connexion impossible. Vérifie ta connexion internet.'
      )
    case 'auth/invalid-credential':
      return translate(
        'auth.login.errors.invalidCredential',
        'E-mail ou mot de passe incorrect.'
      )
    default:
      return translate(
        'auth.login.errors.fallback',
        'Impossible de se connecter pour le moment.'
      )
  }
}

/**
 * Signs in with Google and creates or updates
 * the user's Dear Pages profile.
 *
 * Existing Dear Pages display names are preserved on later Google sign-ins.
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
 * Updates the display name used by Dear Pages.
 *
 * The name is synchronized between Firebase Auth and the user's
 * private profile stored in Realtime Database.
 *
 * @param {import('firebase/auth').User} user
 * @param {string} displayName
 * @returns {Promise<string>}
 */
export async function updateUserDisplayName(
  user,
  displayName
) {
  if (!user?.uid) {
    throw new Error('Missing authenticated user.')
  }

  const trimmedDisplayName = displayName.trim()

  if (!trimmedDisplayName) {
    throw new Error('Display name cannot be empty.')
  }

  await updateProfile(user, {
    displayName: trimmedDisplayName,
  })

  const userRef = ref(
    database,
    `users/${user.uid}/profile`
  )

  await update(userRef, {
    displayName: trimmedDisplayName,
  })

  return trimmedDisplayName
}

/**
 * Signs the current user out of Dear Pages.
 *
 * @returns {Promise<void>}
 */
export async function logOut() {
  await signOut(auth)
}

async function reauthenticateForAccountDeletion(
  user,
  password = ''
) {
  const providerIds = user.providerData.map(
    (provider) => provider.providerId
  )

  if (providerIds.includes('password')) {
    if (!user.email || !password) {
      throw new Error('Missing password reauthentication data.')
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      password
    )

    await reauthenticateWithCredential(user, credential)
    return
  }

  if (
    providerIds.includes(
      GoogleAuthProvider.PROVIDER_ID
    )
  ) {
    await reauthenticateWithPopup(user, googleProvider)
    return
  }

  throw new Error('Unsupported reauthentication provider.')
}

/**
 * Deletes the signed-in user's private RTDB data and Firebase Auth account.
 *
 * The user is reauthenticated first so `auth/requires-recent-login` is
 * handled before deleting `users/{uid}`. With client-side Firebase only, this
 * is the safest available order: RTDB rules still allow removing the private
 * data while the account exists, then Auth deletion signs the user out.
 *
 * @param {import('firebase/auth').User} user - Current Firebase user.
 * @param {{ password?: string }} [options] - Reauthentication details.
 * @returns {Promise<void>}
 */
export async function deleteCurrentUserAccount(
  user,
  { password = '' } = {}
) {
  if (!user?.uid) {
    throw new Error('Missing authenticated user.')
  }

  await reauthenticateForAccountDeletion(
    user,
    password
  )

  const userRef = ref(
    database,
    `users/${user.uid}`
  )

  await remove(userRef)
  await deleteUser(user)
}
