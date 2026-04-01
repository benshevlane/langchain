import { useCallback, useState } from 'react'
import { supabase, isConfigured } from '../utils/supabase'
import { useSupabase } from './useSupabase'
import type { CampaignGoal } from '../types/database'

export function useGoals() {
  const { data: goals, loading, error, refetch } = useSupabase<CampaignGoal>({
    table: 'campaign_goals',
    order: { column: 'created_at', ascending: true },
    limit: 50,
    realtime: true,
  })

  const [savingGoal, setSavingGoal] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const updateGoal = useCallback(
    async (id: string, fields: Partial<Pick<CampaignGoal, 'target_3m' | 'target_6m' | 'target_12m' | 'notes'>>) => {
      if (!isConfigured || !supabase) return
      if (savingGoal) return
      setSavingGoal(id)
      setMutationError(null)

      try {
        const { error: updateErr } = await supabase
          .from('campaign_goals')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (updateErr) throw updateErr
        refetch()
      } catch (err) {
        console.error('Failed to update goal:', err)
        setMutationError(err instanceof Error ? err.message : String(err))
      } finally {
        setSavingGoal(null)
      }
    },
    [refetch, savingGoal],
  )

  return { goals, loading, error: error || mutationError, updateGoal, savingGoal, refetch }
}
