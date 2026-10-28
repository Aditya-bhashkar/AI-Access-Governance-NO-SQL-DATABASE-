import { useState } from 'react'

import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Link,
  CircularProgress,
} from '@mui/material'

import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import SecurityIcon from '@mui/icons-material/Security'

import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { authAPI } from '../../services/apiService'

export default function Register() {
  const navigate = useNavigate()

  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] =
    useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const password = watch('password')

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)

    try {
      await authAPI.register(
        data.name,
        data.email,
        data.password
      )

      navigate('/login')
    } catch (error) {
      setError(
        error?.message ||
          'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={2}
      sx={{
        background:
          'linear-gradient(145deg,#F0F7FF 0%,#F8FAFC 50%,#EEF2FF 100%)',
      }}
    >
      <Box width="100%" maxWidth={420}>
        {/* Brand header */}
        <Box textAlign="center" mb={4}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: '16px',
              background:
                'linear-gradient(135deg,#1976D2,#1565C0)',
              boxShadow:
                '0 8px 24px rgba(25,118,210,0.30)',
              mb: 2,
            }}
          >
            <SecurityIcon
              sx={{
                color: '#fff',
                fontSize: 28,
              }}
            />
          </Box>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            Create Account
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mt={0.5}
          >
            Register to access the API Governance Portal
          </Typography>
        </Box>

        <Card
          elevation={0}
          sx={{
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
          }}
        >
          <CardContent
            sx={{
              p: {
                xs: 3,
                sm: 4,
              },
            }}
          >
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,
                  borderRadius: '10px',
                }}
                onClose={() => setError('')}
              >
                {error}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              display="flex"
              flexDirection="column"
              gap={2.5}
            >
              <TextField
                label="Full Name"
                type="text"
                fullWidth
                autoComplete="name"
                error={!!errors.name}
                helperText={errors.name?.message}
                {...register('name', {
                  required: 'Name is required.',
                  minLength: {
                    value: 2,
                    message:
                      'Name must be at least 2 characters.',
                  },
                })}
              />

              <TextField
                label="Email address"
                type="email"
                fullWidth
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                {...register('email', {
                  required: 'Email is required.',
                  pattern: {
                    value:
                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message:
                      'Enter a valid email.',
                  },
                })}
              />

              <TextField
                label="Password"
                type={
                  showPw ? 'text' : 'password'
                }
                fullWidth
                autoComplete="new-password"
                error={!!errors.password}
                helperText={
                  errors.password?.message
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPw(
                            (previous) =>
                              !previous
                          )
                        }
                        size="small"
                        aria-label={
                          showPw
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showPw ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('password', {
                  required:
                    'Password is required.',
                  minLength: {
                    value: 6,
                    message:
                      'Password must be at least 6 characters.',
                  },
                })}
              />

              <TextField
                label="Confirm Password"
                type={
                  showConfirmPw
                    ? 'text'
                    : 'password'
                }
                fullWidth
                autoComplete="new-password"
                error={!!errors.confirmPassword}
                helperText={
                  errors.confirmPassword?.message
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowConfirmPw(
                            (previous) =>
                              !previous
                          )
                        }
                        size="small"
                        aria-label={
                          showConfirmPw
                            ? 'Hide confirm password'
                            : 'Show confirm password'
                        }
                      >
                        {showConfirmPw ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('confirmPassword', {
                  required:
                    'Please confirm your password.',
                  validate: (value) =>
                    value === password ||
                    'Passwords do not match.',
                })}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={
                  loading ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                    />
                  ) : null
                }
                sx={{ mt: 0.5 }}
              >
                {loading
                  ? 'Creating account…'
                  : 'Register'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Login link */}
        <Box
          sx={{
            mt: 3,
            textAlign: 'center',
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
          >
            Already have an account?{' '}

            <Link
              component="button"
              type="button"
              onClick={() =>
                navigate('/login')
              }
              sx={{
                color: '#1976d2',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                border: 0,
                background: 'none',
                padding: 0,
                font: 'inherit',
              }}
            >
              Sign in
            </Link>
          </Typography>
        </Box>

        <Typography
          variant="caption"
          color="text.disabled"
          textAlign="center"
          display="block"
          mt={3}
        >
          Authorised personnel only · Internal use only
        </Typography>
      </Box>
    </Box>
  )
}