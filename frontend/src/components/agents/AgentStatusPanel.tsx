import { useCallback, useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { useSite } from '../../context/SiteContext'
import { supabase, isConfigured } from '../../utils/supabase'
import type { SiteAgentConfig } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { SkeletonList } from '../ui/Skeleton'

const AGENT_LABELS: Record<string, string> = {
  seo: 'SEO Agent',
  content: 'Content Agent',
  backlink: 'Backlink Agent',
  outreach: 'Outreach Agent',
}

export function AgentStatusPanel() {
  const { selectedSite, siteConfig } = useSite()

  const { data: configs, loading, error, refetch } = useSupabase<SiteAgentConfig>({
    table: 'site_agent_config',
    filters: { site: selectedSite },
    order: { column: 'agent_id', ascending: true },
    limit: 20,
  })

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      if (!isConfigured || !supabase) return
      setTogglingId(id)

      await supabase
        .from('site_agent_config')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id)

      setTogglingId(null)
      refetch()
    },
    [refetch],
  )

  const handleTrigger = useCallback(
    async (config: SiteAgentConfig) => {
      if (!isConfigured || !supabase) return
      setTriggeringId(config.id)

      // Update last_run_at optimistically
      await supabase
        .from('site_agent_config')
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', config.id)

      // Insert a new agent_runs record tagged with the site
      await supabase.from('agent_runs').insert({
        agent_id: config.agent_id,
        site: selectedSite,
        status: 'triggered',
        started_at: new Date().toISOString(),
      })

      setTriggeringId(null)
      refetch()
    },
    [selectedSite, refetch],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Agent Status — {siteConfig.label}
        </CardTitle>
      </CardHeader>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : configs.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No agent configs found for this site. Run the migration to seed defaults.
        </p>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {AGENT_LABELS[config.agent_id] ?? config.agent_id}
                  </span>
                  <Badge variant={config.enabled ? 'success' : 'neutral'}>
                    {config.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  <Badge variant="info">{selectedSite}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Last run:{' '}
                  {config.last_run_at
                    ? new Date(config.last_run_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>

              <Toggle
                checked={config.enabled}
                onChange={(val) => handleToggle(config.id, val)}
                disabled={togglingId === config.id}
              />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleTrigger(config)}
                disabled={!config.enabled || triggeringId === config.id}
              >
                {triggeringId === config.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} className="mr-1" />
                )}
                Run
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
