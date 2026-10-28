import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FilterListIcon from '@mui/icons-material/FilterList'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRecords } from '../../context/RecordsContext'
import useTable from '../../hooks/useTable'
import RecordsTable from '../../components/Table'
import SearchBar from '../../components/SearchBar'
import ConfirmDialog from '../../components/ConfirmDialog'
import { VENDOR_OPTIONS, BUSINESS_UNITS, STATUS } from '../../constants'

export default function Records() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { records, loading, error, fetchRecords, removeRecord } = useRecords()
  const t = useTable(records)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    const s = searchParams.get('status')
    if (s) t.handleFilter('status', s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleDelete = async () => {
    setDelLoading(true)
    try {
      await removeRecord(deleteTarget.id)
      setSnack({ open: true, msg: 'Record deleted.', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Failed to delete.', sev: 'error' })
    } finally {
      setDelLoading(false)
      setDeleteTarget(null)
    }
  }

  const activeFilters = Object.values(t.filters).filter(Boolean).length

  return (
    <Box>
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
            API Access Records
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t.filtered.length} record{t.filtered.length !== 1 ? 's' : ''}
            {t.selected.length > 0 && ` · ${t.selected.length} selected`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/records/add')}>
          Add New Record
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <Card elevation={0} sx={{ border: '1px solid #E2E8F0', mb: 2, borderRadius: '14px' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ lg: 'center' }}
            flexWrap="wrap"
          >
            <SearchBar onSearch={t.handleSearch} value={t.search} />

            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <FilterListIcon sx={{ color: '#94A3B8', fontSize: 17 }} />

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Vendor</InputLabel>
                <Select
                  label="Vendor"
                  value={t.filters.vendor}
                  onChange={(e) => t.handleFilter('vendor', e.target.value)}
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {VENDOR_OPTIONS.map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Business Unit</InputLabel>
                <Select
                  label="Business Unit"
                  value={t.filters.businessUnit}
                  onChange={(e) => t.handleFilter('businessUnit', e.target.value)}
                >
                  <MenuItem value="">All Units</MenuItem>
                  {BUSINESS_UNITS.map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={t.filters.status}
                  onChange={(e) => t.handleFilter('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {Object.values(STATUS).map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {activeFilters > 0 && (
                <Chip
                  label={`Clear (${activeFilters})`}
                  size="small"
                  onDelete={t.resetFilters}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <RecordsTable
        rows={t.paginated}
        loading={loading}
        order={t.order}
        orderBy={t.orderBy}
        onSort={t.handleSort}
        page={t.page}
        rowsPerPage={t.rowsPerPage}
        totalCount={t.filtered.length}
        onPageChange={t.setPage}
        onRowsPerPage={t.setRowsPerPage}
        selected={t.selected}
        onSelectAll={t.handleSelectAll}
        onSelectRow={t.handleSelectRow}
        onView={(r) => navigate(`/records/${r.id}`)}
        onEdit={(r) => navigate(`/records/${r.id}/edit`)}
        onDelete={(r) => setDeleteTarget(r)}
        onDuplicate={(r) => navigate('/records/add', { state: { prefill: r } })}
        onAdd={() => navigate('/records/add')}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Record"
        message={`Permanently delete the record for "${deleteTarget?.username}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={delLoading}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.sev}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}