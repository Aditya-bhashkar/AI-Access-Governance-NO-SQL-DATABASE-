/**
 * Frontend/src/pages/AdminManagement/index.jsx
 *
 * Superadmin-only view of administrator accounts.
 *
 * Reuses the shared UserManagement page pinned to role="admin", so
 * there is a single table / dialog implementation to maintain. Route
 * access is limited to superadmins in App.jsx, and every API call is
 * authorized again by the backend.
 */

import UserManagement from '../UserManagement'
import { ROLES } from '../../utils/roles'

export default function AdminManagement() {
  return (
    <UserManagement
      fixedRole={ROLES.ADMIN}
      title="Admin Management"
      subtitle="Create, activate, deactivate or demote administrators."
    />
  )
}
