import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { normalizeRole } from '../utils/roles'

/**
 * Role-aware route guard.
 *
 * <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
 *
 * This is a UX protection only. Every API call behind these pages is
 * authorized again by FastAPI.
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner fullPage />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // If no roles are specified, any authenticated user is allowed.
  if (!allowedRoles || allowedRoles.length === 0) {
    return children
  }

  const userRole = normalizeRole(user?.role)

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner fullPage />
  }

  return !isAuthenticated
    ? children
    : <Navigate to="/dashboard" replace />
}
