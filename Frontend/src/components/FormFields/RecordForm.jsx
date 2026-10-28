import { Box, Button, CircularProgress, Card, CardContent } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { useForm } from 'react-hook-form'
import {
  RHFTextField,
  RHFSelect,
  RHFAutocomplete,
  RHFDate,
  SectionLabel,
  FormGrid,
} from './index'
import {
  VENDOR_OPTIONS,
  BUSINESS_UNITS,
  IT_SPOKES,
  BUSINESS_SPOKES,
} from '../../constants'

const DEFAULTS = {
  username: '',
  applicationName: '',
  businessUnit: '',
  itSpoke: '',
  businessSpoke: '',
  vendor: '',
  dateIssued: '',
  expiryDate: '',
  notes: '',
}

/*
 * Backend returns API records using snake_case.
 * The form uses camelCase field names.
 *
 * This function converts an existing backend record into
 * the format expected by react-hook-form.
 */
const normalizeDefaultValues = (values = {}) => ({
  username: values.username ?? '',
  applicationName: values.applicationName ?? values.application_name ?? '',
  businessUnit: values.businessUnit ?? values.business_unit ?? '',
  itSpoke: values.itSpoke ?? values.it_spoke ?? '',
  businessSpoke: values.businessSpoke ?? values.business_spoke ?? '',
  vendor: values.vendor ?? '',
  dateIssued: values.dateIssued ?? values.date_issued ?? '',
  expiryDate: values.expiryDate ?? values.expiry_date ?? '',
  notes: values.notes ?? '',
})

export default function RecordForm({
  defaultValues = DEFAULTS,
  onSubmit,
  loading,
  submitLabel = 'Save Record',
  onCancel,
}) {
  const normalizedDefaults = normalizeDefaultValues(defaultValues)

  const {
    control,
    handleSubmit,
    watch,
  } = useForm({
    defaultValues: normalizedDefaults,
  })

  const dateIssued = watch('dateIssued')

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <Card
        elevation={0}
        sx={{
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          {/* User & Application */}
          <SectionLabel>User & Application</SectionLabel>

          <FormGrid>
            <RHFTextField
              name="username"
              control={control}
              label="Username *"
              size="small"
              rules={{
                required: 'Username is required.',
                minLength: {
                  value: 2,
                  message: 'Min 2 characters.',
                },
              }}
            />

            <RHFTextField
              name="applicationName"
              control={control}
              label="Application Name *"
              size="small"
              rules={{
                required: 'Application name is required.',
              }}
            />
          </FormGrid>

          {/* Organisation */}
          <SectionLabel>Organisation</SectionLabel>

          <FormGrid>
            <RHFAutocomplete
              name="businessUnit"
              control={control}
              label="Business Unit *"
              options={BUSINESS_UNITS}
              rules={{
                required: 'Business unit is required.',
              }}
            />

            <RHFAutocomplete
              name="itSpoke"
              control={control}
              label="IT Spoke *"
              options={IT_SPOKES}
              rules={{
                required: 'IT Spoke is required.',
              }}
            />

            <RHFAutocomplete
              name="businessSpoke"
              control={control}
              label="Business Spoke *"
              options={BUSINESS_SPOKES}
              rules={{
                required: 'Business Spoke is required.',
              }}
            />

            <RHFSelect
              name="vendor"
              control={control}
              label="Vendor *"
              options={VENDOR_OPTIONS}
              rules={{
                required: 'Vendor is required.',
              }}
            />
          </FormGrid>

          {/* Key Validity */}
          <SectionLabel>Key Validity</SectionLabel>

          <FormGrid>
            <RHFDate
              name="dateIssued"
              control={control}
              label="Date Issued *"
              rules={{
                required: 'Issue date is required.',
              }}
            />

            <RHFDate
              name="expiryDate"
              control={control}
              label="Expiry Date *"
              rules={{
                required: 'Expiry date is required.',
                validate: (value) =>
                  !dateIssued ||
                  value > dateIssued ||
                  'Expiry must be after issue date.',
              }}
            />
          </FormGrid>

          {/* Notes */}
          <SectionLabel>Notes</SectionLabel>

          <RHFTextField
            name="notes"
            control={control}
            label="Notes (optional)"
            multiline
            rows={3}
            size="small"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <Box
        display="flex"
        justifyContent="flex-end"
        gap={1.5}
        mt={3}
      >
        {onCancel && (
          <Button
            variant="outlined"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress
                size={18}
                color="inherit"
              />
            ) : (
              <SaveIcon />
            )
          }
        >
          {loading ? 'Saving…' : submitLabel}
        </Button>
      </Box>
    </Box>
  )
}