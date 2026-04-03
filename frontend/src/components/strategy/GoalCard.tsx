import { useState } from 'react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { CampaignGoal } from '../../types/database'

interface GoalCardProps {
  goal: CampaignGoal
  onUpdate: (id: string, fields: Partial<Pick<CampaignGoal, 'target_3m' | 'target_6m' | 'target_12m' | 'notes'>>) => Promise<void>
  saving: boolean
}

function parseTargetNumber(target: string | null): number | null {
  if (!target) return null
  const cleaned = target.replace(/,/g, '')
  const match = cleaned.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

function getStatus(current: number, target: number | null): { label: string; variant: 'success' | 'warning' | 'danger' | 'info' } {
  if (target === null || target === 0) return { label: 'No target', variant: 'info' }
  const pct = (current / target) * 100
  if (pct >= 100) return { label: 'Achieved', variant: 'success' }
  if (pct >= 75) return { label: 'On track', variant: 'success' }
  if (pct >= 40) return { label: 'Behind', variant: 'warning' }
  return { label: 'Critical', variant: 'danger' }
}

export function GoalCard({ goal, onUpdate, saving }: GoalCardProps) {
  const [editing, setEditing] = useState(false)
  const [targets, setTargets] = useState({
    target_3m: goal.target_3m ?? '',
    target_6m: goal.target_6m ?? '',
    target_12m: goal.target_12m ?? '',
  })

  const targetNum = parseTargetNumber(goal.target_3m)
  const pct = targetNum ? Math.min(100, (goal.current_value / targetNum) * 100) : null
  const status = getStatus(goal.current_value, targetNum)

  const handleSave = async () => {
    await onUpdate(goal.id, targets)
    setEditing(false)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text)]">{goal.description}</h4>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{goal.metric}</p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      {pct !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium text-[var(--color-text)]">{goal.current_value}</span>
            <span className="text-[var(--color-text-muted)]">/ {goal.target_3m} ({pct.toFixed(0)}%)</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Editable targets */}
      {editing && (
        <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3">
          {(['target_3m', 'target_6m', 'target_12m'] as const).map((field) => (
            <div key={field} className="flex items-center gap-2">
              <label className="w-16 shrink-0 text-xs text-[var(--color-text-muted)]">
                {field === 'target_3m' ? '3 month' : field === 'target_6m' ? '6 month' : '12 month'}
              </label>
              <input
                type="text"
                value={targets[field]}
                onChange={(e) => setTargets((prev) => ({ ...prev, [field]: e.target.value }))}
                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Last measured */}
      {goal.last_measured_at && (
        <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
          Last measured: {new Date(goal.last_measured_at).toLocaleDateString()}
        </p>
      )}
    </Card>
  )
}
