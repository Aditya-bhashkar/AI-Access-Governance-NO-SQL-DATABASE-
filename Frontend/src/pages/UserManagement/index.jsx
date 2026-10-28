/**
 * Frontend/src/pages/UserManagement/index.jsx
 *
 * Role-aware user management.
 *
 *   ADMIN       -> lists and manages NORMAL USERS only
 *   SUPERADMIN  -> lists and manages users and admins
 *
 * The same component is reused by AdminManagement (fixedRole="admin").
 *
 * Which buttons appear on a row is decided by the `permissions` object
 * the BACKEND returns for each row, so the UI never re-implements the
 * RBAC rules. Hiding a button is only UX: FastAPI re-checks every call.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'

import { userAPI } from '../../services/apiService'
import { useAuth } from '../../context/AuthContext'
import SearchBar from '../../components/SearchBar'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import { ROWS_PER_PAGE_OPTIONS } from '../../constants'
import { formatDate } from '../../utils'
import { ROLES, ROLE_LABELS, normalizeRole } from '../../utils/roles'

// -----------------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------------

const COLUMNS = [
  { id: 'name', label: 'Name', minWidth: 160 },
  { id: 'email', label: 'Email', minWidth: 210 },
  { id: 'role', label: 'Role', minWidth: 110 },
  { id: 'status', label: 'Status', minWidth: 110 },
  { id: 'created_at', label: 'Created At', minWidth: 120 },
  { id: 'actions', label: 'Actions', minWidth: 190, align: 'center' },
]

function RoleChip({ role }) {
  const normalized = normalizeRole(role)

  const color =
    normalized === ROLES.SUPERADMIN
      ? 'primary'
      : normalized === ROLES.ADMIN
        ? 'info'
        : 'default'

  return (
    <Chip
      label={ROLE_LABELS[normalized]}
      color={color}
      variant={normalized === ROLES.USER ? 'outlined' : 'filled'}
      size="small"
      sx={{ fontWeight: 700, fontSize: '0.7rem', borderRadius: '6px' }}
    />
  )
}

function StatusChip({ active }) {
  return (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      color={active ? 'success' : 'default'}
      size="small"
      sx={{ fontWeight: 700, fontSize: '0.7rem', borderRadius: '6px' }}
    />
  )
}

function DetailRow({ label, children }) {
  return (
    <Box display="flex" justifyContent="space-between" gap={2} py={1}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">
        {children}
      </Typography>
    </Box>
  )
}

const EMPTY_ADMIN_FORM = { name: '', email: '', password: '' }

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function UserManagement({
  fixedRole = null,
  title = 'User Management',
  subtitle,
}) {
  const { user: me, isSuperAdmin } = useAuth()

  // list state
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // filters / paging
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // dialogs
  const [viewTarget, setViewTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '' })
  const [roleTarget, setRoleTarget] = useState(null)
  const [roleChoice, setRoleChoice] = useState(ROLES.USER)
  const [createOpen, setCreateOpen] = useState(false)
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM)
  const [confirm, setConfirm] = useState(null) // {type, user, role?}

  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  const canCreateAdmin = isSuperAdmin && fixedRole === ROLES.ADMIN
  const effectiveRole = fixedRole || roleFilter

  // ---------------------------------------------------------------------------
  // Data loading (server-side filtering and pagination)
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await userAPI.list({
        page: page + 1,
        limit: rowsPerPage,
        search,
        role: effectiveRole,
        is_active:
          statusFilter === ''
            ? undefined
            : statusFilter === 'active',
      })

      setRows(response.data)
      setTotal(response.pagination?.total ?? response.data.length)

      // The last row of the last page was removed.
      if (response.data.length === 0 && page > 0) {
        setPage((p) => Math.max(0, p - 1))
      }
    } catch (e) {
      setError(e?.message || 'Failed to load users.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, search, effectiveRole, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const notify = (msg, sev = 'success') =>
    setSnack({ open: true, msg, sev })

  const handleSearch = useCallback((query) => {
    setSearch(query)
    setPage(0)
  }, [])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const openEdit = (user) => {
    setDialogError('')
    setEditForm({ name: user.name, email: user.email })
    setEditTarget(user)
  }

  const submitEdit = async () => {
    const changes = {}

    if (editForm.name.trim() !== editTarget.name) {
      changes.name = editForm.name.trim()
    }

    if (editForm.email.trim() !== editTarget.email) {
      changes.email = editForm.email.trim()
    }

    if (Object.keys(changes).length === 0) {
      setEditTarget(null)
      return
    }

    setBusy(true)
    setDialogError('')

    try {
      await userAPI.updateUser(editTarget.id, changes)
      setEditTarget(null)
      notify('User updated.')
      load()
    } catch (e) {
      setDialogError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openRoleDialog = (user) => {
    setRoleChoice(normalizeRole(user.role))
    setRoleTarget(user)
  }

  const reviewRoleChange = () => {
    setConfirm({ type: 'role', user: roleTarget, role: roleChoice })
    setRoleTarget(null)
  }

  const submitCreateAdmin = async () => {
    setDialogError('')

    if (
      !adminForm.name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email) ||
      adminForm.password.length < 8
    ) {
      setDialogError(
        'Enter a name, a valid email and a password of at least 8 characters.'
      )
      return
    }

    setBusy(true)

    try {
      await userAPI.createAdmin({
        name: adminForm.name.trim(),
        email: adminForm.email.trim(),
        password: adminForm.password,
      })
      setCreateOpen(false)
      setAdminForm(EMPTY_ADMIN_FORM)
      notify('Admin account created.')
      load()
    } catch (e) {
      setDialogError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const runConfirmed = async () => {
    if (!confirm) return

    setBusy(true)

    try {
      const { type, user, role } = confirm

      if (type === 'delete') {
        await userAPI.deleteUser(user.id)
        notify('User deleted.')
      } else if (type === 'deactivate') {
        await userAPI.updateStatus(user.id, false)
        notify('User deactivated.')
      } else if (type === 'activate') {
        await userAPI.updateStatus(user.id, true)
        notify('User activated.')
      } else if (type === 'role') {
        await userAPI.updateRole(user.id, role)
        notify(`Role changed to ${ROLE_LABELS[role]}.`)
      }

      setConfirm(null)
      load()
    } catch (e) {
      setConfirm(null)
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmProps = (() => {
    if (!confirm) return {}

    const { type, user, role } = confirm
    const who = `"${user.name}" (${user.email})`

    switch (type) {
      case 'delete':
        return {
          title: 'Delete User',
          message: `Permanently delete ${who}? Their API access records are kept. This cannot be undone.`,
          confirmLabel: 'Delete',
          severity: 'error',
          loadingLabel: 'Deleting…',
        }

      case 'deactivate':
        return {
          title: 'Deactivate User',
          message: `Deactivate ${who}? They will be signed out and unable to log in until reactivated.`,
          confirmLabel: 'Deactivate',
          severity: 'error',
          loadingLabel: 'Deactivating…',
        }

      case 'activate':
        return {
          title: 'Activate User',
          message: `Reactivate ${who}? They will be able to log in again.`,
          confirmLabel: 'Activate',
          severity: 'primary',
          loadingLabel: 'Activating…',
        }

      default: {
        const demote =
          normalizeRole(user.role) === ROLES.ADMIN &&
          role === ROLES.USER

        return {
          title: demote ? 'Demote Admin' : 'Change Role',
          message: demote
            ? `Demote ${who} to User? They will immediately lose all administrative access.`
            : `Change ${who} from ${ROLE_LABELS[normalizeRole(user.role)]} to ${ROLE_LABELS[role]}? The change takes effect immediately.`,
          confirmLabel: demote ? 'Demote' : 'Change Role',
          severity: 'warning',
          loadingLabel: 'Saving…',
        }
      }
    }
  })()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeFilters =
    (roleFilter && !fixedRole ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (search ? 1 : 0)

  return (
    <Box>
      {/* Header */}
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
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {subtitle ||
              (isSuperAdmin
                ? 'Manage users and administrators.'
                : 'Manage normal user accounts.')}
            {` · ${total} account${total !== 1 ? 's' : ''}`}
          </Typography>
        </Box>

        {canCreateAdmin && (
          <Button
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
            onClick={() => {
              setDialogError('')
              setAdminForm(EMPTY_ADMIN_FORM)
              setCreateOpen(true)
            }}
          >
            Create Admin
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <Card
        elevation={0}
        sx={{ border: '1px solid #E2E8F0', mb: 2, borderRadius: '14px' }}
      >
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ lg: 'center' }}
            flexWrap="wrap"
          >
            <SearchBar
              onSearch={handleSearch}
              value={search}
              placeholder="Search name or email…"
            />

            {isSuperAdmin && !fixedRole && (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setPage(0)
                  }}
                >
                  <MenuItem value="">All Roles</MenuItem>
                  <MenuItem value={ROLES.USER}>User</MenuItem>
                  <MenuItem value={ROLES.ADMIN}>Admin</MenuItem>
                  <MenuItem value={ROLES.SUPERADMIN}>Superadmin</MenuItem>
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            {activeFilters > 0 && (
              <Chip
                label={`Clear (${activeFilters})`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
                onDelete={() => {
                  setSearch('')
                  setRoleFilter('')
                  setStatusFilter('')
                  setPage(0)
                }}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((col) => (
                      <TableCell key={col.id}>
                        <Skeleton animation="wave" height={20} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} sx={{ border: 0 }}>
                    <EmptyState
                      title="No accounts found"
                      subtitle="Try adjusting your search or filters."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const perms = row.permissions || {}
                  const isMe = row.id === me?.id

                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight={600}>
                            {row.name}
                          </Typography>
                          {isMe && (
                            <Chip
                              label="You"
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {row.email}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <RoleChip role={row.role} />
                      </TableCell>

                      <TableCell>
                        <StatusChip active={row.is_active} />
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(row.created_at)}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={0.25}>
                          {perms.view && (
                            <Tooltip title="View">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setViewTarget(row)}
                              >
                                <VisibilityOutlinedIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          {perms.edit && (
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => openEdit(row)}
                              >
                                <EditOutlinedIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          {perms.change_role && (
                            <Tooltip title="Change role">
                              <IconButton
                                size="small"
                                onClick={() => openRoleDialog(row)}
                              >
                                <ManageAccountsOutlinedIcon
                                  sx={{ fontSize: 18 }}
                                />
                              </IconButton>
                            </Tooltip>
                          )}

                          {perms.change_status &&
                            (row.is_active ? (
                              <Tooltip title="Deactivate">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() =>
                                    setConfirm({
                                      type: 'deactivate',
                                      user: row,
                                    })
                                  }
                                >
                                  <BlockOutlinedIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Activate">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() =>
                                    setConfirm({
                                      type: 'activate',
                                      user: row,
                                    })
                                  }
                                >
                                  <CheckCircleOutlineIcon
                                    sx={{ fontSize: 17 }}
                                  />
                                </IconButton>
                              </Tooltip>
                            ))}

                          {perms.delete && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setConfirm({ type: 'delete', user: row })
                                }
                              >
                                <DeleteOutlineOutlinedIcon
                                  sx={{ fontSize: 17 }}
                                />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value))
            setPage(0)
          }}
          sx={{ borderTop: '1px solid #E2E8F0', fontSize: '0.8rem' }}
        />
      </Paper>

      {/* View dialog */}
      <Dialog
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Account Details</DialogTitle>
        <DialogContent>
          {viewTarget && (
            <Box>
              <DetailRow label="Name">{viewTarget.name}</DetailRow>
              <DetailRow label="Email">{viewTarget.email}</DetailRow>
              <DetailRow label="Role">
                <RoleChip role={viewTarget.role} />
              </DetailRow>
              <DetailRow label="Status">
                <StatusChip active={viewTarget.is_active} />
              </DetailRow>
              <DetailRow label="Created">
                {formatDate(viewTarget.created_at)}
              </DetailRow>
              <DetailRow label="Last updated">
                {formatDate(viewTarget.updated_at)}
              </DetailRow>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setViewTarget(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onClose={() => !busy && setEditTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}

            <TextField
              label="Full name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              fullWidth
            />

            <TextField
              label="Email address"
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, email: e.target.value }))
              }
              fullWidth
            />

            <Typography variant="caption" color="text.secondary">
              Role, status and password are managed through their own
              actions.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => setEditTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              busy || !editForm.name.trim() || !editForm.email.trim()
            }
            onClick={submitEdit}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role dialog (superadmin) */}
      <Dialog
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          {roleTarget && (
            <Stack spacing={2.5} mt={1}>
              <Typography variant="body2" color="text.secondary">
                {roleTarget.name} ({roleTarget.email}) is currently{' '}
                <b>{ROLE_LABELS[normalizeRole(roleTarget.role)]}</b>.
              </Typography>

              <TextField
                select
                label="New role"
                value={roleChoice}
                onChange={(e) => setRoleChoice(e.target.value)}
                fullWidth
              >
                <MenuItem value={ROLES.USER}>User</MenuItem>
                <MenuItem value={ROLES.ADMIN}>Admin</MenuItem>
              </TextField>

              <Typography variant="caption" color="text.secondary">
                Superadmin accounts cannot be created or changed here.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setRoleTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              !roleTarget ||
              roleChoice === normalizeRole(roleTarget?.role)
            }
            onClick={reviewRoleChange}
          >
            Review change
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create admin dialog (superadmin) */}
      <Dialog
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create Admin Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}

            <TextField
              label="Full name"
              value={adminForm.name}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, name: e.target.value }))
              }
              fullWidth
            />

            <TextField
              label="Email address"
              type="email"
              value={adminForm.email}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, email: e.target.value }))
              }
              fullWidth
            />

            <TextField
              label="Temporary password"
              type="password"
              autoComplete="new-password"
              helperText="At least 8 characters."
              value={adminForm.password}
              onChange={(e) =>
                setAdminForm((f) => ({ ...f, password: e.target.value }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => setCreateOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={submitCreateAdmin}
          >
            {busy ? 'Creating…' : 'Create Admin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation (existing shared component) */}
      <ConfirmDialog
        open={!!confirm}
        {...confirmProps}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => !busy && setConfirm(null)}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.sev}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
