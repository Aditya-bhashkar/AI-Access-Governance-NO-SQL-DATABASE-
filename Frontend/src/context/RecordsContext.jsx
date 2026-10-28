import { createContext, useContext, useReducer, useCallback } from 'react'

import {
  getAllApiAccess,
  createApiAccess,
  updateApiAccess,
  deleteApiAccess,
  getApiAccessById,
} from '../services/apiService'

const Ctx = createContext(null)

const init = {
  records: [],
  total: 0,
  loading: false,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return {
        ...state,
        loading: true,
        error: null,
      }

    case 'LOADED':
      return {
        ...state,
        loading: false,
        records: action.records,
        total: action.total,
      }

    case 'ERROR':
      return {
        ...state,
        loading: false,
        error: action.msg,
      }

    case 'ADD':
      return {
        ...state,
        records: [action.rec, ...state.records],
        total: state.total + 1,
      }

    case 'UPDATE':
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === action.rec.id ? action.rec : r
        ),
      }

    case 'DELETE':
      return {
        ...state,
        records: state.records.filter((r) => r.id !== action.id),
        total: Math.max(0, state.total - 1),
      }

    case 'CLR_ERR':
      return {
        ...state,
        error: null,
      }

    default:
      return state
  }
}

export function RecordsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init)

  /**
   * Fetch API access records.
   *
   * Backend response:
   * {
   *   data: [...records],
   *   pagination: {
   *     page,
   *     limit,
   *     total,
   *     total_pages
   *   }
   * }
   */
  const fetchRecords = useCallback(async (params = {}) => {
    dispatch({ type: 'LOADING' })

    try {
      const response = await getAllApiAccess(params)

      const records = response?.data ?? []
      const total = response?.pagination?.total ?? records.length

      dispatch({
        type: 'LOADED',
        records,
        total,
      })
    } catch (e) {
      console.error('Failed to load API access records:', e)

      dispatch({
        type: 'ERROR',
        msg: e?.message || 'Failed to load records.',
      })
    }
  }, [])

  /**
   * Create a new API access record.
   */
  const addRecord = useCallback(async (payload) => {
    try {
      const record = await createApiAccess(payload)

      dispatch({
        type: 'ADD',
        rec: record,
      })

      return record
    } catch (e) {
      console.error('Failed to create API access record:', e)
      throw e
    }
  }, [])

  /**
   * Update an existing API access record.
   */
  const editRecord = useCallback(async (id, payload) => {
    try {
      const record = await updateApiAccess(id, payload)

      dispatch({
        type: 'UPDATE',
        rec: record,
      })

      return record
    } catch (e) {
      console.error('Failed to update API access record:', e)
      throw e
    }
  }, [])

  /**
   * Delete an API access record.
   */
  const removeRecord = useCallback(async (id) => {
    try {
      await deleteApiAccess(id)

      dispatch({
        type: 'DELETE',
        id,
      })
    } catch (e) {
      console.error('Failed to delete API access record:', e)
      throw e
    }
  }, [])

  /**
   * Get a single API access record.
   */
  const getRecord = useCallback(
    async (id) => {
      return await getApiAccessById(id)
    },
    []
  )

  /**
   * Clear current error.
   */
  const clearError = useCallback(() => {
    dispatch({
      type: 'CLR_ERR',
    })
  }, [])

  return (
    <Ctx.Provider
      value={{
        ...state,
        fetchRecords,
        addRecord,
        editRecord,
        removeRecord,
        getRecord,
        clearError,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useRecords = () => {
  const ctx = useContext(Ctx)

  if (!ctx) {
    throw new Error('useRecords must be inside <RecordsProvider>')
  }

  return ctx
}