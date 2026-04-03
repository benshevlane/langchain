import { Globe } from 'lucide-react'
import { SITES, useSite } from '../context/SiteContext'

export function SiteSwitcher() {
  const { selectedSite, setSelectedSite } = useSite()

  return (
    <div className="flex w-full items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
      <Globe size={16} className="shrink-0 text-[var(--color-text-muted)]" />
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg)] p-1">
        {SITES.map((site) => (
          <button
            key={site.id}
            onClick={() => setSelectedSite(site.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedSite === site.id
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="block">{site.label}</span>
            <span className="block text-[10px] font-normal opacity-70">{site.domain}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
