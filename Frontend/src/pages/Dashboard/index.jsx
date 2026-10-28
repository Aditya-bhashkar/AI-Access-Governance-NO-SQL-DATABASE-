/**
 * Frontend/src/pages/Dashboard/index.jsx
 *
 * Main dashboard showing overview statistics and key metrics.
 * Governance analytics are rendered through GovernanceAnalytics.
 */

import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
} from '@mui/material';

import {
  Lock as LockIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import { analyticsAPI } from '../../services/apiService';
import GovernanceAnalytics from '../../components/GovernanceAnalytics';

const Dashboard = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);

        const data = await analyticsAPI.getOverview();

        setOverview(data);
      } catch (err) {
        console.error('Failed to fetch overview:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!overview) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="info">
          No dashboard data available.
        </Alert>
      </Container>
    );
  }

  // These field names match the FastAPI backend response.
  const total = overview.total ?? 0;
  const active = overview.active ?? 0;
  const expiringSoon = overview.expiring_soon ?? 0;
  const expired = overview.expired ?? 0;

  // Calculate compliance from the values returned by the backend.
  // Avoids NaN when there are zero records.
  const complianceRate =
    total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          AI Access Governance Dashboard
        </Typography>

        <Typography variant="body1" color="textSecondary">
          Overview of all API access records and compliance metrics
        </Typography>
      </Box>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>

        {/* Total Records */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Records
                  </Typography>

                  <Typography variant="h5">
                    {total}
                  </Typography>
                </Box>

                <LockIcon
                  sx={{
                    fontSize: 40,
                    color: 'primary.main',
                    opacity: 0.7,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Records */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Records
                  </Typography>

                  <Typography variant="h5">
                    {active}
                  </Typography>
                </Box>

                <CheckCircleIcon
                  sx={{
                    fontSize: 40,
                    color: 'success.main',
                    opacity: 0.7,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Expiring Soon */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Expiring Soon
                  </Typography>

                  <Typography variant="h5">
                    {expiringSoon}
                  </Typography>
                </Box>

                <WarningIcon
                  sx={{
                    fontSize: 40,
                    color: 'warning.main',
                    opacity: 0.7,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Expired Records */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Expired Records
                  </Typography>

                  <Typography variant="h5">
                    {expired}
                  </Typography>
                </Box>

                <HistoryIcon
                  sx={{
                    fontSize: 40,
                    color: 'error.main',
                    opacity: 0.7,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* Summary Information */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>

          {/* Total Vendors */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
              >
                Total Vendors
              </Typography>

              <Typography variant="h6">
                Available in Analytics
              </Typography>
            </Box>
          </Grid>

          {/* Business Units */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
              >
                Business Units
              </Typography>

              <Typography variant="h6">
                Available in Analytics
              </Typography>
            </Box>
          </Grid>

          {/* Last Updated */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
              >
                Last Updated
              </Typography>

              <Typography variant="body2">
                Current dashboard data
              </Typography>
            </Box>
          </Grid>

          {/* Compliance Rate */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
              >
                Compliance Rate
              </Typography>

              <Chip
                label={`${complianceRate}%`}
                color={
                  complianceRate >= 90
                    ? 'success'
                    : complianceRate >= 70
                    ? 'warning'
                    : 'error'
                }
                variant="outlined"
              />
            </Box>
          </Grid>

        </Grid>
      </Paper>

      {/* Governance Analytics */}
      <GovernanceAnalytics />

    </Container>
  );
};

export default Dashboard;