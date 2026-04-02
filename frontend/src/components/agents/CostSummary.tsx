import { useMemo } from 'react'
import { DollarSign, Zap, TrendingUp } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { useSite } from '../../context/SiteContext'
import type { LlmCostLog } from '../../types/database'
import { Card } from '../ui/Card'
import { SkeletonLine } from '../ui/Skeleton'

interface Props {
  agentName: string
}

function getStartOfWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getStartOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

interface PeriodStat {
  label: string
  cost: number
  inputTokens: number
  outputTokens: number
  icon: React.ReactNode
}

export function CostSummary({ agentName }: Props) {
  const { selectedSite } = useSite()
  const { data, loading } = useSupabase<LlmCostLog>({
    table: 'llm_cost_log',
    order: { column: 'created_at', ascending: false },
    limit: 1000,
    realtime: true,
    filters: { site: selectedSite },
  })

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekStart = getStartOfWeek()
    const monthStart = getStartOfMonth()

    // Filter relevant data (best-effort agent matching via task_type or site fields)
    const agentData = agentName
      ? data.filter(
          (r) =>
            r.task_type?.toLowerCase().includes(agentName.toLowerCase()) ||
            r.site?.toLowerCase().includes(agentName.toLowerCase()) ||
            !agentName // show all if no specific match pattern
        )
      : data

    const todayData = agentData.filter((r) => r.created_at.startsWith(todayStr))
    const weekData = agentData.filter((r) => r.created_at >= weekStart)
    const monthData = agentData.filter((r) => r.created_at >= monthStart)

    const aggregate = (rows: LlmCostLog[]) => ({
      cost: rows.reduce((sum, r) => sum + r.cost_usd, 0),
      inputTokens: rows.reduce((sum, r) => sum + r.input_tokens, 0),
      outputTokens: rows.reduce((sum, r) => sum + r.output_tokens, 0),
    })

    const today = aggregate(todayData)
    const week = aggregate(weekData)
    const month = aggregate(monthData)

    return [
      { label: 'Today', ...today, icon: <DollarSign size={16} className="text-emerald-400" /> },
      { label: 'This Week', ...week, icon: <TrendingUp size={16} className="text-blue-400" /> },
      { label: 'This Month', ...month, icon: <Zap size={16} className="text-amber-400" /> },
    ] as PeriodStat[]
  }, [data, agentName])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="space-y-3">
              <SkeletonLine className="!h-3 !w-20" />
              <SkeletonLine className="!h-6 !w-24" />
              <SkeletonLine className="!h-3 !w-32" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <div className="flex items-center gap-2">
            {stat.icon}
            <span className="text-sm font-medium text-[var(--color-text-muted)]">{stat.label}</span>
          </div>
          <p className="mt-2 text-2xl font-bold">${stat.cost.toFixed(4)}</p>
          <div className="mt-2 flex gap-4 text-xs text-[var(--color-text-muted)]">
            <span>In: {stat.inputTokens.toLocaleString()}</span>
            <span>Out: {stat.outputTokens.toLocaleString()}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
