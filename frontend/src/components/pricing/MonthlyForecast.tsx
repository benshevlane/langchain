import { useMemo } from 'react'
import type { LlmCostLog } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface Props {
  data: LlmCostLog[]
  modelTierMap: Record<string, string>
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function MonthlyForecast({ data, modelTierMap }: Props) {
  const forecast = useMemo(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = now.getMonth()
    const prefix = `${yyyy}-${String(mm + 1).padStart(2, '0')}`
    const dayOfMonth = now.getDate()
    const totalDays = daysInMonth(yyyy, mm)

    const tierSpend: Record<string, number> = { Haiku: 0, Sonnet: 0, Opus: 0 }
    let monthTotal = 0

    for (const row of data) {
      if (!row.created_at.startsWith(prefix)) continue
      const tier = modelTierMap[row.model] ?? 'Sonnet'
      tierSpend[tier] = (tierSpend[tier] ?? 0) + row.cost_usd
      monthTotal += row.cost_usd
    }

    if (dayOfMonth === 0 || monthTotal === 0) {
      return { monthTotal: 0, projected: 0, tiers: [], dayOfMonth, totalDays }
    }

    const dailyAvg = monthTotal / dayOfMonth
    const projected = dailyAvg * totalDays

    const tiers = Object.entries(tierSpend)
      .filter(([, spent]) => spent > 0)
      .map(([name, spent]) => ({
        name,
        spent,
        projected: monthTotal > 0 ? (spent / monthTotal) * projected : 0,
        pct: monthTotal > 0 ? (spent / monthTotal) * 100 : 0,
      }))
      .sort((a, b) => b.spent - a.spent)

    return { monthTotal, projected, tiers, dayOfMonth, totalDays }
  }, [data, modelTierMap])

  const budgetStatus: 'success' | 'warning' | 'danger' =
    forecast.projected < 150 ? 'success' : forecast.projected < 200 ? 'warning' : 'danger'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Forecast</CardTitle>
      </CardHeader>

      {forecast.monthTotal === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No data this month</p>
      ) : (
        <div className="space-y-4">
          {/* Headline projected total */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[var(--color-text)]">
              ${forecast.projected.toFixed(2)}
            </span>
            <Badge variant={budgetStatus}>
              {budgetStatus === 'success' ? 'On track' : budgetStatus === 'warning' ? 'Near cap' : 'Over pace'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Based on ${forecast.monthTotal.toFixed(2)} spent over {forecast.dayOfMonth} of {forecast.totalDays} days
          </p>

          {/* Per-tier breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium text-right">Spent</th>
                  <th className="px-3 py-2 font-medium text-right">Projected</th>
                  <th className="px-3 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {forecast.tiers.map((t) => (
                  <tr key={t.name} className="border-b border-[var(--color-border)]">
                    <td className="px-3 py-2 text-[var(--color-text)]">{t.name}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text)]">${t.spent.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text)]">${t.projected.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{t.pct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
