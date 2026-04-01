import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Link2, RefreshCw } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase, isConfigured } from '../../utils/supabase'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { SkeletonCard } from '../ui/Skeleton'
import type { BacklinkTargetConfig as Config } from '../../types/database'

// Must match discovery_method strings in backlink_prospector.py
const ALL_METHODS = [
  'competitor_backlink',
  'content_explorer',
  'unlinked_mention',
  'resource_page',
  'broken_link',
  'haro',
  'niche_blog_search',
  'company_search',
  'roundup_search',
] as const

const METHOD_LABELS: Record<string, string> = {
  competitor_backlink: 'Competitor Backlink Mining',
  content_explorer: 'Content Explorer',
  unlinked_mention: 'Unlinked Mentions',
  resource_page: 'Resource Pages',
  broken_link: 'Broken Links',
  haro: 'HARO / Journalist Requests',
  niche_blog_search: 'Blogger Discovery',
  company_search: 'Company / Provider',
  roundup_search: 'Roundup / Listicle',
}

const SITES = [
  { key: 'freeroomplanner', label: 'Free Room Planner' },
  { key: 'kitchensdirectory', label: 'Kitchens Directory' },
  { key: 'kitchen_estimator', label: 'Kitchen Estimator' },
  { key: 'ralf_seo', label: 'Ralf SEO' },
]

interface LocalConfig {
  min_dr: number
  enabled_methods: string[]
  excluded_domains: string
  max_prospects_per_method: number
  active: boolean
  notes: string
  existingId: string | null
}

function defaultLocal(): LocalConfig {
  return {
    min_dr: 20,
    enabled_methods: [...ALL_METHODS],
    excluded_domains: '',
    max_prospects_per_method: 50,
    active: true,
    notes: '',
    existingId: null,
  }
}

export function BacklinkTargetConfig() {
  const { data: configs, loading, refetch } = useSupabase<Config>({
    table: 'backlink_target_config',
    realtime: true,
  })

  const [localEdits, setLocalEdits] = useState<Record<string, LocalConfig> | null>(null)
  const [savingSite, setSavingSite] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const merged = useMemo(() => {
    const result: Record<string, LocalConfig> = {}
    for (const site of SITES) {
      const existing = configs.find((c) => c.target_site === site.key)
      if (existing) {
        result[site.key] = {
          min_dr: existing.min_dr,
          enabled_methods: existing.enabled_methods ?? [...ALL_METHODS],
          excluded_domains: (existing.excluded_domains ?? []).join('\n'),
          max_prospects_per_method: existing.max_prospects_per_method,
          active: existing.active,
          notes: existing.notes ?? '',
          existingId: existing.id,
        }
      } else {
        result[site.key] = defaultLocal()
      }
    }
    return result
  }, [configs])

  // Reset local edits when DB data arrives
  useEffect(() => {
    setLocalEdits(null)
  }, [configs])

  const display = localEdits ?? merged

  const update = (siteKey: string, patch: Partial<LocalConfig>) => {
    setLocalEdits((prev) => {
      const base = prev ?? merged
      return { ...base, [siteKey]: { ...base[siteKey], ...patch } }
    })
  }

  const toggleMethod = (siteKey: string, method: string) => {
    const current = display[siteKey].enabled_methods
    const next = current.includes(method)
      ? current.filter((m) => m !== method)
      : [...current, method]
    update(siteKey, { enabled_methods: next })
  }

  const handleSave = useCallback(
    async (siteKey: string) => {
      if (!isConfigured || !supabase) return
      const config = display[siteKey]
      if (!config) return

      setSavingSite(siteKey)
      setError(null)

      const excludedArr = config.excluded_domains
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean)

      const payload = {
        target_site: siteKey,
        min_dr: config.min_dr,
        enabled_methods: config.enabled_methods,
        excluded_domains: excludedArr,
        max_prospects_per_method: config.max_prospects_per_method,
        active: config.active,
        notes: config.notes,
        updated_at: new Date().toISOString(),
      }

      let err
      if (config.existingId) {
        const result = await supabase
          .from('backlink_target_config')
          .update(payload)
          .eq('id', config.existingId)
        err = result.error
      } else {
        const result = await supabase
          .from('backlink_target_config')
          .insert(payload)
        err = result.error
      }

      setSavingSite(null)
      if (err) {
        setError(err.message)
      } else {
        setLocalEdits(null)
        refetch()
      }
    },
    [display, refetch],
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Backlink Targets</h1>
        <SkeletonCard className="w-full" />
        <SkeletonCard className="w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
            <Link2 size={20} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Backlink Targets</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Configure discovery parameters per site
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {SITES.map(({ key, label }) => {
        const config = display[key]
        if (!config) return null
        const saving = savingSite === key

        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{label}</CardTitle>
                <Toggle
                  checked={config.active}
                  onChange={(v) => update(key, { active: v })}
                  label={config.active ? 'Active' : 'Inactive'}
                />
              </div>
            </CardHeader>

            <div className="space-y-5">
              {/* Min DR */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Minimum Domain Rating
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={config.min_dr}
                    onChange={(e) =>
                      update(key, { min_dr: Number(e.target.value) })
                    }
                    className="w-48"
                  />
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">
                    {config.min_dr}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Prospects below this DR are filtered out. Set to 0 to disable.
                </p>
              </div>

              {/* Discovery Methods */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Discovery Methods
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALL_METHODS.map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={config.enabled_methods.includes(method)}
                        onChange={() => toggleMethod(key, method)}
                        className="rounded"
                      />
                      {METHOD_LABELS[method]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Max Prospects per Method */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Max Prospects per Method
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.max_prospects_per_method}
                  onChange={(e) =>
                    update(key, {
                      max_prospects_per_method: Number(e.target.value),
                    })
                  }
                  className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
                />
              </div>

              {/* Excluded Domains */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Excluded Domains
                </label>
                <textarea
                  value={config.excluded_domains}
                  onChange={(e) =>
                    update(key, { excluded_domains: e.target.value })
                  }
                  rows={3}
                  placeholder="One domain per line, e.g. spamsite.com"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>

              {/* Notes / Strategy */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Strategy Notes
                </label>
                <textarea
                  value={config.notes}
                  onChange={(e) => update(key, { notes: e.target.value })}
                  rows={3}
                  placeholder="Document the backlink approach and targets for this site..."
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <Button
                  onClick={() => handleSave(key)}
                  disabled={saving}
                  size="sm"
                >
                  <Save size={14} className="mr-1.5" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
