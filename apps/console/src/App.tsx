import { Route, Routes } from 'react-router'
import AppLayout from './ui/AppLayout'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <AppLayout>
      {/* Only the matching Route is shown, inside the layout */}
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App