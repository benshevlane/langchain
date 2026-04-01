import { useMemo } from 'react'
import { CheckCircle2, XCircle, Clock, RefreshCw, Zap } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonList } from '../ui/Skeleton'
import type { ScheduleLogEntry, AgentTurn } from '../../types/database'

interface Props {
  agentName: string
}

interface UnifiedEntry {
  id: string
  timestamp: string
  action: string
  agent: string
  status: 'success' | 'error' | 'pending'
  detail: string | null
  source: 'schedule' | 'turn'
  cost: string | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSkill(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const statusIcon = {
  success: <CheckCircle2 size={16} className="text-emerald-500" />,
  error: <XCircle size={16} className="text-red-500" />,
  pending: <Clock size={16} className="text-[var(--color-text-muted)]" />,
}

const statusBadge = {
  success: 'success' as const,
  error: 'danger' as const,
  pending: 'neutral' as const,
}

export function ActivityTimeline({ agentName }: Props) {
  const { data: scheduleData, loading: loadingSchedule, refetch: refetchSchedule } = useSupabase<ScheduleLogEntry>({
    table: 'ralf_schedule_log',
    order: { column: 'created_at', ascending: false },
    limit: 50,
  })

  const { data: turnData, loading: loadingTurns, refetch: refetchTurns } = useSupabase<AgentTurn>({
    table: 'agent_turns',
    order: { column: 'created_at', ascending: false },
    limit: 50,
    filters: { agent_name: agentName },
    realtime: true,
  })

  const loading = loadingSchedule || loadingTurns

  const entries = useMemo(() => {
    const unified: UnifiedEntry[] = []

    for (const s of scheduleData) {
      unified.push({
        id: `sched-${s.id}`,
        timestamp: s.completed_at ?? s.created_at,
        action: formatSkill(s.skill),
        agent: agentName,
        status: s.status === 'done' ? 'success' : s.status === 'failed' ? 'error' : 'pending',
        detail: s.summary ?? null,
        source: 'schedule',
        cost: null,
      })
    }

    for (const t of turnData) {
      unified.push({
        id: `turn-${t.id}`,
        timestamp: t.created_at,
        action: `${t.turn_type} turn`,
        agent: t.agent_name,
        status: 'success',
        detail: t.input?.slice(0, 120) ?? null,
        source: 'turn',
        cost: t.tokens_used > 0 ? `${t.tokens_used.toLocaleString()} tokens` : null,
      })
    }

    unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return unified.slice(0, 50)
  }, [scheduleData, turnData, agentName])

  const handleRefresh = () => {
    refetchSchedule()
    refetchTurns()
  }

  // Group by date
  const byDate = useMemo(() => {
    const groups: Record<string, UnifiedEntry[]> = {}
    for (const entry of entries) {
      const date = entry.timestamp.slice(0, 10)
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return groups
  }, [entries])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Activity</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </CardHeader>

      {loading ? (
        <SkeletonList rows={6} />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Clock size={32} className="text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">No activity recorded yet for this agent.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate).map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
                {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <div className="space-y-1.5">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    <div className="mt-0.5">
                      {statusIcon[entry.status]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.action}</span>
                        <Badge variant={statusBadge[entry.status]}>
                          {entry.status}
                        </Badge>
                        <Badge variant="neutral">{entry.source}</Badge>
                      </div>
                      {entry.detail && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                          {entry.detail}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatTime(entry.timestamp)}
                      </span>
                      {entry.cost && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-400">
                          <Zap size={10} />
                          {entry.cost}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
