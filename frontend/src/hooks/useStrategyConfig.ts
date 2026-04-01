import { useCallback, useState } from 'react'
import { supabase, isConfigured } from '../utils/supabase'
import { useSupabase } from './useSupabase'
import type { StrategyConfig } from '../types/database'

export function useStrategyConfig() {
  const { data: configs, loading, error, refetch } = useSupabase<StrategyConfig>({
    table: 'strategy_config',
    order: { column: 'category', ascending: true },
    limit: 200,
    realtime: true,
  })

  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const updateConfig = useCallback(
    async (key: string, value: string) => {
      if (!isConfigured || !supabase) return
      if (savingKey) return
      setSavingKey(key)
      setMutationError(null)

      try {
        const { error: updateErr } = await supabase
          .from('strategy_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)
        if (updateErr) throw updateErr
        refetch()
      } catch (err) {
        console.error('Failed to update strategy config:', err)
        setMutationError(err instanceof Error ? err.message : String(err))
      } finally {
        setSavingKey(null)
      }
    },
    [refetch, savingKey],
  )

  /** Group configs by category for display. */
  const grouped = configs.reduce<Record<string, StrategyConfig[]>>((acc, cfg) => {
    const cat = cfg.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cfg)
    return acc
  }, {})

  return { configs, grouped, loading, error: error || mutationError, updateConfig, savingKey, refetch }
}
