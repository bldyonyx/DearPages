import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase.js'
import { getUserPreferences } from '../services/preferencesService.js'

const AuthContext = createContext(null)

/**
 * Provides the current Firebase authentication state
 * to the entire Dear Pages application.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {React.ReactNode}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [preferences, setPreferences] = useState(null)
  const [isPreferencesLoading, setIsPreferencesLoading] =
    useState(false)
  const preferencesRequestIdRef = useRef(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setPreferences(null)
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
          setPreferences(userPreferences)
        }
      } catch (firebaseError) {
        console.error(firebaseError)

        if (
          isActive &&
          preferencesRequestIdRef.current === requestId
        ) {
          setPreferences(null)
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
    setPreferences(nextPreferences)
    setIsPreferencesLoading(false)
  }

  const requiresOnboarding =
    preferences?.onboardingCompleted === false

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthLoading,
        preferences,
        isPreferencesLoading,
        requiresOnboarding,
        updatePreferences,
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
 *   isAuthLoading: boolean,
 *   preferences: Object | null,
 *   isPreferencesLoading: boolean,
 *   requiresOnboarding: boolean,
 *   updatePreferences: (preferences: Object | null) => void
 * }}
 */
export function useAuth() {
  return useContext(AuthContext)
}
