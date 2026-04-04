import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from '../utils/supabase'
import { useSupabase } from './useSupabase'
import type { ScheduleEntry } from '../types/database'
import type { FrequencyOption } from '../data/skills'

/** Default day assignments by category when creating new schedule rows. */
const DEFAULT_DAYS: Record<string, number[]> = {
  content: [0, 1, 2],       // Mon, Tue, Wed
  prospecting: [3, 3, 4],   // Thu, Thu, Fri
  analytics: [4, 1, 3],     // Fri, Tue, Thu
  maintenance: [5, 6, 5],   // Sat, Sun, Sat
}

function getDaysForSkill(category: string, count: number): number[] {
  const days = DEFAULT_DAYS[category] ?? [0, 2, 4]
  return days.slice(0, count)
}

export function useScheduleEntries() {
  const { data: entries, loading, error, refetch } = useSupabase<ScheduleEntry>({
    table: 'ralf_schedule',
    limit: 200,
  })

  const [savingSkill, setSavingSkill] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const savingRef = useRef(false)

  // Optimistic frequency kept while a save is in-flight so the controlled
  // <select> doesn't revert to the stale derived value during refetch.
  const [optimistic, setOptimistic] = useState<Record<string, FrequencyOption>>({})

  // Clear optimistic overrides once fresh entries arrive from the server.
  // This ensures the optimistic value persists through the refetch gap.
  useEffect(() => {
    setOptimistic({})
  }, [entries])

  const deriveFrequency = useCallback(
    (skillName: string): FrequencyOption => {
      // Return the optimistic value while a save is in progress
      if (optimistic[skillName]) return optimistic[skillName]

      const rows = entries.filter((e) => e.skill === skillName && e.active)

      const dailyCount = rows.filter((r) => r.cadence === 'daily').length
      const weeklyRows = rows.filter((r) => r.cadence === 'weekly')
      const monthlyCount = rows.filter((r) => r.cadence === 'monthly').length

      if (dailyCount >= 3) return '3x_week'
      if (dailyCount >= 2) return '2x_week'
      if (weeklyRows.length >= 1) {
        if (weeklyRows.some((r) => r.label?.includes('fortnightly'))) return 'fortnightly'
        return 'weekly'
      }
      if (dailyCount === 1) return 'weekly'
      if (monthlyCount >= 1) return 'monthly'

      // Check if rows exist but are all inactive
      const allRows = entries.filter((e) => e.skill === skillName)
      if (allRows.length > 0) return 'off'

      // No rows at all — treat as weekly (default)
      return 'weekly'
    },
    [entries, optimistic],
  )

  const updateFrequency = useCallback(
    async (skillName: string, frequency: FrequencyOption, category: string) => {
      if (!isConfigured || !supabase) return
      // Prevent concurrent saves — use a ref to avoid stale closure reads
      if (savingRef.current) return
      savingRef.current = true
      setSavingSkill(skillName)
      setMutationError(null)
      setOptimistic((prev) => ({ ...prev, [skillName]: frequency }))

      try {
        // Deactivate all existing rows for this skill
        const { error: updateErr } = await supabase
          .from('ralf_schedule')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('skill', skillName)
        if (updateErr) throw updateErr

        if (frequency === 'off') {
          refetch()
          return
        }

        // Build new rows based on frequency
        const newRows: Partial<ScheduleEntry>[] = []
        const boost = 30

        if (frequency === '3x_week') {
          const days = getDaysForSkill(category, 3)
          for (const day of days) {
            newRows.push({
              cadence: 'daily',
              day_of_week: day,
              skill: skillName,
              boost_amount: boost,
              label: `${skillName} (3x/week)`,
              description: `Scheduled 3x per week`,
              active: true,
            })
          }
        } else if (frequency === '2x_week') {
          const days = getDaysForSkill(category, 2)
          for (const day of days) {
            newRows.push({
              cadence: 'daily',
              day_of_week: day,
              skill: skillName,
              boost_amount: boost,
              label: `${skillName} (2x/week)`,
              description: `Scheduled 2x per week`,
              active: true,
            })
          }
        } else if (frequency === 'weekly') {
          const days = getDaysForSkill(category, 1)
          newRows.push({
            cadence: 'weekly',
            day_of_week: days[0],
            skill: skillName,
            boost_amount: boost,
            label: `${skillName} (weekly)`,
            description: `Scheduled weekly`,
            active: true,
          })
        } else if (frequency === 'fortnightly') {
          const days = getDaysForSkill(category, 1)
          newRows.push({
            cadence: 'weekly',
            day_of_week: days[0],
            skill: skillName,
            boost_amount: 20,
            label: `${skillName} (fortnightly)`,
            description: `Scheduled fortnightly`,
            active: true,
          })
        } else if (frequency === 'monthly') {
          newRows.push({
            cadence: 'monthly',
            day_of_month: 1,
            skill: skillName,
            boost_amount: 40,
            label: `${skillName} (monthly)`,
            description: `Scheduled monthly`,
            active: true,
          })
        }

        if (newRows.length > 0) {
          const { error: insertErr } = await supabase.from('ralf_schedule').insert(newRows)
          if (insertErr) throw insertErr
        }

        refetch()
      } catch (err) {
        console.error('Failed to update schedule:', err)
        setMutationError(err instanceof Error ? err.message : String(err))
        // Revert optimistic value on error so the UI reflects actual DB state
        setOptimistic((prev) => {
          const next = { ...prev }
          delete next[skillName]
          return next
        })
      } finally {
        savingRef.current = false
        setSavingSkill(null)
      }
    },
    [refetch],
  )

  return { entries, loading, error: error || mutationError, deriveFrequency, updateFrequency, savingSkill }
}
