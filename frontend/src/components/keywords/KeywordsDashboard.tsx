import { useSupabase } from '../../hooks/useSupabase'
import { useSite } from '../../context/SiteContext'
import { Spinner } from '../ui/Spinner'
import { KeywordStatsCards } from './KeywordStatsCards'
import { KeywordsTable } from './KeywordsTable'
import { RankMovers } from './RankMovers'
import type { RankingEntry } from '../../types/database'

export function KeywordsDashboard() {
  const { selectedSite, siteConfig } = useSite()

  const { data, loading, error } = useSupabase<RankingEntry>({
    table: 'seo_our_rankings',
    order: { column: 'snapshot_date', ascending: false },
    limit: 500,
    filters: { target_site: selectedSite },
  })

  if (loading) return <Spinner />

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-danger)]">{error}</p>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-muted)]">
        Showing rankings for <span className="font-medium text-[var(--color-text)]">{siteConfig.domain}</span>
      </p>
      <KeywordStatsCards data={data} />
      <KeywordsTable data={data} />
      <RankMovers data={data} />
    </div>
  )
}
