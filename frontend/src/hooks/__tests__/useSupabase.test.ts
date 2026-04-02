import { renderHook, waitFor } from '@testing-library/react'
import { useSupabase } from '../useSupabase'

describe('useSupabase', () => {
  it('returns empty data array initially', () => {
    const { result } = renderHook(() =>
      useSupabase({ table: 'test_table' }),
    )
    expect(result.current.data).toEqual([])
  })

  it('sets loading to false after query resolves', async () => {
    const { result } = renderHook(() =>
      useSupabase({ table: 'test_table' }),
    )
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('returns no error after successful query', async () => {
    const { result } = renderHook(() =>
      useSupabase({ table: 'test_table' }),
    )
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.error).toBeNull()
  })

  it('calls supabase.from with correct table name', async () => {
    const { supabase } = await import('../../utils/supabase')
    renderHook(() => useSupabase({ table: 'my_custom_table' }))
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('my_custom_table')
    })
  })

  it('provides a refetch function', async () => {
    const { result } = renderHook(() =>
      useSupabase({ table: 'test_table' }),
    )
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(typeof result.current.refetch).toBe('function')
  })
})
