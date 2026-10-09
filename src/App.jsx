
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/auth/ProtectedRoute'
import PublicOnlyRoute from './components/auth/PublicOnlyRoute'
import PageLayout from './components/layout/PageLayout'
import CustomCursor from './components/ui/CustomCursor'

// Pages chargées uniquement lorsqu'elles sont nécessaires
const BookPage = lazy(() => import('./pages/BookPage'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const Collections = lazy(() => import('./pages/Collections'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Discover = lazy(() => import('./pages/Discover'))
const Login = lazy(() => import('./pages/Login'))
const MyLibrary = lazy(() => import('./pages/MyLibrary'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Settings = lazy(() => import('./pages/Settings'))
const SignUp = lazy(() => import('./pages/SignUp'))

function App() {
  return (
    <>
      <CustomCursor />

      <Suspense fallback={null}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<PageLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/library" element={<MyLibrary />} />
              <Route path="/books/:id" element={<BookPage />} />
              <Route path="/collections" element={<Collections />} />
              <Route
                path="/collections/:id"
                element={<CollectionPage />}
              />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route
              path="/onboarding"
              element={<Onboarding />}
            />
          </Route>

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
