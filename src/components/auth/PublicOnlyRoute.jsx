import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import LoadingState from '../ui/LoadingState.jsx'

function PublicOnlyRoute() {
  const {
    user,
    isAuthLoading,
    isPreferencesLoading,
    isPreferencesResolved,
    isAuthBootstrapPending,
    requiresOnboarding,
  } = useAuth()

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
    return <Outlet />
  }

  return (
    <Navigate
      to={requiresOnboarding ? '/onboarding' : '/'}
      replace
    />
  )
}

export default PublicOnlyRoute
