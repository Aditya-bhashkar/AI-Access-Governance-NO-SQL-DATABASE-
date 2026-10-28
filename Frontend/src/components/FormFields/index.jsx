import { TextField, MenuItem, FormControl, InputLabel, Select, FormHelperText, Box, Typography, Autocomplete } from '@mui/material'
import { Controller } from 'react-hook-form'

export function RHFTextField({ name, control, label, rules, multiline, rows, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          label={label}
          error={!!error}
          helperText={error?.message}
          fullWidth
          multiline={multiline}
          rows={rows}
          {...rest}
        />
      )}
    />
  )
}

export function RHFSelect({ name, control, label, rules, options, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <FormControl fullWidth error={!!error} size="small">
          <InputLabel>{label}</InputLabel>
          <Select {...field} label={label} {...rest}>
            {options.map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </Select>
          {error && <FormHelperText>{error.message}</FormHelperText>}
        </FormControl>
      )}
    />
  )
}

/**
 * RHFAutocomplete — a "writable dropdown".
 *
 * Shows the given `options` as suggestions, but freeSolo lets the user type
 * any custom value that isn't in the list. Whatever the user types is what
 * gets saved to the form field (and ultimately to the database) — it is
 * NOT restricted to the suggested options.
 */
export function RHFAutocomplete({ name, control, label, rules, options, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value, ...field }, fieldState: { error } }) => (
        <Autocomplete
          {...field}
          freeSolo
          options={options}
          value={value ?? ''}
          onChange={(_, newValue) => onChange(newValue ?? '')}
          onInputChange={(_, newInputValue, reason) => {
            // Keep the typed text in sync even when it doesn't match a suggestion
            if (reason !== 'reset') onChange(newInputValue)
          }}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              error={!!error}
              helperText={error?.message}
            />
          )}
          {...rest}
        />
      )}
    />
  )
}

/**
 * RHFDate — native `<input type="date">` field.
 *
 * IMPORTANT: `InputLabelProps={{ shrink: true }}` was the correct way to
 * force the floating label to stay shrunk (sitting on the border) in
 * MUI v5/v6/v7. That prop was deprecated in v6/v7 and FULLY REMOVED in v9
 * (see: https://mui.com/material-ui/migration/upgrade-to-v9/). Without a
 * shrunk label, MUI's floating label renders inside the input box at the
 * same position as the browser's own native "dd-mm-yyyy" placeholder,
 * producing garbled overlapping text. The fix is `slotProps.inputLabel`,
 * the v6+/v9-correct replacement API — this works the same way but through
 * the new prop name.
 */
export function RHFDate({ name, control, label, rules, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          label={label}
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          error={!!error}
          helperText={error?.message}
          fullWidth
          size="small"
          {...rest}
        />
      )}
    />
  )
}

export function SectionLabel({ children }) {
  return (
    <Box sx={{ borderBottom: '1px solid #E2E8F0', pb: 0.5, mb: 2, mt: 3 }}>
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: '#94A3B8',
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

export function FormGrid({ children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
      {children}
    </Box>
  )
}