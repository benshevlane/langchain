import type { ReactNode } from 'react'

export interface Tab {
  key: string
  label: string
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
