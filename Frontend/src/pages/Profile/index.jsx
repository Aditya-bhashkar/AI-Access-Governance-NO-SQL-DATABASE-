/**
 * Frontend/src/pages/Profile/index.jsx
 *
 * Read-only view of the authenticated user's own profile.
 * Data is re-fetched from the backend (GET /users/me) so the role and
 * status shown are always the server's current values.
 */

import { useEffect } from 'react'
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from '@mui/material'

import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils'
import { ROLES, ROLE_LABELS, normalizeRole } from '../../utils/roles'

const ROLE_DESCRIPTION = {
  [ROLES.USER]:
    'You can manage your own API access records, analytics and audit history.',
  [ROLES.ADMIN]:
    'You can govern all API access records and manage normal user accounts.',
  [ROLES.SUPERADMIN]:
    'You have full administrative authority, including managing administrators.',
}

function Row({ label, children }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2} py={1.25}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">
        {children}
      </Typography>
    </Box>
  )
}

export default function Profile() {
  const { user, refreshUser } = useAuth()

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  if (!user) {
    return null
  }

  const role = normalizeRole(user.role)

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Box maxWidth={640}>
      <Typography variant="h4" fontWeight={800} mb={0.5}>
        My Profile
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Your account information.
      </Typography>

      <Card elevation={0} sx={{ border: '1px solid #E2E8F0' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Box display="flex" alignItems="center" gap={2} mb={2.5}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: '#1976D2',
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>

            <Box>
              <Typography variant="h6">{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>

          <Divider />

          <Row label="Role">
            <Chip
              label={ROLE_LABELS[role]}
              color={role === ROLES.USER ? 'default' : 'primary'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Row>

          <Row label="Account status">
            <Chip
              label={user.is_active ? 'Active' : 'Inactive'}
              color={user.is_active ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Row>

          <Row label="Member since">{formatDate(user.created_at)}</Row>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" color="text.secondary">
            {ROLE_DESCRIPTION[role]}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
