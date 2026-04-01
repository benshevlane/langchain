import { useState, useCallback } from 'react'
import { FileText, Plus, Loader2 } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase, isConfigured } from '../../utils/supabase'
import type { AgentFile } from '../../types/database'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonList } from '../ui/Skeleton'
import { FileEditor } from './FileEditor'

interface Props {
  agentName: string
}

const FILE_TYPE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  system_prompt: 'info',
  memory: 'success',
  knowledge: 'warning',
  other: 'neutral',
}

export function AgentFiles({ agentName }: Props) {
  const { data: files, loading, error, refetch } = useSupabase<AgentFile>({
    table: 'agent_files',
    filters: { agent_name: agentName },
    order: { column: 'updated_at', ascending: false },
    limit: 50,
  })

  const [editingFile, setEditingFile] = useState<AgentFile | null>(null)
  const [creating, setCreating] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileType, setNewFileType] = useState('system_prompt')
  const [saving, setSaving] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!isConfigured || !supabase || !newFileName.trim()) return
    setSaving(true)

    const fileName = newFileName.trim().endsWith('.md')
      ? newFileName.trim()
      : `${newFileName.trim()}.md`

    const { error: err } = await supabase.from('agent_files').insert({
      agent_name: agentName,
      file_name: fileName,
      content: '',
      file_type: newFileType,
      char_count: 0,
      word_count: 0,
    })

    setSaving(false)
    if (!err) {
      setCreating(false)
      setNewFileName('')
      refetch()
    }
  }, [agentName, newFileName, newFileType, refetch])

  if (editingFile) {
    return (
      <FileEditor
        file={editingFile}
        onClose={() => { setEditingFile(null); refetch() }}
        onSaved={() => { setEditingFile(null); refetch() }}
      />
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Files</CardTitle>
        <Button size="sm" onClick={() => setCreating(!creating)}>
          <Plus size={14} className="mr-1" />
          New File
        </Button>
      </CardHeader>

      {/* Create file form */}
      {creating && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">File name</label>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="system-prompt.md"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Type</label>
            <select
              value={newFileType}
              onChange={(e) => setNewFileType(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="system_prompt">System Prompt</option>
              <option value="memory">Memory</option>
              <option value="knowledge">Knowledge</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!newFileName.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <FileText size={32} className="text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">No files yet. Create a system prompt to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => setEditingFile(file)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <FileText size={18} className="shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{file.file_name}</span>
                  <Badge variant={FILE_TYPE_VARIANT[file.file_type] ?? 'neutral'}>
                    {file.file_type.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="mt-0.5 flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>{file.word_count} words</span>
                  <span>{file.char_count} chars</span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                {new Date(file.updated_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
