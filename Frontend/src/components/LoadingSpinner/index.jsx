import { Box, CircularProgress, Typography } from '@mui/material'

export default function LoadingSpinner({ message = 'Loading…', fullPage = false }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      sx={fullPage ? { minHeight: '70vh' } : { py: 8 }}
    >
      <CircularProgress size={38} thickness={4} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  )
}