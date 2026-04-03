import { useState, useMemo, useCallback } from 'react'
import { Save, X, Loader2 } from 'lucide-react'
import { supabase, isConfigured } from '../../utils/supabase'
import type { AgentFile } from '../../types/database'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface Props {
  file: AgentFile
  onClose: () => void
  onSaved: () => void
}

export function FileEditor({ file, onClose, onSaved }: Props) {
  const [content, setContent] = useState(file.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const chars = content.length
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    return { chars, words }
  }, [content])

  const hasChanges = content !== file.content

  const handleSave = useCallback(async () => {
    if (!isConfigured || !supabase || !hasChanges) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('agent_files')
      .update({
        content,
        char_count: stats.chars,
        word_count: stats.words,
        updated_at: new Date().toISOString(),
      })
      .eq('id', file.id)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
  }, [content, file.id, hasChanges, stats, onSaved])

  return (
    <Card>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{file.file_name}</h3>
          <Badge variant="neutral">{file.file_type}</Badge>
          {hasChanges && <Badge variant="warning">unsaved</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} className="mr-1" />
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[400px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        placeholder="Enter markdown content..."
        spellCheck={false}
      />

      {/* Footer stats */}
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex gap-4">
          <span>{stats.chars.toLocaleString()} characters</span>
          <span>{stats.words.toLocaleString()} words</span>
        </div>
        <span>
          Last modified: {new Date(file.updated_at).toLocaleString()}
        </span>
      </div>
    </Card>
  )
}
