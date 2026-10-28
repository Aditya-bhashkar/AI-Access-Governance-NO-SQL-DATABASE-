import { useState, useEffect, useMemo } from 'react'
import {
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'

import { debounce } from '../../utils'

export default function SearchBar({
  onSearch,
  placeholder = 'Search username, app, unit, vendor…',
  value = '',
}) {
  const [val, setVal] = useState(value)

  const fire = useMemo(
    () =>
      debounce((query) => {
        onSearch(query)
      }, 300),
    [onSearch]
  )

  useEffect(() => {
    setVal(value)
  }, [value])

  const handleChange = (event) => {
    const query = event.target.value

    setVal(query)
    fire(query)
  }

  const clear = () => {
    setVal('')
    onSearch('')
  }

  return (
    <TextField
      value={val}
      onChange={handleChange}
      placeholder={placeholder}
      size="small"
      sx={{ minWidth: 300 }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon
              sx={{
                color: '#94A3B8',
                fontSize: 19,
              }}
            />
          </InputAdornment>
        ),

        endAdornment: val ? (
          <InputAdornment position="end">
            <IconButton
              onClick={clear}
              size="small"
              aria-label="Clear search"
            >
              <ClearIcon
                sx={{ fontSize: 16 }}
              />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  )
}