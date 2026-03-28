import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { LlmCostLog } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'

interface Props {
  data: LlmCostLog[]
  modelTierMap: Record<string, string>
}

const TIER_COLORS: Record<string, string> = {
  Haiku: '#10b981',
  Sonnet: '#3b82f6',
  Opus: '#a855f7',
}

export function DailySpendChart({ data, modelTierMap }: Props) {
  const chartData = useMemo(() => {
    const byDay: Record<string, Record<string, number>> = {}

    for (const row of data) {
      const day = row.created_at.slice(0, 10)
      if (!byDay[day]) byDay[day] = { Haiku: 0, Sonnet: 0, Opus: 0 }
      const tier = modelTierMap[row.model] ?? 'Sonnet'
      byDay[day][tier] = (byDay[day][tier] ?? 0) + row.cost_usd
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tiers]) => ({
        date,
        Haiku: +tiers.Haiku.toFixed(4),
        Sonnet: +tiers.Sonnet.toFixed(4),
        Opus: +tiers.Opus.toFixed(4),
        total: +(tiers.Haiku + tiers.Sonnet + tiers.Opus).toFixed(4),
      }))
  }, [data, modelTierMap])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Spend by Model</CardTitle>
      </CardHeader>
      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No cost data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: '#f1f5f9' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => [`$${Number(value).toFixed(4)}`, name]) as any}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar dataKey="Haiku" stackId="cost" fill={TIER_COLORS.Haiku} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Sonnet" stackId="cost" fill={TIER_COLORS.Sonnet} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Opus" stackId="cost" fill={TIER_COLORS.Opus} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
