/**
 * Frontend/src/services/apiService.js
 *
 * Central API service for the AI Access Governance frontend.
 * Matches the current FastAPI backend.
 */

import axios from 'axios'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACCESS_TOKEN_KEY = 'access_token'
const USER_KEY = 'auth_user'

// -----------------------------------------------------------------------------
// Axios instance
// -----------------------------------------------------------------------------

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// -----------------------------------------------------------------------------
// Authentication helpers
// -----------------------------------------------------------------------------

const getAccessToken = () => {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    sessionStorage.getItem(ACCESS_TOKEN_KEY)
  )
}

// -----------------------------------------------------------------------------
// Request interceptor
// -----------------------------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken()

    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// -----------------------------------------------------------------------------
// Response interceptor
// -----------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || ''

    // 401 -> invalid / expired token, or the user no longer exists.
    // 403 "deactivated" -> an administrator disabled this account while
    // the user was signed in. Both end the session.
    const accountDeactivated =
      status === 403 && /deactivated/i.test(message)

    if (status === 401 || accountDeactivated) {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)

      sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)

      // Do not redirect away from the login page: the login form
      // needs to show the error message itself.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// -----------------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------------

const getErrorMessage = (
  error,
  fallback = 'Something went wrong.'
) => {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || 'Validation error')
      .join(', ')
  }

  const validationErrors =
    error?.response?.data?.data?.errors

  if (
    Array.isArray(validationErrors) &&
    validationErrors.length > 0
  ) {
    return validationErrors.join('; ')
  }

  if (error?.response?.data?.message) {
    return error.response.data.message
  }

  if (error?.message) {
    return error.message
  }

  return fallback
}

// -----------------------------------------------------------------------------
// AUTHENTICATION
// -----------------------------------------------------------------------------

export const authAPI = {
  /**
   * Register a new user.
   *
   * Public registration always creates a regular user.
   * The backend also enforces this rule.
   */
  register: async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      })

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Registration failed.'
        )
      )
    }
  },

  /**
   * Login.
   *
   * Authentication storage is handled by AuthContext.
   */
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      })

      const data = response.data.data

      const {
        access_token,
        user,
      } = data

      if (!access_token || !user) {
        throw new Error(
          'Invalid login response from server.'
        )
      }

      return {
        access_token,
        user,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !error.response
      ) {
        throw error
      }

      throw new Error(
        getErrorMessage(
          error,
          'Login failed.'
        )
      )
    }
  },

  logout: () => {
    localStorage.removeItem(
      ACCESS_TOKEN_KEY
    )

    localStorage.removeItem(
      USER_KEY
    )

    sessionStorage.removeItem(
      ACCESS_TOKEN_KEY
    )

    sessionStorage.removeItem(
      USER_KEY
    )
  },
}

// -----------------------------------------------------------------------------
// USER MANAGEMENT
// -----------------------------------------------------------------------------

/**
 * Every call is authorized by the backend:
 *
 * - user       -> own profile only
 * - admin      -> normal users
 * - superadmin -> normal users and admins
 *
 * Rows returned by list/getById include a `permissions` object
 * ({ view, edit, change_status, change_role, delete }) computed by the
 * backend for the current user.
 */
export const userAPI = {
  /** Own profile (also used to re-sync the role from the server). */
  getMe: async () => {
    try {
      const response = await api.get('/users/me')

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to load profile.')
      )
    }
  },

  /** Paginated user list. */
  list: async (params = {}) => {
    try {
      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 10,
        search: params.search,
        role: params.role,
        is_active: params.is_active,
      }

      Object.keys(queryParams).forEach((key) => {
        if (
          queryParams[key] === undefined ||
          queryParams[key] === null ||
          queryParams[key] === ''
        ) {
          delete queryParams[key]
        }
      })

      const response = await api.get('/users', {
        params: queryParams,
      })

      return {
        data: response.data.data || [],
        pagination: response.data.pagination || {
          page: 1,
          limit: queryParams.limit,
          total: 0,
          total_pages: 0,
        },
      }
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to load users.')
      )
    }
  },

  getUser: async (id) => {
    try {
      const response = await api.get(`/users/${id}`)

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to load user.')
      )
    }
  },

  /** Profile fields only: { name, email }. */
  updateUser: async (id, data) => {
    try {
      const response = await api.patch(`/users/${id}`, data)

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to update user.')
      )
    }
  },

  updateStatus: async (id, isActive) => {
    try {
      const response = await api.patch(
        `/users/${id}/status`,
        { is_active: isActive }
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to update account status.'
        )
      )
    }
  },

  /** Superadmin only. */
  updateRole: async (id, role) => {
    try {
      const response = await api.patch(
        `/users/${id}/role`,
        { role }
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to update role.')
      )
    }
  },

  deleteUser: async (id) => {
    try {
      await api.delete(`/users/${id}`)
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Failed to delete user.')
      )
    }
  },

  /** Superadmin only: { name, email, password }. */
  createAdmin: async (data) => {
    try {
      const response = await api.post('/users/admin', data)

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to create admin account.'
        )
      )
    }
  },
}

// -----------------------------------------------------------------------------
// API ACCESS CRUD
// -----------------------------------------------------------------------------

export const apiAccessAPI = {
  /**
   * Get API access records.
   *
   * Backend applies ownership/RBAC filtering:
   * - user       -> own records
   * - admin      -> all records
   * - superadmin -> all records
   */
  list: async (params = {}) => {
    try {
      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 10,
        sort_by:
          params.sort_by || 'created_at',
        sort_order:
          params.sort_order || 'desc',
        ...params,
      }

      Object.keys(queryParams).forEach(
        (key) => {
          if (
            queryParams[key] === undefined ||
            queryParams[key] === null ||
            queryParams[key] === ''
          ) {
            delete queryParams[key]
          }
        }
      )

      const response = await api.get(
        '/api-access',
        {
          params: queryParams,
        }
      )

      return {
        data: response.data.data || [],
        pagination:
          response.data.pagination || {
            page: 1,
            limit: queryParams.limit,
            total: 0,
            total_pages: 0,
          },
      }
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load API access records.'
        )
      )
    }
  },

  /**
   * Get one API access record.
   */
  getById: async (id) => {
    try {
      const response = await api.get(
        `/api-access/${id}`
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load API access record.'
        )
      )
    }
  },

  /**
   * Create API access record.
   *
   * Ownership is assigned by the backend
   * using the authenticated user.
   */
  create: async (record) => {
    try {
      const response = await api.post(
        '/api-access',
        record
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to create API access record.'
        )
      )
    }
  },

  /**
   * Update API access record.
   *
   * Backend verifies ownership/RBAC.
   */
  update: async (id, record) => {
    try {
      const response = await api.put(
        `/api-access/${id}`,
        record
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to update API access record.'
        )
      )
    }
  },

  /**
   * Delete API access record.
   *
   * Backend verifies ownership/RBAC.
   */
  delete: async (id) => {
    try {
      await api.delete(
        `/api-access/${id}`
      )
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to delete API access record.'
        )
      )
    }
  },
}

// -----------------------------------------------------------------------------
// AUDIT HISTORY
// -----------------------------------------------------------------------------

export const auditAPI = {
  /**
   * Get audit history for one API access record.
   *
   * Backend verifies ownership/RBAC.
   */
  getRecordHistory: async (
    recordId,
    limit = 50
  ) => {
    try {
      const response = await api.get(
        `/api-access/${recordId}/audit`,
        {
          params: { limit },
        }
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load audit history.'
        )
      )
    }
  },

  /**
   * Get recent audit logs.
   *
   * Intended for admin/superadmin access.
   * Backend enforces authorization.
   */
  getRecent: async (
    limit = 100,
    entity_type = null
  ) => {
    try {
      const params = { limit }

      if (entity_type) {
        params.entity_type =
          entity_type
      }

      const response = await api.get(
        '/audits/recent',
        {
          params,
        }
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load recent audit logs.'
        )
      )
    }
  },

  /**
   * Get audit logs for a specific user.
   *
   * Backend enforces authorization.
   */
  getUserLogs: async (
    userId,
    limit = 100
  ) => {
    try {
      const response = await api.get(
        `/audits/user/${userId}`,
        {
          params: { limit },
        }
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load user audit logs.'
        )
      )
    }
  },
}

// -----------------------------------------------------------------------------
// ANALYTICS
// -----------------------------------------------------------------------------

export const analyticsAPI = {
  /**
   * Dashboard overview.
   */
  getOverview: async () => {
    try {
      const response = await api.get(
        '/analytics/overview'
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load analytics overview.'
        )
      )
    }
  },

  /**
   * Complete analytics.
   */
  getComplete: async () => {
    try {
      const response = await api.get(
        '/analytics/complete'
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load complete analytics.'
        )
      )
    }
  },

  /**
   * Analytics grouped by vendor.
   */
  getByVendor: async () => {
    try {
      const response = await api.get(
        '/analytics/vendor'
      )

      return response.data.data || []
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load vendor analytics.'
        )
      )
    }
  },

  /**
   * Analytics grouped by business unit.
   */
  getByBusinessUnit: async () => {
    try {
      const response = await api.get(
        '/analytics/business-unit'
      )

      return response.data.data || []
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load business unit analytics.'
        )
      )
    }
  },

  /**
   * Records expiring soon.
   *
   * Current backend contract:
   *
   * GET /analytics/expiring-soon?limit=10
   *
   * The backend returns records ordered by
   * nearest expiry and includes days_until_expiry.
   */
  getExpiringsSoon: async (
    limit = 10
  ) => {
    try {
      const response = await api.get(
        '/analytics/expiring-soon',
        {
          params: { limit },
        }
      )

      return response.data.data || []
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load expiring records.'
        )
      )
    }
  },

  /**
   * Recently created records.
   */
  getRecent: async (
    limit = 10
  ) => {
    try {
      const response = await api.get(
        '/analytics/recent',
        {
          params: { limit },
        }
      )

      return response.data.data || []
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load recent records.'
        )
      )
    }
  },
}

// -----------------------------------------------------------------------------
// BACKWARD-COMPATIBILITY EXPORTS
// -----------------------------------------------------------------------------

export const loginUser =
  authAPI.login

export const registerUser =
  authAPI.register

export const logoutUser =
  authAPI.logout

export const getAllApiAccess =
  apiAccessAPI.list

export const getApiAccess =
  apiAccessAPI.list

export const listApiAccess =
  apiAccessAPI.list

export const getApiAccessById =
  apiAccessAPI.getById

export const createApiAccess =
  apiAccessAPI.create

export const updateApiAccess =
  apiAccessAPI.update

export const deleteApiAccess =
  apiAccessAPI.delete

export const getRecordHistory =
  auditAPI.getRecordHistory

export const getRecentAudit =
  auditAPI.getRecent

export const getUserAuditLogs =
  auditAPI.getUserLogs

export const getAnalyticsOverview =
  analyticsAPI.getOverview

export const getCompleteAnalytics =
  analyticsAPI.getComplete

export const getAnalyticsByVendor =
  analyticsAPI.getByVendor

export const getAnalyticsByBusinessUnit =
  analyticsAPI.getByBusinessUnit

export const getExpiringRecords =
  analyticsAPI.getExpiringsSoon

export const getRecentRecords =
  analyticsAPI.getRecent

export default api