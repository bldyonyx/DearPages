import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function ProtectedRoute() {
  const location = useLocation()
  const {
    user,
    isAuthLoading,
    isPreferencesLoading,
    preferences,
    requiresOnboarding,
  } = useAuth()
  const isOnboardingRoute = location.pathname === '/onboarding'

  if (isAuthLoading || (user && isPreferencesLoading)) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiresOnboarding && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />
  }

  if (
    preferences?.onboardingCompleted === true &&
    isOnboardingRoute
  ) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
