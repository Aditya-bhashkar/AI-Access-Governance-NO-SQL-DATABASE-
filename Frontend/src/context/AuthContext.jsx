import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { loginUser, userAPI } from '../services/apiService'
import {
  normalizeUser,
  isAdminRole,
  isSuperAdminRole,
} from '../utils/roles'

const AuthContext = createContext(null)

const ACCESS_TOKEN_KEY = 'access_token'
const USER_KEY = 'auth_user'

/**
 * Persist the user object in whichever storage currently holds the
 * session (localStorage when "Remember me" was ticked, otherwise
 * sessionStorage). Never creates a session by itself.
 */
function persistUser(user) {
  if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else if (sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  /**
   * Re-sync the authenticated user from the backend.
   *
   * The role stored in the browser can become stale (an admin may
   * promote / demote this account at any time). The backend is the
   * source of truth, so this replaces the cached copy.
   *
   * A 401 / "deactivated" 403 is handled by the Axios interceptor,
   * which ends the session.
   */
  const refreshUser = useCallback(async () => {
    try {
      const fresh = normalizeUser(await userAPI.getMe())

      setUser(fresh)
      persistUser(fresh)

      return fresh
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const storedUser =
      localStorage.getItem(USER_KEY) ||
      sessionStorage.getItem(USER_KEY)

    const storedToken =
      localStorage.getItem(ACCESS_TOKEN_KEY) ||
      sessionStorage.getItem(ACCESS_TOKEN_KEY)

    let hasSession = false

    if (storedUser && storedToken) {
      try {
        setUser(normalizeUser(JSON.parse(storedUser)))
        hasSession = true
      } catch {
        localStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(USER_KEY)
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      }
    }

    setLoading(false)

    // Validate the cached role / status against the backend.
    if (hasSession) {
      refreshUser()
    }
  }, [refreshUser])

  const login = useCallback(async ({ email, password, remember }) => {
    const response = await loginUser(email, password)

    const token = response.access_token
    const loggedInUser = normalizeUser(response.user)

    if (!token || !loggedInUser) {
      throw new Error('Invalid login response from server.')
    }

    setUser(loggedInUser)

    const storage = remember ? localStorage : sessionStorage
    const otherStorage = remember ? sessionStorage : localStorage

    // Remove any previous authentication data
    otherStorage.removeItem(USER_KEY)
    otherStorage.removeItem(ACCESS_TOKEN_KEY)

    // Store the current session
    storage.setItem(USER_KEY, JSON.stringify(loggedInUser))
    storage.setItem(ACCESS_TOKEN_KEY, token)
  }, [])

  const logout = useCallback(() => {
    setUser(null)

    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)

    sessionStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated: !!user,

      // Convenience flags. UX only; the backend enforces access.
      role: user?.role ?? null,
      isAdmin: isAdminRole(user?.role),
      isSuperAdmin: isSuperAdminRole(user?.role),
    }),
    [user, loading, login, logout, refreshUser]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error('useAuth must be inside <AuthProvider>')
  }

  return ctx
}
