import { useState, useCallback } from 'react'
import { Bell, Plus, Trash2, Loader2 } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase, isConfigured } from '../../utils/supabase'
import type { AgentNotificationConfig } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { SkeletonList } from '../ui/Skeleton'

interface Props {
  agentName: string
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'slack', label: 'Slack' },
] as const

const TRIGGER_OPTIONS = [
  { value: 'on_success', label: 'On success' },
  { value: 'on_failure', label: 'On failure' },
  { value: 'on_every_run', label: 'On every run' },
  { value: 'on_cost_threshold', label: 'On cost threshold' },
] as const

const FREQUENCY_CAP_OPTIONS = [
  { value: null, label: 'No limit' },
  { value: 60, label: 'Max 1 per hour' },
  { value: 1440, label: 'Max 1 per day' },
] as const

const CHANNEL_VARIANT: Record<string, 'info' | 'success' | 'warning'> = {
  email: 'info',
  telegram: 'success',
  slack: 'warning',
}

type NewRule = {
  channel: AgentNotificationConfig['channel']
  trigger: AgentNotificationConfig['trigger']
  cost_threshold_usd: number
  frequency_cap_minutes: number | null
}

export function AgentNotifications({ agentName }: Props) {
  const { data: rules, loading, error, refetch } = useSupabase<AgentNotificationConfig>({
    table: 'agent_notification_config',
    filters: { agent_name: agentName },
    order: { column: 'created_at', ascending: false },
    limit: 50,
  })

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const [newRule, setNewRule] = useState<NewRule>({
    channel: 'email',
    trigger: 'on_failure',
    cost_threshold_usd: 1,
    frequency_cap_minutes: 60,
  })

  const handleCreate = useCallback(async () => {
    if (!isConfigured || !supabase) return
    setSaving(true)
    setMutationError(null)

    const { error: err } = await supabase.from('agent_notification_config').insert({
      agent_name: agentName,
      channel: newRule.channel,
      trigger: newRule.trigger,
      cost_threshold_usd: newRule.trigger === 'on_cost_threshold' ? newRule.cost_threshold_usd : null,
      frequency_cap_minutes: newRule.frequency_cap_minutes,
      active: true,
    })

    setSaving(false)
    if (err) {
      setMutationError(err.message)
    } else {
      setShowForm(false)
      setNewRule({ channel: 'email', trigger: 'on_failure', cost_threshold_usd: 1, frequency_cap_minutes: 60 })
      refetch()
    }
  }, [agentName, newRule, refetch])

  const handleDelete = useCallback(async (id: string) => {
    if (!isConfigured || !supabase) return
    setDeletingId(id)

    const { error: err } = await supabase
      .from('agent_notification_config')
      .delete()
      .eq('id', id)

    setDeletingId(null)
    if (err) {
      setMutationError(err.message)
    } else {
      refetch()
    }
  }, [refetch])

  const handleToggle = useCallback(async (id: string, active: boolean) => {
    if (!isConfigured || !supabase) return

    await supabase
      .from('agent_notification_config')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)

    refetch()
  }, [refetch])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notifications</CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" />
          Add Rule
        </Button>
      </CardHeader>

      {(error || mutationError) && (
        <p className="mb-3 text-sm text-[var(--color-danger)]">{error || mutationError}</p>
      )}

      {/* New rule form */}
      {showForm && (
        <div className="mb-4 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Channel</label>
              <select
                value={newRule.channel}
                onChange={(e) => setNewRule({ ...newRule, channel: e.target.value as NewRule['channel'] })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Trigger</label>
              <select
                value={newRule.trigger}
                onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value as NewRule['trigger'] })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {newRule.trigger === 'on_cost_threshold' && (
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Cost threshold ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newRule.cost_threshold_usd}
                  onChange={(e) => setNewRule({ ...newRule, cost_threshold_usd: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Frequency cap</label>
              <select
                value={newRule.frequency_cap_minutes ?? ''}
                onChange={(e) => setNewRule({ ...newRule, frequency_cap_minutes: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {FREQUENCY_CAP_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              Create Rule
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <SkeletonList rows={3} />
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Bell size={32} className="text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">No notification rules configured.</p>
          <p className="text-xs text-[var(--color-text-muted)]">Add a rule to get alerts when your agent runs.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={CHANNEL_VARIANT[rule.channel] ?? 'neutral'}>
                    {rule.channel}
                  </Badge>
                  <Badge variant="neutral">
                    {rule.trigger.replace('on_', '').replace('_', ' ')}
                  </Badge>
                  {rule.trigger === 'on_cost_threshold' && rule.cost_threshold_usd != null && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      &gt; ${rule.cost_threshold_usd}
                    </span>
                  )}
                  {rule.frequency_cap_minutes != null && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      (max 1/{rule.frequency_cap_minutes >= 1440 ? 'day' : 'hour'})
                    </span>
                  )}
                </div>
              </div>

              <Toggle
                checked={rule.active}
                onChange={(val) => handleToggle(rule.id, val)}
              />

              <button
                onClick={() => handleDelete(rule.id)}
                disabled={deletingId === rule.id}
                className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-red-400"
              >
                {deletingId === rule.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
