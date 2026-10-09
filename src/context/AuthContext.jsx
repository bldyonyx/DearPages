import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'

import i18n, {
  SUPPORTED_LANGUAGES,
} from '../i18n/index.js'
import { auth } from '../services/firebase.js'
import { getUserPreferences } from '../services/preferencesService.js'

const AuthContext = createContext(null)
const ONBOARDING_STATUS = {
  UNKNOWN: 'unknown',
  REQUIRED: 'required',
  COMPLETE: 'complete',
}

function getOnboardingStatus(nextPreferences) {
  return nextPreferences?.onboardingCompleted === false
    ? ONBOARDING_STATUS.REQUIRED
    : ONBOARDING_STATUS.COMPLETE
}

function applyStoredLanguage(nextPreferences) {
  const preferredLanguage = nextPreferences?.language

  if (
    SUPPORTED_LANGUAGES.includes(preferredLanguage) &&
    i18n.language !== preferredLanguage
  ) {
    i18n.changeLanguage(preferredLanguage)
  }
}

/**
 * Provides the current Firebase authentication state
 * to the entire Dear Pages application.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactNode}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRevision, setUserRevision] = useState(0)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [preferences, setPreferences] = useState(null)
  const [isPreferencesLoading, setIsPreferencesLoading] =
    useState(false)
  const [isPreferencesResolved, setIsPreferencesResolved] =
    useState(false)
  const [isAuthBootstrapPending, setIsAuthBootstrapPending] =
    useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState(
    ONBOARDING_STATUS.UNKNOWN
  )
  const preferencesRequestIdRef = useRef(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setPreferences(null)
        setIsPreferencesResolved(false)
        setOnboardingStatus(ONBOARDING_STATUS.UNKNOWN)
        setIsPreferencesLoading(Boolean(firebaseUser))
        setUser(firebaseUser)
        setIsAuthLoading(false)
      }
    )

    return unsubscribe
  }, [])

  useEffect(() => {
    if (isAuthLoading) return

    if (!user?.uid) {
      preferencesRequestIdRef.current += 1
      setPreferences(null)
      setIsPreferencesResolved(true)
      setOnboardingStatus(ONBOARDING_STATUS.UNKNOWN)
      setIsPreferencesLoading(false)
      return
    }

    let isActive = true
    const requestId = preferencesRequestIdRef.current + 1
    preferencesRequestIdRef.current = requestId

    async function loadPreferences() {
      setIsPreferencesLoading(true)

      try {
        const userPreferences = await getUserPreferences(user.uid)

        if (
          isActive &&
          preferencesRequestIdRef.current === requestId
        ) {
          applyStoredLanguage(userPreferences)
          setPreferences(userPreferences)
          setIsPreferencesResolved(true)
          setOnboardingStatus(
            getOnboardingStatus(userPreferences)
          )
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (
          isActive &&
          preferencesRequestIdRef.current === requestId
        ) {
          setPreferences(null)
          setIsPreferencesResolved(true)
          setOnboardingStatus(ONBOARDING_STATUS.UNKNOWN)
        }
      } finally {
        if (
          isActive &&
          preferencesRequestIdRef.current === requestId
        ) {
          setIsPreferencesLoading(false)
        }
      }
    }

    loadPreferences()

    return () => {
      isActive = false
    }
  }, [isAuthLoading, user])

  function updatePreferences(nextPreferences) {
    preferencesRequestIdRef.current += 1
    applyStoredLanguage(nextPreferences)
    setPreferences(nextPreferences)
    setIsPreferencesResolved(true)
    setOnboardingStatus(getOnboardingStatus(nextPreferences))
    setIsPreferencesLoading(false)
  }

  function beginAuthBootstrap() {
    setIsAuthBootstrapPending(true)
    setIsPreferencesResolved(false)
    setOnboardingStatus(ONBOARDING_STATUS.UNKNOWN)
  }

  function endAuthBootstrap() {
    setIsAuthBootstrapPending(false)
  }

  function refreshUser() {
    if (!auth.currentUser) return

    setUser(auth.currentUser)
    setUserRevision((currentRevision) => currentRevision + 1)
  }

  const requiresOnboarding =
    onboardingStatus === ONBOARDING_STATUS.REQUIRED
  const hasCompletedOnboarding =
    onboardingStatus === ONBOARDING_STATUS.COMPLETE

  return (
    <AuthContext.Provider
      value={{
        user,
        userRevision,
        isAuthLoading,
        preferences,
        isPreferencesLoading,
        isPreferencesResolved,
        isAuthBootstrapPending,
        onboardingStatus,
        requiresOnboarding,
        hasCompletedOnboarding,
        updatePreferences,
        beginAuthBootstrap,
        endAuthBootstrap,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Gives components access to the current authentication state.
 *
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   userRevision: number,
 *   isAuthLoading: boolean,
 *   preferences: Object | null,
 *   isPreferencesLoading: boolean,
 *   isPreferencesResolved: boolean,
 *   isAuthBootstrapPending: boolean,
 *   onboardingStatus: 'unknown' | 'required' | 'complete',
 *   requiresOnboarding: boolean,
 *   hasCompletedOnboarding: boolean,
 *   updatePreferences: (preferences: Object | null) => void,
 *   beginAuthBootstrap: () => void,
 *   endAuthBootstrap: () => void,
 *   refreshUser: () => void
 * }}
 */
export function useAuth() {
  return useContext(AuthContext)
}
