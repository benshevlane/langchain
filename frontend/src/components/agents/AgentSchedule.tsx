import { useState, useCallback, useMemo } from 'react'
import { Hammer, Activity, Clock, Save, Loader2, CalendarClock } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase, isConfigured } from '../../utils/supabase'
import type { AgentScheduleConfig } from '../../types/database'
import { AGENT_JOB_IDS } from './AgentDashboard'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { SkeletonList } from '../ui/Skeleton'

interface Props {
  agentName: string
}

const JOB_META: Record<string, { icon: React.ReactNode; label: string; description: string; badgeVariant: 'success' | 'warning' }> = {
  worker: {
    icon: <Hammer size={18} className="text-emerald-400" />,
    label: 'Worker — Heavy Tasks',
    description: 'Compute-intensive tasks: content writing, keyword research, prospect enrichment, blog publishing. Typically every 3 hours.',
    badgeVariant: 'success',
  },
  pulse: {
    icon: <Activity size={18} className="text-amber-400" />,
    label: 'Pulse — Monitoring',
    description: 'Lightweight heartbeat: ranking changes, budget alerts, blocker escalation, progress summaries. Typically every 60 minutes.',
    badgeVariant: 'warning',
  },
  scraper_batch: {
    icon: <CalendarClock size={18} className="text-purple-400" />,
    label: 'Scraper Batch',
    description: 'Batch web scraping and data collection tasks.',
    badgeVariant: 'success',
  },
}

const FREQUENCY_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom (cron)' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type LocalConfig = {
  job_id: string
  frequency: string
  time_of_day: string
  day_of_week: number
  cron_expression: string
  active: boolean
  existingId: string | null
  next_run_at: string | null
}

function computeNextRun(config: LocalConfig): string | null {
  const now = new Date()
  if (!config.active) return null

  if (config.frequency === 'hourly') {
    const next = new Date(now)
    next.setHours(next.getHours() + 1, 0, 0, 0)
    return next.toISOString()
  }
  if (config.frequency === 'daily' && config.time_of_day) {
    const [h, m] = config.time_of_day.split(':').map(Number)
    const next = new Date(now)
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.toISOString()
  }
  if (config.frequency === 'weekly' && config.time_of_day) {
    const [h, m] = config.time_of_day.split(':').map(Number)
    const next = new Date(now)
    const daysUntil = (config.day_of_week - now.getDay() + 7) % 7 || 7
    next.setDate(now.getDate() + daysUntil)
    next.setHours(h, m, 0, 0)
    return next.toISOString()
  }
  return null
}

export function AgentSchedule({ agentName }: Props) {
  const jobIds = AGENT_JOB_IDS[agentName] ?? []

  const { data: configs, loading, refetch } = useSupabase<AgentScheduleConfig>({
    table: 'agent_schedule_config',
    filters: { agent_name: agentName },
    limit: 20,
  })

  const [localConfigs, setLocalConfigs] = useState<Record<string, LocalConfig> | null>(null)
  const [savingJob, setSavingJob] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Merge DB configs with defaults
  const mergedConfigs = useMemo(() => {
    const result: Record<string, LocalConfig> = {}
    for (const jobId of jobIds) {
      const existing = configs.find((c) => c.job_id === jobId)
      result[jobId] = {
        job_id: jobId,
        frequency: existing?.frequency ?? 'daily',
        time_of_day: existing?.time_of_day ?? '09:00',
        day_of_week: existing?.day_of_week ?? 1,
        cron_expression: existing?.cron_expression ?? '',
        active: existing?.active ?? true,
        existingId: existing?.id ?? null,
        next_run_at: existing?.next_run_at ?? null,
      }
    }
    return result
  }, [configs, jobIds])

  // Use local state if user has made edits, otherwise use DB
  const displayConfigs = localConfigs ?? mergedConfigs

  const updateLocalConfig = (jobId: string, patch: Partial<LocalConfig>) => {
    setLocalConfigs((prev) => {
      const base = prev ?? mergedConfigs
      return { ...base, [jobId]: { ...base[jobId], ...patch } }
    })
  }

  const handleSave = useCallback(async (jobId: string) => {
    if (!isConfigured || !supabase) return
    const config = displayConfigs[jobId]
    if (!config) return

    setSavingJob(jobId)
    setError(null)

    const nextRun = computeNextRun(config)

    const payload = {
      agent_name: agentName,
      job_id: jobId,
      frequency: config.frequency,
      time_of_day: config.time_of_day || null,
      day_of_week: config.frequency === 'weekly' ? config.day_of_week : null,
      cron_expression: config.frequency === 'custom' ? config.cron_expression : null,
      active: config.active,
      next_run_at: nextRun,
      updated_at: new Date().toISOString(),
    }

    let err
    if (config.existingId) {
      const result = await supabase
        .from('agent_schedule_config')
        .update(payload)
        .eq('id', config.existingId)
      err = result.error
    } else {
      const result = await supabase.from('agent_schedule_config').insert(payload)
      err = result.error
    }

    setSavingJob(null)
    if (err) {
      setError(err.message)
    } else {
      setLocalConfigs(null)
      refetch()
    }
  }, [displayConfigs, agentName, refetch])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <SkeletonList rows={3} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {jobIds.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8">
            <CalendarClock size={32} className="text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No jobs configured for this agent.</p>
          </div>
        </Card>
      ) : (
        jobIds.map((jobId) => {
          const meta = JOB_META[jobId] ?? {
            icon: <CalendarClock size={18} className="text-[var(--color-text-muted)]" />,
            label: jobId,
            description: '',
            badgeVariant: 'success' as const,
          }
          const config = displayConfigs[jobId]
          if (!config) return null

          const nextRun = computeNextRun(config)

          return (
            <Card key={jobId}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-hover)]">
                    {meta.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{meta.label}</h3>
                      <Badge variant={meta.badgeVariant}>{jobId}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{meta.description}</p>
                  </div>
                </div>
                <Toggle
                  checked={config.active}
                  onChange={(val) => updateLocalConfig(jobId, { active: val })}
                />
              </div>

              {/* Config fields */}
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-4 md:grid-cols-3">
                {/* Frequency */}
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Frequency</label>
                  <select
                    value={config.frequency}
                    onChange={(e) => updateLocalConfig(jobId, { frequency: e.target.value })}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Time of day (for daily/weekly) */}
                {(config.frequency === 'daily' || config.frequency === 'weekly') && (
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Time of day</label>
                    <input
                      type="time"
                      value={config.time_of_day}
                      onChange={(e) => updateLocalConfig(jobId, { time_of_day: e.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                )}

                {/* Day of week (for weekly) */}
                {config.frequency === 'weekly' && (
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Day of week</label>
                    <div className="flex gap-1">
                      {DAYS.map((day, i) => (
                        <button
                          key={day}
                          onClick={() => updateLocalConfig(jobId, { day_of_week: i })}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            config.day_of_week === i
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cron expression (for custom) */}
                {config.frequency === 'custom' && (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Cron expression</label>
                    <input
                      type="text"
                      value={config.cron_expression}
                      onChange={(e) => updateLocalConfig(jobId, { cron_expression: e.target.value })}
                      placeholder="0 */3 * * *"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                )}
              </div>

              {/* Footer: next run + save */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <Clock size={12} />
                  <span>
                    Next run: {nextRun && config.active
                      ? new Date(nextRun).toLocaleString()
                      : config.active ? 'Not scheduled' : 'Disabled'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(jobId)}
                  disabled={savingJob === jobId}
                >
                  {savingJob === jobId ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Save size={14} className="mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
