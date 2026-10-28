/**
 * Frontend/src/pages/ViewRecord/index.jsx
 *
 * View a single API access record with all details.
 * Includes audit history for the selected record.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Stack,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';

import { apiAccessAPI } from '../../services/apiService';
import AuditHistory from '../../components/AuditHistory';
import { formatDate } from '../../utils';

const ViewRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchRecord = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiAccessAPI.getById(id);

        if (mounted) {
          setRecord(data);
        }
      } catch (err) {
        console.error('Failed to load record:', err);

        if (mounted) {
          setError(
            err?.message || 'Failed to load record.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (id) {
      fetchRecord();
    }

    return () => {
      mounted = false;
    };
  }, [id]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'success';

      case 'Expiring Soon':
        return 'warning';

      case 'Expired':
        return 'error';

      default:
        return 'default';
    }
  };

  const handleEdit = () => {
    navigate(`/records/${id}/edit`);
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      setError(null);

      await apiAccessAPI.delete(id);

      setDeleteConfirmOpen(false);
      navigate('/records');
    } catch (err) {
      console.error('Failed to delete record:', err);

      setError(
        err?.message || 'Failed to delete record.'
      );

      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!deleting) {
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="300px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !record) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>

        <Box sx={{ mt: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/records')}
          >
            Back to Records
          </Button>
        </Box>
      </Container>
    );
  }

  if (!record) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="info">
          Record not found
        </Alert>

        <Box sx={{ mt: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/records')}
          >
            Back to Records
          </Button>
        </Box>
      </Container>
    );
  }

  // Support both backend snake_case and frontend camelCase.
  const applicationName =
    record.applicationName ??
    record.application_name ??
    '';

  const businessUnit =
    record.businessUnit ??
    record.business_unit ??
    '';

  const itSpoke =
    record.itSpoke ??
    record.it_spoke ??
    '';

  const businessSpoke =
    record.businessSpoke ??
    record.business_spoke ??
    '';

  const dateIssued =
    record.dateIssued ??
    record.date_issued ??
    '';

  const expiryDate =
    record.expiryDate ??
    record.expiry_date ??
    '';

  const createdAt =
    record.createdAt ??
    record.created_at ??
    '';

  const updatedAt =
    record.updatedAt ??
    record.updated_at ??
    '';

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>

      {/* Error while record is already displayed */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/records')}
          sx={{ mb: 2 }}
        >
          Back to Records
        </Button>

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
          flexWrap="wrap"
        >
          <Typography
            variant="h4"
            component="h1"
          >
            API Access Details
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
            >
              Edit
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
            >
              Delete
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Record Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>

          {/* Left Column */}
          <Grid item xs={12} md={6}>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Username
              </Typography>

              <Typography variant="h6">
                {record.username || '—'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Application Name
              </Typography>

              <Typography variant="h6">
                {applicationName || '—'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Business Unit
              </Typography>

              <Typography variant="body1">
                {businessUnit || '—'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                IT Spoke
              </Typography>

              <Typography variant="body1">
                {itSpoke || '—'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Business Spoke
              </Typography>

              <Typography variant="body1">
                {businessSpoke || '—'}
              </Typography>
            </Box>

          </Grid>

          {/* Right Column */}
          <Grid item xs={12} md={6}>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Vendor
              </Typography>

              <Chip
                label={record.vendor || '—'}
                color="primary"
                variant="outlined"
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Date Issued
              </Typography>

              <Typography variant="body1">
                {formatDate(dateIssued)}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Expiry Date
              </Typography>

              <Typography variant="body1">
                {formatDate(expiryDate)}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Status
              </Typography>

              <Chip
                label={record.status || 'Active'}
                color={getStatusColor(record.status)}
                variant="outlined"
                sx={{ mt: 0.5 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Created
              </Typography>

              <Typography variant="body2">
                {formatDate(createdAt)}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Last Updated
              </Typography>

              <Typography variant="body2">
                {formatDate(updatedAt)}
              </Typography>
            </Box>

          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Notes
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  p: 2,
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  minHeight: '60px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {record.notes || 'No notes'}
              </Typography>
            </Box>
          </Grid>

        </Grid>
      </Paper>

      {/* Audit History */}
      <AuditHistory recordId={record.id} />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Delete Record?
        </DialogTitle>

        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this API access
            record for{' '}
            <strong>{record.username}</strong> at{' '}
            <strong>{applicationName}</strong>?
            {' '}
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default ViewRecord;