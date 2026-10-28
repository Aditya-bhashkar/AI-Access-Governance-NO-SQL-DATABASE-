import { Chip } from '@mui/material'
import { STATUS } from '../../constants'

const CFG = {
  [STATUS.ACTIVE]: { color: 'success', label: 'Active' },
  [STATUS.EXPIRED]: { color: 'error', label: 'Expired' },
  [STATUS.EXPIRING_SOON]: { color: 'warning', label: 'Expiring Soon' },
}

export default function StatusBadge({ status }) {
  const { color, label } = CFG[status] ?? { color: 'default', label: status }
  return (
    <Chip
      label={label}
      color={color}
      size="small"
      variant="filled"
      sx={{ fontWeight: 700, fontSize: '0.7rem', borderRadius: '6px', letterSpacing: '0.02em' }}
    />
  )
}