import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { promoteToCrm } from '../../utils/promoteToCrm'
import type { BacklinkProspect } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Table } from '../ui/Table'
import { Spinner } from '../ui/Spinner'

const tierVariant: Record<string, 'success' | 'warning' | 'neutral'> = {
  tier_1: 'success',
  tier_2: 'warning',
  tier_3: 'neutral',
}

const sourceVariant: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  tavily: 'info',
  firecrawl: 'success',
  ahrefs: 'warning',
}

export function ProspectList() {
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [promoting, setPromoting] = useState<string | null>(null)
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set())
  const [promoteError, setPromoteError] = useState<string | null>(null)

  const { data, loading, error, refetch } = useSupabase<BacklinkProspect>({
    table: 'seo_backlink_prospects',
    order: { column: 'score', ascending: false },
    limit: 200,
    realtime: true,
  })

  const filtered = data.filter((p) => {
    if (tierFilter && p.tier !== tierFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    if (siteFilter && p.target_site !== siteFilter) return false
    return true
  })

  const tiers = [...new Set(data.map((p) => p.tier).filter(Boolean))] as string[]
  const statuses = [...new Set(data.map((p) => p.status))]
  const sites = [...new Set(data.map((p) => p.target_site).filter(Boolean))] as string[]

  const handlePromote = async (prospect: BacklinkProspect) => {
    setPromoting(prospect.id)
    setPromoteError(null)
    const result = await promoteToCrm(prospect)
    setPromoting(null)
    if (result.success) {
      setPromotedIds((prev) => new Set(prev).add(prospect.id))
      refetch()
    } else {
      setPromoteError(result.error ?? 'Promotion failed')
    }
  }

  const columns = [
    {
      key: 'domain',
      header: 'Domain',
      render: (row: BacklinkProspect) => <span className="font-medium">{row.domain}</span>,
    },
    {
      key: 'dr',
      header: 'DR',
      render: (row: BacklinkProspect) => <span>{row.dr ?? '—'}</span>,
    },
    {
      key: 'monthly_traffic',
      header: 'Traffic',
      render: (row: BacklinkProspect) => (
        <span>{row.monthly_traffic ? row.monthly_traffic.toLocaleString() : '—'}</span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row: BacklinkProspect) => <span className="font-medium">{row.score}</span>,
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (row: BacklinkProspect) => (
        row.tier ? <Badge variant={tierVariant[row.tier] ?? 'neutral'}>{row.tier.replace(/_/g, ' ')}</Badge> : <span>—</span>
      ),
    },
    {
      key: 'discovery_method',
      header: 'Source',
      render: (row: BacklinkProspect) => {
        const method = row.discovery_method ?? 'unknown'
        const variant = sourceVariant[method] ?? 'neutral'
        return <Badge variant={variant}>{method.replace(/_/g, ' ')}</Badge>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: BacklinkProspect) => (
        <Badge variant={row.reply_received ? 'success' : row.status === 'new' ? 'info' : row.status === 'promoted' ? 'warning' : 'neutral'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'outreach_angle',
      header: 'Angle',
      render: (row: BacklinkProspect) => (
        <span className="max-w-xs truncate text-xs text-[var(--color-text-muted)]">
          {row.outreach_angle?.slice(0, 60) ?? '—'}
        </span>
      ),
      className: 'max-w-xs',
    },
    {
      key: 'actions',
      header: '',
      render: (row: BacklinkProspect) => {
        const isPromoted = row.status === 'promoted' || promotedIds.has(row.id)
        return isPromoted ? (
          <span className="text-xs text-[var(--color-text-muted)]">Promoted</span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={promoting === row.id}
            onClick={(e) => {
              e.stopPropagation()
              handlePromote(row)
            }}
          >
            <ArrowUpRight size={14} className="mr-1" />
            {promoting === row.id ? 'Promoting...' : 'To CRM'}
          </Button>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Backlink Prospects ({filtered.length})</CardTitle>
        <div className="flex flex-wrap gap-2">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
          >
            <option value="">All tiers</option>
            {tiers.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      {promoteError && (
        <p className="px-4 text-sm text-[var(--color-danger)]">{promoteError}</p>
      )}
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : (
        <Table columns={columns} data={filtered} />
      )}
    </Card>
  )
}
