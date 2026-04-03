import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from '../utils/supabase'

interface UseSupabaseOptions {
  table: string
  select?: string
  order?: { column: string; ascending?: boolean }
  limit?: number
  filters?: Record<string, string | number | boolean>
  /** Subscribe to Supabase realtime INSERT events on this table. */
  realtime?: boolean
  /** Enable offset-based pagination. */
  paginate?: boolean
}

interface UseSupabaseResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
  /** Current page (0-indexed). Only meaningful when `paginate` is true. */
  page: number
  /** Navigate to a specific page. */
  setPage: (p: number) => void
  /** Whether there are more rows beyond the current page. */
  hasMore: boolean
  /** Total count of matching rows (available when `paginate` is true). */
  totalCount: number
}

export function useSupabase<T>({
  table,
  select = '*',
  order,
  limit = 100,
  filters,
  realtime = false,
  paginate = false,
}: UseSupabaseOptions): UseSupabaseResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  // Keep a stable ref so the realtime callback can call the latest refetch
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false)
      setError(null)
      return
    }

    const client = supabase
    let cancelled = false
    setLoading(true)

    const run = async () => {
      const offset = paginate ? page * limit : 0

      let query = client.from(table).select(select, paginate ? { count: 'exact' } : undefined)

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value)
        }
      }
      if (order) {
        query = query.order(order.column, { ascending: order.ascending ?? false })
      }
      if (paginate) {
        query = query.range(offset, offset + limit - 1)
      } else {
        query = query.limit(limit)
      }

      const { data: rows, error: err, count } = await query
      if (cancelled) return

      if (err) {
        console.error(`[useSupabase] ${table}: ${err.message}`)
        setError(err.message)
        setData([])
      } else {
        setData((rows ?? []) as T[])
        setError(null)
        if (paginate && count != null) {
          setTotalCount(count)
        }
      }
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [table, select, limit, tick, page, paginate, JSON.stringify(order), JSON.stringify(filters)])

  // Realtime subscription — refetch on INSERT/UPDATE/DELETE
  useEffect(() => {
    if (!realtime || !isConfigured || !supabase) return

    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          refetchRef.current()
        },
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [table, realtime])

  const hasMore = paginate ? (page + 1) * limit < totalCount : false

  return { data, loading, error, refetch, page, setPage, hasMore, totalCount }
}
