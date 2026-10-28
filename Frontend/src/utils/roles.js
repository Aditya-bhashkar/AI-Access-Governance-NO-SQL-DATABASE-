/**
 * Frontend/src/utils/roles.js
 *
 * Role helpers shared by the whole frontend.
 *
 * NOTE: these helpers only shape the UI (menus, route guards, labels).
 * They are NOT a security boundary. FastAPI enforces every permission
 * independently, and the user-management API also returns a per-row
 * `permissions` object so the UI never re-implements the backend rules.
 */

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
}

export const ROLE_LABELS = {
  user: 'User',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

/**
 * super_admin -> superadmin
 * Unknown / missing roles fail closed to `user`.
 */
export function normalizeRole(role) {
  if (role === 'super_admin') {
    return ROLES.SUPERADMIN
  }

  if (
    role === ROLES.USER ||
    role === ROLES.ADMIN ||
    role === ROLES.SUPERADMIN
  ) {
    return role
  }

  return ROLES.USER
}

export function isAdminRole(role) {
  const normalized = normalizeRole(role)

  return (
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SUPERADMIN
  )
}

export function isSuperAdminRole(role) {
  return normalizeRole(role) === ROLES.SUPERADMIN
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)]
}

/**
 * Normalize a user object coming from the backend
 * (login response, /users/me, localStorage ...).
 */
export function normalizeUser(user) {
  if (!user) {
    return null
  }

  return {
    ...user,
    role: normalizeRole(user.role),
    is_active: user.is_active !== false,
  }
}
