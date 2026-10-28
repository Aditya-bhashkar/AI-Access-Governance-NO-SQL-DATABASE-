import { useState, useMemo } from 'react'
import {
  filterRecords,
  sortRecords,
  computeStatus,
} from '../utils'
import { ROWS_PER_PAGE_OPTIONS } from '../constants'

export default function useTable(records = []) {
  const [search, setSearch] = useState('')

  const [filters, setFilters] = useState({
    vendor: '',
    businessUnit: '',
    status: '',
  })

  const [order, setOrder] = useState('desc')
  const [orderBy, setOrderBy] = useState('createdAt')

  const [page, setPage] = useState(0)

  const [rowsPerPage, setRowsPerPage] = useState(
    ROWS_PER_PAGE_OPTIONS[0]
  )

  const [selected, setSelected] = useState([])

  const handleSort = (col) => {
    setOrder((previousOrder) =>
      orderBy === col && previousOrder === 'asc'
        ? 'desc'
        : 'asc'
    )

    setOrderBy(col)
    setPage(0)
  }

  const handleSearch = (query) => {
    setSearch(query)
    setPage(0)
  }

  const handleFilter = (key, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [key]: value,
    }))

    setPage(0)
  }

  const resetFilters = () => {
    setFilters({
      vendor: '',
      businessUnit: '',
      status: '',
    })

    setSearch('')
    setPage(0)
  }

  const handleSelectAll = (event, rows) => {
    setSelected(
      event.target.checked
        ? rows.map((row) => row.id)
        : []
    )
  }

  const handleSelectRow = (id) => {
    setSelected((previousSelected) =>
      previousSelected.includes(id)
        ? previousSelected.filter(
            (selectedId) => selectedId !== id
          )
        : [...previousSelected, id]
    )
  }

  const filtered = useMemo(() => {
    /*
     * Normalize backend snake_case fields into the
     * camelCase fields used by the table.
     *
     * This also keeps compatibility with records that
     * are already camelCase.
     */
    let result = records.map((record) => {
      const normalized = {
        ...record,

        applicationName:
          record.applicationName ??
          record.application_name ??
          '',

        businessUnit:
          record.businessUnit ??
          record.business_unit ??
          '',

        itSpoke:
          record.itSpoke ??
          record.it_spoke ??
          '',

        businessSpoke:
          record.businessSpoke ??
          record.business_spoke ??
          '',

        dateIssued:
          record.dateIssued ??
          record.date_issued ??
          '',

        expiryDate:
          record.expiryDate ??
          record.expiry_date ??
          '',

        createdAt:
          record.createdAt ??
          record.created_at ??
          '',

        updatedAt:
          record.updatedAt ??
          record.updated_at ??
          '',
      }

      return {
        ...normalized,
        status: computeStatus(normalized.expiryDate),
      }
    })

    /*
     * Vendor filter
     */
    if (filters.vendor) {
      result = result.filter(
        (record) =>
          record.vendor === filters.vendor
      )
    }

    /*
     * Business Unit filter
     */
    if (filters.businessUnit) {
      result = result.filter(
        (record) =>
          record.businessUnit ===
          filters.businessUnit
      )
    }

    /*
     * Status filter
     */
    if (filters.status) {
      result = result.filter(
        (record) =>
          record.status === filters.status
      )
    }

    /*
     * Search
     */
    result = filterRecords(result, search)

    /*
     * Sorting
     */
    return sortRecords(
      result,
      orderBy,
      order
    )
  }, [
    records,
    filters,
    search,
    orderBy,
    order,
  ])

  const paginated = useMemo(
    () =>
      filtered.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [
      filtered,
      page,
      rowsPerPage,
    ]
  )

  return {
    search,
    filters,
    order,
    orderBy,
    page,
    rowsPerPage,
    selected,
    filtered,
    paginated,

    handleSort,
    handleSearch,
    handleFilter,
    resetFilters,

    handleSelectAll,
    handleSelectRow,

    setSelected,
    setPage,

    setRowsPerPage: (value) => {
      setRowsPerPage(value)
      setPage(0)
    },
  }
}