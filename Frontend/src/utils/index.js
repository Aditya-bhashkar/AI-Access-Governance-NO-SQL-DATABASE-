import {
  differenceInDays,
  parseISO,
  isValid,
  format,
} from 'date-fns'

import {
  STATUS,
  EXPIRING_SOON_DAYS,
} from '../constants'

/**
 * Convert a date value into a valid Date object.
 */
function toDate(value) {
  if (!value) return null

  const date =
    typeof value === 'string'
      ? parseISO(value)
      : value instanceof Date
        ? value
        : new Date(value)

  return isValid(date) ? date : null
}

/**
 * Compute status based on expiry date.
 */
export function computeStatus(expiryDate) {
  if (!expiryDate) {
    return STATUS.ACTIVE
  }

  const date = toDate(expiryDate)

  if (!date) {
    return STATUS.ACTIVE
  }

  const diff = differenceInDays(
    date,
    new Date()
  )

  if (diff < 0) {
    return STATUS.EXPIRED
  }

  if (diff <= EXPIRING_SOON_DAYS) {
    return STATUS.EXPIRING_SOON
  }

  return STATUS.ACTIVE
}

/**
 * Format date for display.
 */
export function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = toDate(value)

  return date
    ? format(date, 'dd MMM yyyy')
    : '—'
}

/**
 * Generate unique ID.
 */
export function generateId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

/**
 * Debounce function.
 */
export function debounce(fn, ms = 300) {
  let timeout

  return (...args) => {
    clearTimeout(timeout)

    timeout = setTimeout(() => {
      fn(...args)
    }, ms)
  }
}

/**
 * Get a field while supporting both
 * camelCase frontend fields and
 * snake_case backend fields.
 */
function getField(record, camelCase, snakeCase) {
  return (
    record?.[camelCase] ??
    record?.[snakeCase] ??
    ''
  )
}

/**
 * Filter records by search query.
 */
export function filterRecords(records = [], query) {
  if (!query?.trim()) {
    return records
  }

  const searchQuery = query
    .trim()
    .toLowerCase()

  return records.filter((record) => {
    const username = String(
      record?.username ?? ''
    ).toLowerCase()

    const applicationName = String(
      getField(
        record,
        'applicationName',
        'application_name'
      )
    ).toLowerCase()

    const businessUnit = String(
      getField(
        record,
        'businessUnit',
        'business_unit'
      )
    ).toLowerCase()

    const vendor = String(
      record?.vendor ?? ''
    ).toLowerCase()

    const itSpoke = String(
      getField(
        record,
        'itSpoke',
        'it_spoke'
      )
    ).toLowerCase()

    const businessSpoke = String(
      getField(
        record,
        'businessSpoke',
        'business_spoke'
      )
    ).toLowerCase()

    return (
      username.includes(searchQuery) ||
      applicationName.includes(searchQuery) ||
      businessUnit.includes(searchQuery) ||
      vendor.includes(searchQuery) ||
      itSpoke.includes(searchQuery) ||
      businessSpoke.includes(searchQuery)
    )
  })
}

/**
 * Sort records by column.
 *
 * Supports both frontend camelCase fields
 * and backend snake_case fields.
 */
export function sortRecords(
  records = [],
  column,
  direction
) {
  if (!column) {
    return records
  }

  const getValue = (record) => {
    switch (column) {
      case 'applicationName':
        return getField(
          record,
          'applicationName',
          'application_name'
        )

      case 'businessUnit':
        return getField(
          record,
          'businessUnit',
          'business_unit'
        )

      case 'itSpoke':
        return getField(
          record,
          'itSpoke',
          'it_spoke'
        )

      case 'businessSpoke':
        return getField(
          record,
          'businessSpoke',
          'business_spoke'
        )

      case 'dateIssued':
        return getField(
          record,
          'dateIssued',
          'date_issued'
        )

      case 'expiryDate':
        return getField(
          record,
          'expiryDate',
          'expiry_date'
        )

      case 'createdAt':
        return getField(
          record,
          'createdAt',
          'created_at'
        )

      case 'updatedAt':
        return getField(
          record,
          'updatedAt',
          'updated_at'
        )

      default:
        return record?.[column] ?? ''
    }
  }

  return [...records].sort((a, b) => {
    const aValue = getValue(a)
    const bValue = getValue(b)

    /*
     * Handle dates chronologically.
     */
    const dateColumns = [
      'dateIssued',
      'expiryDate',
      'createdAt',
      'updatedAt',
    ]

    if (dateColumns.includes(column)) {
      const aDate = toDate(aValue)
      const bDate = toDate(bValue)

      if (aDate && bDate) {
        const comparison =
          aDate.getTime() -
          bDate.getTime()

        return direction === 'asc'
          ? comparison
          : -comparison
      }
    }

    /*
     * Handle normal strings/numbers.
     */
    const comparison = String(
      aValue
    ).localeCompare(
      String(bValue),
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      }
    )

    return direction === 'asc'
      ? comparison
      : -comparison
  })
}