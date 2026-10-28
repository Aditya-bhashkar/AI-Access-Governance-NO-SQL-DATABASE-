import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'

import theme from './styles/theme'
import { AuthProvider } from './context/AuthContext'
import { RecordsProvider } from './context/RecordsContext'
import { ProtectedRoute, PublicRoute } from './routes'

import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Records from './pages/Dashboard/Records'
import AddRecord from './pages/AddRecord'
import EditRecord from './pages/EditRecord'
import ViewRecord from './pages/ViewRecord'
import UserManagement from './pages/UserManagement'
import AdminManagement from './pages/AdminManagement'
import AuditLogs from './pages/AuditLogs'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <RecordsProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute
                    allowedRoles={['user', 'admin', 'superadmin']}
                  >
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="records" element={<Records />} />
                <Route path="records/add" element={<AddRecord />} />
                <Route path="records/:id" element={<ViewRecord />} />
                <Route path="records/:id/edit" element={<EditRecord />} />
                <Route path="profile" element={<Profile />} />

                {/* Admin + Superadmin */}
                <Route
                  path="users"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="audit"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <AuditLogs />
                    </ProtectedRoute>
                  }
                />

                {/* Superadmin only */}
                <Route
                  path="admins"
                  element={
                    <ProtectedRoute allowedRoles={['superadmin']}>
                      <AdminManagement />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </RecordsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}