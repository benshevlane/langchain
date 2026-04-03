import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'

interface BlockedListEditorProps {
  label: string
  description: string
  value: string
  onUpdate: (value: string) => Promise<void>
  saving: boolean
}

export function BlockedListEditor({ label, description, value, onUpdate, saving }: BlockedListEditorProps) {
  const [items, setItems] = useState<string[]>(
    value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
  )
  const [input, setInput] = useState('')
  const [dirty, setDirty] = useState(false)

  const originalItems = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []

  const addItem = () => {
    const trimmed = input.trim()
    if (trimmed && !items.includes(trimmed)) {
      setItems((prev) => [...prev, trimmed])
      setDirty(true)
    }
    setInput('')
  }

  const removeItem = (item: string) => {
    setItems((prev) => prev.filter((i) => i !== item))
    setDirty(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
  }

  const handleSave = async () => {
    await onUpdate(items.join(', '))
    setDirty(false)
  }

  const handleReset = () => {
    setItems(originalItems)
    setDirty(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{label}</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
          </div>
          {dirty && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={handleReset} disabled={saving}>Reset</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Tag pills */}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs text-[var(--color-text)]"
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              className="ml-0.5 rounded-full p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add input */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add item and press Enter"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
        />
        <Button size="sm" variant="secondary" onClick={addItem}>Add</Button>
      </div>

      {items.length === 0 && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">No items blocked yet.</p>
      )}
    </Card>
  )
}
