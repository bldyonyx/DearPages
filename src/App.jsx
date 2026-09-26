import { Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/auth/ProtectedRoute'
import PublicOnlyRoute from './components/auth/PublicOnlyRoute'
import PageLayout from './components/layout/PageLayout'
import BookPage from './pages/BookPage'
import CollectionPage from './pages/CollectionPage'
import Collections from './pages/Collections'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import Login from './pages/Login'
import MyLibrary from './pages/MyLibrary'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import SignUp from './pages/SignUp'

function App() {
  return (
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

        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
      </Route>
    </Routes>
  )
}

export default App
