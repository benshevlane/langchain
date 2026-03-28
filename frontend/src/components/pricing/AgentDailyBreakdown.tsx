import { useMemo } from 'react'
import type { LlmCostLog } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'

interface Props {
  data: LlmCostLog[]
  taskAgentMap: Record<string, string>
}

interface DayRow {
  date: string
  ralf: number
  scraper: number
  other: number
  total: number
}

export function AgentDailyBreakdown({ data, taskAgentMap }: Props) {
  const rows: DayRow[] = useMemo(() => {
    const byDay: Record<string, { ralf: number; scraper: number; other: number }> = {}

    for (const row of data) {
      const day = row.created_at.slice(0, 10)
      if (!byDay[day]) byDay[day] = { ralf: 0, scraper: 0, other: 0 }
      const agent = taskAgentMap[row.task_type] ?? 'other'
      const bucket = agent === 'ralf' ? 'ralf' : agent === 'scraper' ? 'scraper' : 'other'
      byDay[day][bucket] += row.cost_usd
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
      .map(([date, agents]) => ({
        date,
        ralf: +agents.ralf.toFixed(4),
        scraper: +agents.scraper.toFixed(4),
        other: +agents.other.toFixed(4),
        total: +(agents.ralf + agents.scraper + agents.other).toFixed(4),
      }))
  }, [data, taskAgentMap])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Agent Breakdown</CardTitle>
      </CardHeader>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No cost data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Ralf</th>
                <th className="px-4 py-3 font-medium text-right">Scraper</th>
                <th className="px-4 py-3 font-medium text-right">Other</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-b border-[var(--color-border)]">
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.date}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text)]">${row.ralf.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text)]">${row.scraper.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">${row.other.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                    ${row.total.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
