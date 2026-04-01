import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import type { StrategyConfig } from '../../types/database'

interface ConfigGroupProps {
  category: string
  configs: StrategyConfig[]
  onUpdate: (key: string, value: string) => Promise<void>
  savingKey: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  content: 'Content',
  prospecting: 'Prospecting',
  outreach: 'Outreach',
}

function ConfigField({ config, onUpdate, saving }: {
  config: StrategyConfig
  onUpdate: (key: string, value: string) => Promise<void>
  saving: boolean
}) {
  const [value, setValue] = useState(config.value)
  const [dirty, setDirty] = useState(false)

  const handleChange = (newValue: string) => {
    setValue(newValue)
    setDirty(newValue !== config.value)
  }

  const handleSave = async () => {
    await onUpdate(config.key, value)
    setDirty(false)
  }

  const handleReset = () => {
    setValue(config.value)
    setDirty(false)
  }

  const isTextarea = config.value_type === 'textarea' || config.value_type === 'json'

  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-[var(--color-text)]">
          {config.label || config.key}
        </label>
        {dirty && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={handleReset} disabled={saving}>Reset</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      {config.description && (
        <p className="text-xs text-[var(--color-text-muted)]">{config.description}</p>
      )}
      {isTextarea ? (
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          rows={config.value_type === 'json' ? 4 : 2}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none resize-y"
        />
      ) : (
        <input
          type={config.value_type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
        />
      )}
    </div>
  )
}

export function ConfigGroup({ category, configs, onUpdate, savingKey }: ConfigGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{CATEGORY_LABELS[category] || category}</CardTitle>
      </CardHeader>
      <div className="divide-y divide-[var(--color-border)]">
        {configs.map((config) => (
          <ConfigField
            key={config.key}
            config={config}
            onUpdate={onUpdate}
            saving={savingKey === config.key}
          />
        ))}
      </div>
    </Card>
  )
}
