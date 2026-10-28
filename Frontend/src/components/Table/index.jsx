import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Checkbox,
  IconButton,
  Tooltip,
  Box,
  Skeleton,
  Typography,
} from '@mui/material'

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import StatusBadge from '../StatusBadge'
import EmptyState from '../EmptyState'
import { formatDate } from '../../utils'
import { TABLE_COLUMNS, ROWS_PER_PAGE_OPTIONS } from '../../constants'

function SkeletonRows({ cols }) {
  return Array.from({ length: 7 }).map((_, i) => (
    <TableRow key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton animation="wave" height={20} />
        </TableCell>
      ))}
    </TableRow>
  ))
}

export default function RecordsTable({
  rows,
  loading,
  order,
  orderBy,
  onSort,
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPage,
  selected,
  onSelectAll,
  onSelectRow,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onAdd,
}) {
  const allSel =
    rows.length > 0 &&
    rows.every((r) => selected.includes(r.id))

  const someSel =
    rows.some((r) => selected.includes(r.id)) &&
    !allSel

  const colCount = TABLE_COLUMNS.length + 1

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <TableContainer
        sx={{
          maxHeight: 'calc(100vh - 330px)',
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                padding="checkbox"
                sx={{
                  background: '#F1F5F9 !important',
                }}
              >
                <Checkbox
                  indeterminate={someSel}
                  checked={allSel}
                  onChange={(e) =>
                    onSelectAll(e, rows)
                  }
                  size="small"
                />
              </TableCell>

              {TABLE_COLUMNS.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align}
                  style={{
                    minWidth: col.minWidth,
                  }}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={
                        orderBy === col.id
                          ? order
                          : 'asc'
                      }
                      onClick={() =>
                        onSort(col.id)
                      }
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <SkeletonRows cols={colCount} />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  sx={{ border: 0 }}
                >
                  <EmptyState
                    title="No records found"
                    subtitle="Try adjusting your search or filters, or add a new record."
                    actionLabel="Add Record"
                    onAction={onAdd}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSel = selected.includes(row.id)

                const applicationName =
                  row.applicationName ??
                  row.application_name ??
                  ''

                const businessUnit =
                  row.businessUnit ??
                  row.business_unit ??
                  ''

                const itSpoke =
                  row.itSpoke ??
                  row.it_spoke ??
                  ''

                const businessSpoke =
                  row.businessSpoke ??
                  row.business_spoke ??
                  ''

                const dateIssued =
                  row.dateIssued ??
                  row.date_issued ??
                  ''

                const expiryDate =
                  row.expiryDate ??
                  row.expiry_date ??
                  ''

                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isSel}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSel}
                        onChange={() =>
                          onSelectRow(row.id)
                        }
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                      >
                        {row.username}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {applicationName}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {businessUnit}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {itSpoke}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {businessSpoke}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color="primary.main"
                      >
                        {row.vendor}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(dateIssued)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(expiryDate)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>

                    <TableCell align="center">
                      <Box
                        display="flex"
                        gap={0.25}
                        justifyContent="center"
                      >
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              onView(row)
                            }
                          >
                            <VisibilityOutlinedIcon
                              sx={{ fontSize: 17 }}
                            />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() =>
                              onEdit(row)
                            }
                          >
                            <EditOutlinedIcon
                              sx={{ fontSize: 17 }}
                            />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Duplicate">
                          <IconButton
                            size="small"
                            onClick={() =>
                              onDuplicate(row)
                            }
                          >
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              onDelete(row)
                            }
                          >
                            <DeleteOutlineOutlinedIcon
                              sx={{ fontSize: 17 }}
                            />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        onPageChange={(_, p) =>
          onPageChange(p)
        }
        onRowsPerPageChange={(e) =>
          onRowsPerPage(
            Number(e.target.value)
          )
        }
        sx={{
          borderTop: '1px solid #E2E8F0',
          fontSize: '0.8rem',
        }}
      />
    </Paper>
  )
}