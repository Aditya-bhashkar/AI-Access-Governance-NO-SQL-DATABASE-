/**
 * Frontend/src/pages/AuditLogs/index.jsx
 *
 * Organization-level audit log (admin + superadmin).
 * Uses the existing GET /audits/recent endpoint, which the backend
 * restricts to admins and superadmins. Includes the user-management
 * events (role changes, activation, deletion ...).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { auditAPI } from '../../services/apiService'
import EmptyState from '../../components/EmptyState'
import { formatDateTime } from '../../utils/dateUtils'

const ACTION_COLORS = {
  CREATE: 'success',
  USER_CREATED: 'success',
  ADMIN_CREATED: 'success',
  USER_ACTIVATED: 'success',
  UPDATE: 'info',
  USER_UPDATED: 'info',
  ROLE_CHANGED: 'warning',
  ADMIN_DEMOTED: 'warning',
  USER_DEACTIVATED: 'warning',
  DELETE: 'error',
  USER_DELETED: 'error',
}

// Metadata keys worth showing, in display order.
const DETAIL_KEYS = [
  'target_email',
  'application_name',
  'vendor',
  'old_role',
  'new_role',
  'old_status',
  'new_status',
  'changed_fields',
]

function describe(metadata = {}) {
  return DETAIL_KEYS.filter(
    (key) => metadata[key] !== undefined && metadata[key] !== null
  )
    .map((key) => {
      const value = Array.isArray(metadata[key])
        ? metadata[key].join(', ')
        : String(metadata[key])

      return `${key.replace(/_/g, ' ')}: ${value}`
    })
    .join(' · ')
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [entityType, setEntityType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await auditAPI.getRecent(
        200,
        entityType || null
      )

      setLogs(Array.isArray(response?.logs) ? response.logs : [])
    } catch (e) {
      setError(e?.message || 'Failed to load audit logs.')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [entityType])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Box>
      <Box
        display="flex"
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Audit Logs
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Most recent activity across the system.
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <MenuItem value="">All activity</MenuItem>
            <MenuItem value="api_access">API access records</MenuItem>
            <MenuItem value="user">User management</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Performed by</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton animation="wave" height={20} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ border: 0 }}>
                    <EmptyState title="No audit entries" />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id || log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.timestamp)}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={log.action}
                        size="small"
                        color={ACTION_COLORS[log.action] || 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {log.entity_type === 'user'
                          ? 'User account'
                          : 'API access'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {log.performed_by_name || 'Unknown'}
                      </Typography>
                      {log.performed_by_email && (
                        <Typography variant="caption" color="text.secondary">
                          {log.performed_by_email}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {describe(log.metadata) || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
