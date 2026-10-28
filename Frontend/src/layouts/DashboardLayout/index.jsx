import { useState, useEffect } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { Outlet } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'

export default function DashboardLayout() {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = useState(!mobile)

  useEffect(() => {
    setOpen(!mobile)
  }, [mobile])

  return (
    <Box
      display="flex"
      minHeight="100vh"
      width="100%"
      bgcolor="background.default"
    >
      <Navbar onMenuToggle={() => setOpen((p) => !p)} />

      <Sidebar
        open={open}
        variant={mobile ? 'temporary' : 'persistent'}
        onClose={() => setOpen(false)}
      />

      <Box
        component="main"
        flex={1}
        sx={{
          pt: '64px',
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}