import { useState } from 'react'

import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
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

import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  })

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)

    try {
      await login({
        email: data.email,
        password: data.password,
        remember: data.remember,
      })

      navigate('/dashboard')
    } catch (e) {
      setError(
        e?.message ||
          'Login failed. Please try again.'
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
            API Governance Portal
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mt={0.5}
          >
            Sign in to manage AI API access records
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
              {/* Email */}
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
                    message: 'Enter a valid email.',
                  },
                })}
              />

              {/* Password */}
              <TextField
                label="Password"
                type={showPw ? 'text' : 'password'}
                fullWidth
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPw(
                            (previous) => !previous
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
                  required: 'Password is required.',
                })}
              />

              {/* Remember me / Forgot password */}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      {...register('remember')}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Remember me
                    </Typography>
                  }
                />

                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  underline="hover"
                  onClick={() => {
                    // Forgot-password functionality
                    // is not currently implemented.
                  }}
                >
                  Forgot password?
                </Link>
              </Box>

              {/* Submit */}
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
                  ? 'Signing in…'
                  : 'Sign in'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Register link */}
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
            Don't have an account?{' '}

            <Link
              component="button"
              type="button"
              onClick={() =>
                navigate('/register')
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
              Register here
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