/**
 * Frontend/src/components/AuditHistory/index.jsx
 *
 * Displays the audit trail for a specific API access record.
 * Shows who made changes, what changed, and when.
 */

import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Paper,
  Typography,
  CircularProgress,
  Chip,
} from '@mui/material'

import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab'

import {
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

import { auditAPI } from '../../services/apiService'
import { formatDateTime } from '../../utils/dateUtils'

const AuditHistory = ({ recordId }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const fetchHistory = async () => {
      if (!recordId) {
        if (mounted) {
          setHistory([])
          setLoading(false)
        }
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await auditAPI.getRecordHistory(recordId)

        /*
         * Backend response:
         *
         * {
         *   total: number,
         *   history: [...]
         * }
         *
         * apiService.js returns response.data.data,
         * therefore we need response.history here.
         */
        const auditHistory = Array.isArray(response?.history)
          ? response.history
          : []

        if (mounted) {
          setHistory(auditHistory)
        }
      } catch (err) {
        console.error('Audit history fetch error:', err)

        if (mounted) {
          setError(
            err?.message || 'Failed to load audit history.'
          )
          setHistory([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchHistory()

    return () => {
      mounted = false
    }
  }, [recordId])

  /**
   * Get icon based on action type.
   */
  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE':
        return <AddIcon />

      case 'UPDATE':
        return <EditIcon />

      case 'DELETE':
        return <DeleteIcon />

      default:
        return <EditIcon />
    }
  }

  /**
   * Get color based on action type.
   */
  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'success'

      case 'UPDATE':
        return 'info'

      case 'DELETE':
        return 'error'

      default:
        return 'default'
    }
  }

  /**
   * Get user display name from audit log.
   *
   * Supports the current backend structure as well as
   * older metadata-based structures.
   */
  const getUserDisplayName = (log) => {
    if (log?.performed_by_name) {
      return log.performed_by_name
    }

    if (log?.performed_by?.name) {
      return log.performed_by.name
    }

    if (log?.metadata?.user_name) {
      return log.metadata.user_name
    }

    if (log?.metadata?.performed_by_name) {
      return log.metadata.performed_by_name
    }

    if (log?.performed_by) {
      return log.performed_by
    }

    return 'Unknown User'
  }

  /**
   * Get user email from audit log.
   */
  const getUserEmail = (log) => {
    if (log?.performed_by_email) {
      return log.performed_by_email
    }

    if (log?.performed_by?.email) {
      return log.performed_by.email
    }

    if (log?.metadata?.user_email) {
      return log.metadata.user_email
    }

    if (log?.metadata?.performed_by_email) {
      return log.metadata.performed_by_email
    }

    return null
  }

  /**
   * Loading state.
   */
  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress size={40} />
        </Box>
      </Paper>
    )
  }

  /**
   * Error state.
   */
  if (error) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Paper>
    )
  }

  /**
   * Empty state.
   */
  if (history.length === 0) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="info">
          No audit history available for this record
        </Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        📋 Audit History
      </Typography>

      <Typography
        variant="body2"
        color="textSecondary"
        sx={{ mb: 2 }}
      >
        Complete history of changes made to this record
      </Typography>

      <Timeline position="alternate">
        {history.map((log, index) => {
          /*
           * MongoDB commonly uses _id, while some API
           * serializers may expose id.
           */
          const key =
            log?._id ||
            log?.id ||
            `audit-${index}`

          const userName = getUserDisplayName(log)
          const userEmail = getUserEmail(log)

          const action = String(
            log?.action || 'UPDATE'
          ).toUpperCase()

          const actionColor = getActionColor(action)

          return (
            <TimelineItem key={key}>
              <TimelineSeparator>
                <TimelineDot
                  color={actionColor}
                  variant="outlined"
                >
                  {getActionIcon(action)}
                </TimelineDot>

                {index < history.length - 1 && (
                  <TimelineConnector />
                )}
              </TimelineSeparator>

              <TimelineContent
                sx={{
                  py: '12px',
                  px: 2,
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    border: '1px solid #e0e0e0',
                  }}
                >
                  {/* Action and timestamp */}
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    mb={1.5}
                    flexWrap="wrap"
                  >
                    <Chip
                      label={action}
                      size="small"
                      color={actionColor}
                      variant="outlined"
                    />

                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ fontWeight: 500 }}
                    >
                      {log?.timestamp
                        ? formatDateTime(log.timestamp)
                        : 'Unknown time'}
                    </Typography>
                  </Box>

                  {/* Performed by */}
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      color="textPrimary"
                    >
                      <strong>Performed by:</strong>{' '}

                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: '#0066cc',
                        }}
                      >
                        {userName}
                      </span>

                      {userEmail && (
                        <span
                          style={{
                            color: '#666',
                            marginLeft: '8px',
                          }}
                        >
                          ({userEmail})
                        </span>
                      )}
                    </Typography>
                  </Box>

                  {/* Metadata / change details */}
                  {log?.metadata &&
                    Object.keys(log.metadata).length > 0 && (
                      <Box
                        sx={{
                          mt: 1.5,
                          bgcolor: '#fafafa',
                          p: 1.5,
                          borderRadius: 0.5,
                          borderLeft:
                            '3px solid #2196f3',
                        }}
                      >
                        <Typography
                          variant="caption"
                          display="block"
                          color="textSecondary"
                          sx={{
                            fontWeight: 600,
                            mb: 0.5,
                          }}
                        >
                          Details:
                        </Typography>

                        {Object.entries(log.metadata).map(
                          ([key, value]) => (
                            <Typography
                              key={key}
                              variant="caption"
                              display="block"
                              sx={{
                                mb: 0.25,
                                fontFamily: 'monospace',
                              }}
                            >
                              • <strong>{key}:</strong>{' '}
                              {typeof value === 'object' &&
                              value !== null
                                ? JSON.stringify(value)
                                : value ?? '-'}
                            </Typography>
                          )
                        )}
                      </Box>
                    )}

                  {/* Entity ID */}
                  {log?.entity_id && (
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{
                        mt: 1,
                        color: '#999',
                      }}
                    >
                      Record ID:{' '}
                      <span
                        style={{
                          fontFamily: 'monospace',
                        }}
                      >
                        {log.entity_id}
                      </span>
                    </Typography>
                  )}
                </Box>
              </TimelineContent>
            </TimelineItem>
          )
        })}
      </Timeline>

      {/* Summary */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          bgcolor: '#f5f5f5',
          borderRadius: 1,
        }}
      >
        <Typography
          variant="body2"
          color="textSecondary"
        >
          Total changes:{' '}
          <strong>{history.length}</strong>
        </Typography>
      </Box>
    </Paper>
  )
}

export default AuditHistory