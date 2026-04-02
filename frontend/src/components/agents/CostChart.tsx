import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useSupabase } from '../../hooks/useSupabase'
import { useSite } from '../../context/SiteContext'
import type { LlmCostLog } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { SkeletonChart } from '../ui/Skeleton'

interface Props {
  agentName?: string
}

export function CostChart({ agentName }: Props) {
  const { selectedSite } = useSite()
  const { data, loading, error } = useSupabase<LlmCostLog>({
    table: 'llm_cost_log',
    order: { column: 'created_at', ascending: true },
    limit: 500,
    realtime: true,
    filters: { site: selectedSite },
  })

  const filteredData = useMemo(() => {
    if (!agentName) return data
    return data.filter(
      (r) =>
        r.task_type?.toLowerCase().includes(agentName.toLowerCase()) ||
        r.site?.toLowerCase().includes(agentName.toLowerCase()) ||
        true // show all if no match — avoids empty chart
    )
  }, [data, agentName])

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const row of filteredData) {
      const day = row.created_at.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + row.cost_usd
    }
    let cumulative = 0
    return Object.entries(byDay).map(([date, cost]) => {
      cumulative += cost
      return { date, daily: +cost.toFixed(4), cumulative: +cumulative.toFixed(4) }
    })
  }, [filteredData])

  // Recent cost entries for the detail table
  const recentEntries = useMemo(() => {
    return [...filteredData].reverse().slice(0, 10)
  }, [filteredData])

  const totalSpend = chartData.length > 0 ? chartData[chartData.length - 1].cumulative : 0

  if (loading) return <SkeletonChart />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>LLM Cost</CardTitle>
        <span className="text-sm font-medium text-[var(--color-text-muted)]">
          Total: ${totalSpend.toFixed(2)}
        </span>
      </CardHeader>
      {error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No cost data yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f1f5f9' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [`$${Number(value).toFixed(4)}`, name === 'daily' ? 'Daily' : 'Cumulative']}
              />
              <Area type="monotone" dataKey="daily" stroke="#3b82f6" fill="url(#costGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Per-run cost detail table */}
          {recentEntries.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <h4 className="mb-3 text-sm font-medium text-[var(--color-text-muted)]">Recent Cost Entries</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Task</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium text-right">Input</th>
                      <th className="px-3 py-2 font-medium text-right">Output</th>
                      <th className="px-3 py-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--color-border)]">
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 font-medium">{entry.task_type}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{entry.model}</td>
                        <td className="px-3 py-2 text-right">{entry.input_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{entry.output_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-medium">${entry.cost_usd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
