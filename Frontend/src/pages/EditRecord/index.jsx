import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
  Skeleton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate, useParams } from 'react-router-dom'
import { useRecords } from '../../context/RecordsContext'
import RecordForm from '../../components/FormFields/RecordForm'

export default function EditRecord() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getRecord, editRecord } = useRecords()

  const [record, setRecord] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadRecord = async () => {
      setFetchLoading(true)
      setFetchError('')

      try {
        const data = await getRecord(id)

        if (mounted) {
          setRecord(data)
        }
      } catch (error) {
        if (mounted) {
          setFetchError(
            error?.message ||
              'Record not found or could not be loaded.'
          )
        }
      } finally {
        if (mounted) {
          setFetchLoading(false)
        }
      }
    }

    if (id) {
      loadRecord()
    } else {
      setFetchLoading(false)
      setFetchError('Invalid record ID.')
    }

    return () => {
      mounted = false
    }
  }, [id, getRecord])

  const handleSubmit = async (data) => {
    setSaveError('')
    setSaveLoading(true)

    try {
      await editRecord(id, data)

      setSuccess(true)

      setTimeout(() => {
        navigate('/records')
      }, 1300)
    } catch (error) {
      setSaveError(
        error?.message || 'Failed to update record.'
      )
    } finally {
      setSaveLoading(false)
    }
  }

  const applicationName =
    record?.applicationName ??
    record?.application_name ??
    ''

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link
          underline="hover"
          color="inherit"
          onClick={() => navigate('/records')}
          sx={{
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          API Access Records
        </Link>

        <Typography
          variant="body2"
          color="text.primary"
        >
          Edit Record
        </Typography>
      </Breadcrumbs>

      <Box
        display="flex"
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        flexDirection={{
          xs: 'column',
          sm: 'row',
        }}
        gap={2}
        mb={3}
      >
        <Box>
          {fetchLoading ? (
            <Skeleton
              width={280}
              height={38}
            />
          ) : (
            <Typography
              variant="h4"
              fontWeight={800}
            >
              Edit API Record
            </Typography>
          )}

          {record && (
            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              {record.username || '—'} —{' '}
              {applicationName || '—'}
            </Typography>
          )}
        </Box>

        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size="small"
          onClick={() => navigate('/records')}
          disabled={saveLoading}
        >
          Back
        </Button>
      </Box>

      {fetchError && (
        <Alert
          severity="error"
          sx={{
            borderRadius: '10px',
            mb: 2,
          }}
        >
          {fetchError}
        </Alert>
      )}

      {saveError && (
        <Alert
          severity="error"
          sx={{
            borderRadius: '10px',
            mb: 2,
          }}
          onClose={() => setSaveError('')}
        >
          {saveError}
        </Alert>
      )}

      {fetchLoading ? (
        <Box
          display="flex"
          flexDirection="column"
          gap={2}
        >
          {Array.from({ length: 8 }).map(
            (_, index) => (
              <Skeleton
                key={index}
                height={52}
                sx={{
                  borderRadius: '10px',
                }}
              />
            )
          )}
        </Box>
      ) : record ? (
        <RecordForm
          defaultValues={record}
          onSubmit={handleSubmit}
          loading={saveLoading}
          submitLabel="Save Changes"
          onCancel={() => navigate('/records')}
        />
      ) : null}

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Alert
          severity="success"
          onClose={() => setSuccess(false)}
          sx={{
            borderRadius: '10px',
          }}
        >
          Record updated successfully! Redirecting…
        </Alert>
      </Snackbar>
    </Box>
  )
}