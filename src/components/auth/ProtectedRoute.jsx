import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import LoadingState from '../ui/LoadingState.jsx'

function ProtectedRoute() {
  const location = useLocation()
  const {
    user,
    isAuthLoading,
    isPreferencesLoading,
    isPreferencesResolved,
    isAuthBootstrapPending,
    hasCompletedOnboarding,
    requiresOnboarding,
  } = useAuth()

  const isOnboardingRoute = location.pathname === '/onboarding'

  const isWaitingForPreferences =
    isAuthBootstrapPending ||
    (user && (isPreferencesLoading || !isPreferencesResolved))

  if (isAuthLoading || isWaitingForPreferences) {
    return (
      <LoadingState
        message="Chargement..."
        fullscreen
      />
    )
  }

  if (!user) {
    return <Navigate to="/signup" replace />
  }

  if (requiresOnboarding && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />
  }

  if (hasCompletedOnboarding && isOnboardingRoute) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute