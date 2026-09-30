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
    preferences,
    requiresOnboarding,
  } = useAuth()

  const isOnboardingRoute = location.pathname === '/onboarding'

  if (isAuthLoading || (user && isPreferencesLoading)) {
    return (
      <main className="p-6">
        <LoadingState message="Chargement..." />
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/signup" replace />
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
