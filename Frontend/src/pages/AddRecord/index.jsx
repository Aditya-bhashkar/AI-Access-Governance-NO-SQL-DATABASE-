import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRecords } from '../../context/RecordsContext'
import RecordForm from '../../components/FormFields/RecordForm'

export default function AddRecord() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { addRecord } = useRecords()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const prefill = state?.prefill ? { ...state.prefill, dateIssued: '', expiryDate: '', notes: '' } : undefined

  const handleSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      await addRecord(data)
      setSuccess(true)
      setTimeout(() => navigate('/records'), 1300)
    } catch (e) {
      setError(e.message || 'Failed to create record. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link
          underline="hover"
          color="inherit"
          onClick={() => navigate('/records')}
          sx={{ cursor: 'pointer', fontSize: '0.875rem' }}
        >
          API Access Records
        </Link>
        <Typography variant="body2" color="text.primary">
          Add New Record
        </Typography>
      </Breadcrumbs>

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
            {prefill ? 'Duplicate Record' : 'Add New API Record'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {prefill
              ? 'Pre-filled from an existing record — update the dates before saving.'
              : 'Fill in all required fields to issue a new API access key.'}
          </Typography>
        </Box>
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size="small"
          onClick={() => navigate('/records')}
        >
          Back
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <RecordForm
        defaultValues={prefill}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Create Record"
        onCancel={() => navigate('/records')}
      />

      <Snackbar
        open={success}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" sx={{ borderRadius: '10px' }}>
          Record created successfully! Redirecting…
        </Alert>
      </Snackbar>
    </Box>
  )
}