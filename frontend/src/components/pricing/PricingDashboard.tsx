import { useMemo } from 'react'
import { useSupabase } from '../../hooks/useSupabase'
import type { LlmCostLog } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { DailySpendChart } from './DailySpendChart'
import { MonthlyForecast } from './MonthlyForecast'
import { AgentDailyBreakdown } from './AgentDailyBreakdown'

const MAX_WEEKLY_SPEND = 50

const TASK_AGENT_MAP: Record<string, string> = {
  classify_prospect: 'ralf',
  score_prospect: 'ralf',
  extract_contact_email: 'ralf',
  detect_page_type: 'ralf',
  summarise_page: 'ralf',
  check_reply_intent: 'ralf',
  filter_keywords: 'ralf',
  review_blog_post: 'ralf',
  write_content_brief: 'ralf',
  write_blog_post: 'ralf',
  write_location_page: 'ralf',
  write_tier2_email: 'ralf',
  analyse_content_gap: 'ralf',
  generate_pr_angles: 'ralf',
  write_followup_email: 'ralf',
  write_tier1_email: 'ralf',
  write_digital_pr_pitch: 'ralf',
}

const MODEL_TIER_MAP: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'anthropic/claude-haiku-4.5': 'Haiku',
  'claude-sonnet-4-6': 'Sonnet',
  'anthropic/claude-sonnet-4.6': 'Sonnet',
  'claude-opus-4-6': 'Opus',
  'anthropic/claude-opus-4.6': 'Opus',
}

function getISOWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export function PricingDashboard() {
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString()
  }, [])

  const { data, loading, error } = useSupabase<LlmCostLog>({
    table: 'llm_cost_log',
    order: { column: 'created_at', ascending: true },
    limit: 5000,
    gte: { column: 'created_at', value: ninetyDaysAgo },
  })

  const stats = useMemo(() => {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const weekStart = getISOWeekStart()

    let monthSpend = 0
    let weekSpend = 0

    for (const row of data) {
      if (row.created_at.startsWith(monthPrefix)) monthSpend += row.cost_usd
      if (row.created_at >= weekStart) weekSpend += row.cost_usd
    }

    const weekPct = Math.min((weekSpend / MAX_WEEKLY_SPEND) * 100, 100)

    return { monthSpend, weekSpend, weekPct }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{error}</p>
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Month-to-date */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--color-text-muted)]">Month to Date</CardTitle>
          </CardHeader>
          <p className="text-2xl font-bold text-[var(--color-text)]">${stats.monthSpend.toFixed(2)}</p>
        </Card>

        {/* Weekly budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-[var(--color-text-muted)]">Weekly Budget</CardTitle>
            <Badge variant={stats.weekPct > 80 ? 'danger' : stats.weekPct > 60 ? 'warning' : 'success'}>
              {stats.weekPct.toFixed(0)}%
            </Badge>
          </CardHeader>
          <p className="mb-2 text-2xl font-bold text-[var(--color-text)]">
            ${stats.weekSpend.toFixed(2)}
            <span className="text-sm font-normal text-[var(--color-text-muted)]"> / ${MAX_WEEKLY_SPEND}</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${stats.weekPct}%`,
                backgroundColor:
                  stats.weekPct > 80 ? '#ef4444' : stats.weekPct > 60 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
        </Card>

        {/* Total (last 90 days) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--color-text-muted)]">Last 90 Days</CardTitle>
          </CardHeader>
          <p className="text-2xl font-bold text-[var(--color-text)]">
            ${data.reduce((sum, r) => sum + r.cost_usd, 0).toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Daily spend chart */}
      <DailySpendChart data={data} modelTierMap={MODEL_TIER_MAP} />

      {/* Forecast + Agent breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyForecast data={data} modelTierMap={MODEL_TIER_MAP} />
        <AgentDailyBreakdown data={data} taskAgentMap={TASK_AGENT_MAP} />
      </div>
    </div>
  )
}
