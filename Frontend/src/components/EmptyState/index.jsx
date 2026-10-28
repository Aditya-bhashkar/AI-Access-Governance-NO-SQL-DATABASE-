import { Box, Typography, Button } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'

export default function EmptyState({ title = 'No data found', subtitle, actionLabel, onAction }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5} py={8}>
      <InboxIcon sx={{ fontSize: 60, color: '#CBD5E1' }} />
      <Typography variant="h6" fontWeight={600} color="text.primary">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={340}>
          {subtitle}
        </Typography>
      )}
      {onAction && actionLabel && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}