import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import SecurityIcon from '@mui/icons-material/Security'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      bgcolor="#F8FAFC"
      gap={2}
      px={2}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #1976D2, #1565C0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(25,118,210,0.25)',
          mb: 1,
        }}
      >
        <SecurityIcon sx={{ color: '#fff', fontSize: 34 }} />
      </Box>

      <Typography
        fontWeight={800}
        sx={{ fontSize: { xs: '5rem', sm: '7rem' }, lineHeight: 1, color: '#E2E8F0' }}
      >
        404
      </Typography>

      <Typography variant="h5" fontWeight={700} color="text.primary">
        Page not found
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={340}>
        The page you're looking for doesn't exist or has been moved. Head back to the dashboard to continue.
      </Typography>

      <Button
        variant="contained"
        startIcon={<HomeIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mt: 1 }}
      >
        Go to Dashboard
      </Button>
    </Box>
  )
}