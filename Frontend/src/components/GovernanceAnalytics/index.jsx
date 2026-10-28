/**
 * Frontend/src/components/GovernanceAnalytics/index.jsx
 *
 * Dashboard analytics section showing:
 * - Distribution by vendor
 * - Distribution by business unit
 *
 * Analytics are scoped by the backend according to the
 * authenticated user's role and ownership permissions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import { analyticsAPI } from '../../services/apiService';

const GovernanceAnalytics = () => {
  const [vendorData, setVendorData] = useState([]);
  const [businessUnitData, setBusinessUnitData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [vendors, businessUnits] = await Promise.all([
        analyticsAPI.getByVendor(),
        analyticsAPI.getByBusinessUnit(),
      ]);

      // Defensive normalization.
      // Backend is expected to return arrays.
      setVendorData(Array.isArray(vendors) ? vendors : []);
      setBusinessUnitData(
        Array.isArray(businessUnits) ? businessUnits : []
      );
    } catch (err) {
      console.error('Failed to fetch governance analytics:', err);

      setVendorData([]);
      setBusinessUnitData([]);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  /**
   * Simple horizontal bar visualization.
   *
   * No external charting library is required.
   */
  const BarChart = ({ data, dataKey, labelKey, maxValue }) => {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mt: 2 }}>
        {data.map((item, index) => {
          const rawValue = Number(item?.[dataKey]);
          const value = Number.isFinite(rawValue) ? rawValue : 0;

          const label = item?.[labelKey] ?? 'Unknown';

          const percentage =
            maxValue > 0
              ? Math.min((value / maxValue) * 100, 100)
              : 0;

          return (
            <Box key={`${label}-${index}`} sx={{ mb: 2 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                mb={0.5}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500 }}
                >
                  {label}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {value}
                </Typography>
              </Box>

              <Box
                sx={{
                  width: '100%',
                  height: 24,
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: 'primary.main',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    px: 1,
                    color: 'primary.contrastText',
                    fontSize: 12,
                  }}
                >
                  {percentage > 5 ? value : null}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        p={4}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mt: 3 }}
        action={
          <Typography
            component="button"
            variant="body2"
            onClick={fetchAnalytics}
            sx={{
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </Typography>
        }
      >
        {error}
      </Alert>
    );
  }

  const maxVendorCount = Math.max(
    ...vendorData.map((item) => Number(item?.count) || 0),
    1
  );

  const maxBusinessUnitCount = Math.max(
    ...businessUnitData.map((item) => Number(item?.count) || 0),
    1
  );

  return (
    <Box sx={{ mt: 4 }}>
      {/* Section Header */}
      <Typography
        variant="h5"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        Governance Analytics
      </Typography>

      <Grid container spacing={3}>
        {/* Vendor Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              API Access by Vendor
            </Typography>

            {vendorData.length > 0 ? (
              <>
                <BarChart
                  data={vendorData}
                  dataKey="count"
                  labelKey="vendor"
                  maxValue={maxVendorCount}
                />

                <TableContainer sx={{ mt: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          backgroundColor: 'action.hover',
                        }}
                      >
                        <TableCell>
                          <strong>Vendor</strong>
                        </TableCell>

                        <TableCell align="right">
                          <strong>Count</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {vendorData.map((row, index) => (
                        <TableRow
                          key={`${row?.vendor ?? 'unknown'}-${index}`}
                        >
                          <TableCell>
                            {row?.vendor ?? 'Unknown'}
                          </TableCell>

                          <TableCell align="right">
                            {Number(row?.count) || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                No vendor data available.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Business Unit Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              API Access by Business Unit
            </Typography>

            {businessUnitData.length > 0 ? (
              <>
                <BarChart
                  data={businessUnitData}
                  dataKey="count"
                  labelKey="business_unit"
                  maxValue={maxBusinessUnitCount}
                />

                <TableContainer sx={{ mt: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          backgroundColor: 'action.hover',
                        }}
                      >
                        <TableCell>
                          <strong>Business Unit</strong>
                        </TableCell>

                        <TableCell align="right">
                          <strong>Count</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {businessUnitData.map((row, index) => (
                        <TableRow
                          key={`${row?.business_unit ?? 'unknown'}-${index}`}
                        >
                          <TableCell>
                            {row?.business_unit ?? 'Unknown'}
                          </TableCell>

                          <TableCell align="right">
                            {Number(row?.count) || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                No business unit data available.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Summary */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Vendor Groups:{' '}
          <strong>{vendorData.length}</strong>
          {' | '}
          Business Unit Groups:{' '}
          <strong>{businessUnitData.length}</strong>
        </Typography>
      </Box>
    </Box>
  );
};

export default GovernanceAnalytics;