import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'

function PublicOnlyRoute() {
  const {
    user,
    isAuthLoading,
    isPreferencesLoading,
    requiresOnboarding,
  } = useAuth()

  if (isAuthLoading || (user && isPreferencesLoading)) {
    return null
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
