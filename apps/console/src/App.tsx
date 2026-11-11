import { Route, Routes } from 'react-router'
import AppLayout from './ui/AppLayout'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <Routes>
      {/* No frame */}
      <Route path="/login" element={<LoginPage />} />

      {/* Layout route: no path, just wraps the routes inside it */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App