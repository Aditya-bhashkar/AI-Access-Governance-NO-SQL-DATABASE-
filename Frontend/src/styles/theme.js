import { createTheme, alpha } from '@mui/material/styles'

const PRIMARY = '#1976D2'
const PRIMARY_DARK = '#1565C0'
const PRIMARY_LIGHT = '#E3F2FD'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: PRIMARY, dark: PRIMARY_DARK, light: '#42A5F5', contrastText: '#fff' },
    secondary: { main: '#1565C0' },
    success: { main: '#2E7D32', light: '#E8F5E9' },
    warning: { main: '#ED6C02', light: '#FFF3E0' },
    error: { main: '#D32F2F', light: '#FFEBEE' },
    info: { main: '#0288D1' },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    text: { primary: '#1E293B', secondary: '#64748B', disabled: '#94A3B8' },
    divider: '#E2E8F0',
  },

  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
  },

  shape: { borderRadius: 10 },

  shadows: Array(25)
    .fill('none')
    .map((_, i) => {
      if (i === 0) return 'none'
      if (i <= 2) return '0 1px 4px rgba(15,23,42,0.06)'
      if (i <= 4) return '0 4px 12px rgba(15,23,42,0.08)'
      return '0 8px 24px rgba(15,23,42,0.10)'
    }),

  components: {
    MuiCssBaseline: { styleOverrides: { body: { background: '#F8FAFC' } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: '8px 20px', fontWeight: 600 },
        containedPrimary: {
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
          boxShadow: `0 2px 8px ${alpha(PRIMARY, 0.3)}`,
          '&:hover': { boxShadow: `0 4px 14px ${alpha(PRIMARY, 0.4)}` },
        },
        outlinedPrimary: { borderColor: PRIMARY, '&:hover': { background: PRIMARY_LIGHT } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, boxShadow: '0 4px 12px rgba(15,23,42,0.07)', border: '1px solid #E5E7EB' },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: PRIMARY },
          },
        },
      },
    },
    MuiSelect: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, fontSize: '0.72rem' } } },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            background: '#F1F5F9',
            fontWeight: 700,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: '#475569',
            borderBottom: '2px solid #E2E8F0',
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: { root: { borderBottom: '1px solid #F1F5F9', padding: '11px 16px' } },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 120ms',
          '&:hover': { background: '#F8FAFC' },
          '&.Mui-selected': { background: `${alpha(PRIMARY, 0.06)}` },
        },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          margin: '1px 8px',
          position: 'relative',
          '&.Mui-selected': {
            background: PRIMARY_LIGHT,
            color: PRIMARY,
            '& .MuiListItemIcon-root': { color: PRIMARY },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: '20%',
              height: '60%',
              width: 3,
              background: PRIMARY,
              borderRadius: '0 3px 3px 0',
            },
          },
        },
      },
    },
  },
})

export default theme