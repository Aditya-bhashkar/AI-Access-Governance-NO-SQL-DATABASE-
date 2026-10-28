import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import VpnKeyIcon from '@mui/icons-material/VpnKeyOutlined'
import AddIcon from '@mui/icons-material/AddCircleOutlineOutlined'
import SecurityIcon from '@mui/icons-material/Security'
import HistoryIcon from '@mui/icons-material/History'
import PeopleIcon from '@mui/icons-material/PeopleOutlined'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import PersonIcon from '@mui/icons-material/PersonOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  normalizeRole,
  isAdminRole,
} from '../../utils/roles'

const W = 236
const CW = 64

/**
 * Role-aware navigation.
 *
 * USER        Dashboard, My API Access, Add Record, Profile
 * ADMIN       + Audit Logs, User Management
 * SUPERADMIN  + Admin Management
 *
 * Hiding an item is only a UX convenience: every page / API behind it
 * is protected by ProtectedRoute and, above all, by FastAPI.
 */
function buildNav(role) {
  const items = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      Icon: DashboardIcon,
    },
    {
      label:
        role === ROLES.USER
          ? 'My API Access'
          : 'API Access Records',
      path: '/records',
      Icon: VpnKeyIcon,
    },
    {
      label: 'Add Record',
      path: '/records/add',
      Icon: AddIcon,
    },
  ]

  if (isAdminRole(role)) {
    items.push(
      {
        label: 'Audit Logs',
        path: '/audit',
        Icon: HistoryIcon,
      },
      {
        label: 'User Management',
        path: '/users',
        Icon: PeopleIcon,
      }
    )
  }

  if (role === ROLES.SUPERADMIN) {
    items.push({
      label: 'Admin Management',
      path: '/admins',
      Icon: AdminPanelSettingsIcon,
    })
  }

  items.push({
    label: 'Profile',
    path: '/profile',
    Icon: PersonIcon,
  })

  return items
}

function formatRole(role) {
  switch (role) {
    case 'superadmin':
      return 'Superadmin Portal'

    case 'admin':
      return 'Admin Portal'

    default:
      return 'User Portal'
  }
}

export default function Sidebar({
  open,
  variant = 'persistent',
  onClose,
}) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  const collapsed =
    !open && variant === 'persistent'

  const w = collapsed ? CW : W

  const role = normalizeRole(user?.role)
  const portalLabel = formatRole(role)
  const navItems = buildNav(role)

  // The most specific matching item wins, so "/records/add" does not
  // also highlight "/records".
  const activePath = navItems
    .filter(
      ({ path }) =>
        pathname === path ||
        pathname.startsWith(`${path}/`)
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path

  const closeIfTemporary = () => {
    if (variant === 'temporary') {
      onClose?.()
    }
  }

  const handleLogout = () => {
    closeIfTemporary()
    logout()
    nav('/login')
  }

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: w,
        flexShrink: 0,

        '& .MuiDrawer-paper': {
          width: w,
          boxSizing: 'border-box',
          border: 'none',
          borderRight: '1px solid #E2E8F0',
          transition: 'width 200ms ease',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Brand */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          px: collapsed ? 1.5 : 2.5,
          gap: 1.5,
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background:
              'linear-gradient(135deg,#1976D2,#1565C0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SecurityIcon
            sx={{
              color: '#fff',
              fontSize: 20,
            }}
          />
        </Box>

        {!collapsed && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#1E293B',
                lineHeight: 1.2,
              }}
            >
              API Governance
            </Typography>

            <Typography
              sx={{
                fontSize: '0.7rem',
                color: '#94A3B8',
              }}
            >
              {portalLabel}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      <List
        sx={{
          pt: 1.5,
          flex: 1,
        }}
      >
        {navItems.map(
          ({
            label,
            path,
            Icon,
          }) => {
            const active = path === activePath

            return (
              <Tooltip
                title={collapsed ? label : ''}
                placement="right"
                key={path}
              >
                <ListItemButton
                  selected={active}
                  onClick={() => {
                    nav(path)

                    // Close temporary drawer on mobile
                    closeIfTemporary()
                  }}
                  sx={{
                    minHeight: 44,
                    justifyContent: collapsed
                      ? 'center'
                      : 'flex-start',
                    px: collapsed ? 1.5 : 2,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 38,
                      color: active
                        ? '#1976D2'
                        : '#64748B',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon fontSize="small" />
                  </ListItemIcon>

                  {!collapsed && (
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: active
                          ? 600
                          : 400,
                        color: active
                          ? '#1976D2'
                          : '#1E293B',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            )
          }
        )}
      </List>

      <Divider />

      <List sx={{ py: 0.5 }}>
        <Tooltip
          title={collapsed ? 'Logout' : ''}
          placement="right"
        >
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 44,
              justifyContent: collapsed
                ? 'center'
                : 'flex-start',
              px: collapsed ? 1.5 : 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 38,
                color: '#D32F2F',
                justifyContent: 'center',
              }}
            >
              <LogoutIcon fontSize="small" />
            </ListItemIcon>

            {!collapsed && (
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  color: '#D32F2F',
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider />

      {!collapsed && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: '#CBD5E1',
            }}
          >
            v1.0 · Internal Use Only
          </Typography>
        </Box>
      )}
    </Drawer>
  )
}