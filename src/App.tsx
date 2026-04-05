import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage     from './pages/LoginPage'
import RegisterPage  from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import GoalsPage     from './pages/GoalsPage'
import DiaryPage     from './pages/DiaryPage'
import TasksPage     from './pages/TasksPage'
import ChatPage      from './pages/ChatPage'

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

const AppRoutes = () => (
  <Routes>
    <Route path="/"          element={<Navigate to="/dashboard" replace />} />
    <Route path="/login"     element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register"  element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/goals"     element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
    <Route path="/diary"     element={<ProtectedRoute><DiaryPage /></ProtectedRoute>} />
    <Route path="/tasks"     element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
    <Route path="/chat"      element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
  </Routes>
)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            border: '1px solid rgba(124,106,247,0.2)',
            color: 'white',
          },
        }}
      />
    </AuthProvider>
  </BrowserRouter>
)

export default App
