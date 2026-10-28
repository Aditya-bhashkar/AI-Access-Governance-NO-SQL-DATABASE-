import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  Typography,
  ListItemIcon,
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { roleLabel } from '../../utils/roles'

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [anchor, setAnchor] = useState(null)

  const displayName =
    user?.name ||
    user?.username ||
    user?.email ||
    'User'

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleMenuClose = () => {
    setAnchor(null)
  }

  const handleLogout = () => {
    setAnchor(null)
    logout()
    navigate('/login')
  }

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) =>
          theme.zIndex.drawer + 1,
        bgcolor: '#fff',
        borderBottom:
          '1px solid #E2E8F0',
        color: 'text.primary',
      }}
    >
      <Toolbar
        sx={{
          height: 64,
          px: {
            xs: 2,
            sm: 3,
          },
        }}
      >
        <IconButton
          onClick={onMenuToggle}
          edge="start"
          sx={{
            mr: 1.5,
            color: '#475569',
          }}
          aria-label="Toggle navigation"
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="subtitle1"
          fontWeight={700}
          color="text.primary"
          noWrap
        >
          API Key Governance System
        </Typography>

        <Box flex={1} />

        <Tooltip title="Notifications">
          <IconButton
            sx={{
              color: '#475569',
            }}
          >
            <Badge
              badgeContent={3}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  minWidth: 16,
                  height: 16,
                },
              }}
            >
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Account">
          <IconButton
            onClick={(event) =>
              setAnchor(event.currentTarget)
            }
            sx={{ ml: 0.5 }}
            aria-label="Account menu"
            aria-haspopup="true"
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: '#1976D2',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={handleMenuClose}
          transformOrigin={{
            horizontal: 'right',
            vertical: 'top',
          }}
          anchorOrigin={{
            horizontal: 'right',
            vertical: 'bottom',
          }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 210,
              borderRadius: '12px',
            },
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={700}
            >
              {displayName}
            </Typography>

            {user?.email && (
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {user.email}
              </Typography>
            )}

            {user?.role && (
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
                sx={{ mt: 0.25 }}
              >
                {roleLabel(user.role)}
              </Typography>
            )}
          </Box>

          <Divider />

          <MenuItem
            onClick={() => {
              handleMenuClose()
              navigate('/profile')
            }}
          >
            <ListItemIcon>
              <PersonOutlinedIcon
                fontSize="small"
              />
            </ListItemIcon>
            Profile
          </MenuItem>

          <Divider />

          <MenuItem
            onClick={handleLogout}
            sx={{
              color: 'error.main',
            }}
          >
            <ListItemIcon>
              <LogoutIcon
                fontSize="small"
                color="error"
              />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}