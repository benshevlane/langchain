import { useCallback, useState } from 'react'
import { X, Mail, Phone, Globe, MapPin, Edit2, Save, Plus } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase, isConfigured } from '../../utils/supabase'
import type { CrmContact, CrmInteraction } from '../../types/database'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

interface Props {
  contact: CrmContact
  onClose: () => void
  onUpdated?: () => void
}

const STATUS_OPTIONS = [
  'not_contacted',
  'contacted',
  'replied',
  'partnership_active',
  'declined',
  'blocked',
]

const INTERACTION_TYPES = [
  'email_sent',
  'email_received',
  'phone_call',
  'meeting',
  'note',
  'social_dm',
]

export function ContactDetail({ contact, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editFields, setEditFields] = useState({
    company_name: contact.company_name,
    contact_name: contact.contact_name ?? '',
    contact_role: contact.contact_role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    website: contact.website ?? '',
    outreach_status: contact.outreach_status,
    notes: contact.notes ?? '',
  })

  const [showNewInteraction, setShowNewInteraction] = useState(false)
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: 'note',
    direction: 'outbound',
    subject: '',
    body_preview: '',
  })
  const [savingInteraction, setSavingInteraction] = useState(false)

  const { data: interactions, loading: loadingInteractions, error: interactionsError, refetch: refetchInteractions } = useSupabase<CrmInteraction>({
    table: 'crm_interactions',
    filters: { contact_id: contact.id },
    order: { column: 'created_at', ascending: false },
    limit: 50,
    realtime: true,
  })

  const handleSave = useCallback(async () => {
    if (!isConfigured || !supabase) return
    setSaving(true)
    const { error } = await supabase
      .from('crm_contacts')
      .update({
        company_name: editFields.company_name,
        contact_name: editFields.contact_name || null,
        contact_role: editFields.contact_role || null,
        email: editFields.email || null,
        phone: editFields.phone || null,
        website: editFields.website || null,
        outreach_status: editFields.outreach_status,
        notes: editFields.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)

    setSaving(false)
    if (!error) {
      setEditing(false)
      onUpdated?.()
    }
  }, [contact.id, editFields, onUpdated])

  const handleAddInteraction = useCallback(async () => {
    if (!isConfigured || !supabase) return
    setSavingInteraction(true)
    const { error } = await supabase.from('crm_interactions').insert({
      contact_id: contact.id,
      interaction_type: newInteraction.interaction_type,
      direction: newInteraction.direction,
      channel: newInteraction.interaction_type.includes('email') ? 'email' : 'other',
      subject: newInteraction.subject || null,
      body_preview: newInteraction.body_preview || null,
      status: 'completed',
      performed_by: 'user',
    })

    setSavingInteraction(false)
    if (!error) {
      setShowNewInteraction(false)
      setNewInteraction({ interaction_type: 'note', direction: 'outbound', subject: '', body_preview: '' })
      refetchInteractions()
    }
  }, [contact.id, newInteraction, refetchInteractions])

  const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {editing ? (
              <input
                value={editFields.company_name}
                onChange={(e) => setEditFields((f) => ({ ...f, company_name: e.target.value }))}
                className={`${inputClass} text-lg font-semibold`}
              />
            ) : (
              <h2 className="text-lg font-semibold">{contact.company_name}</h2>
            )}
            {!editing && contact.contact_name && (
              <p className="text-sm text-[var(--color-text-muted)]">
                {contact.contact_name} {contact.contact_role ? `· ${contact.contact_role}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {editing ? (
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                <Save size={14} className="mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Edit2 size={14} className="mr-1" />
                Edit
              </Button>
            )}
            <button onClick={onClose} className="rounded p-1 hover:bg-[var(--color-surface-hover)]">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Details */}
        {editing ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contact Name</label>
              <input value={editFields.contact_name} onChange={(e) => setEditFields((f) => ({ ...f, contact_name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Role</label>
              <input value={editFields.contact_role} onChange={(e) => setEditFields((f) => ({ ...f, contact_role: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Email</label>
              <input value={editFields.email} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))} className={inputClass} type="email" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Phone</label>
              <input value={editFields.phone} onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Website</label>
              <input value={editFields.website} onChange={(e) => setEditFields((f) => ({ ...f, website: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Status</label>
              <select
                value={editFields.outreach_status}
                onChange={(e) => setEditFields((f) => ({ ...f, outreach_status: e.target.value }))}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Notes</label>
              <textarea
                value={editFields.notes}
                onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))}
                className={inputClass}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Mail size={14} /> {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Phone size={14} /> {contact.phone}
              </div>
            )}
            {contact.website && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <Globe size={14} /> {contact.website}
              </div>
            )}
            {(contact.city || contact.region) && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <MapPin size={14} /> {[contact.city, contact.region, contact.postcode].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {!editing && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="info">{contact.category.replace(/_/g, ' ')}</Badge>
              {contact.tier && <Badge variant="warning">{contact.tier.replace(/_/g, ' ')}</Badge>}
              <Badge variant={contact.outreach_status === 'partnership_active' ? 'success' : 'neutral'}>
                {contact.outreach_status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="neutral">Score: {contact.score}</Badge>
            </div>

            {contact.source && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Source: {contact.source}
              </p>
            )}

            {contact.notes && (
              <div className="mt-4 rounded-lg bg-[var(--color-bg)] p-3 text-sm text-[var(--color-text-muted)]">
                {contact.notes}
              </div>
            )}
          </>
        )}

        {/* Interaction timeline */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Interactions {loadingInteractions ? '' : `(${interactions.length})`}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowNewInteraction((v) => !v)}>
            <Plus size={14} className="mr-1" />
            Log
          </Button>
        </div>

        {/* New interaction form */}
        {showNewInteraction && (
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex gap-2">
              <select
                value={newInteraction.interaction_type}
                onChange={(e) => setNewInteraction((n) => ({ ...n, interaction_type: e.target.value }))}
                className={`${inputClass} w-auto`}
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select
                value={newInteraction.direction}
                onChange={(e) => setNewInteraction((n) => ({ ...n, direction: e.target.value }))}
                className={`${inputClass} w-auto`}
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <input
              value={newInteraction.subject}
              onChange={(e) => setNewInteraction((n) => ({ ...n, subject: e.target.value }))}
              placeholder="Subject"
              className={inputClass}
            />
            <textarea
              value={newInteraction.body_preview}
              onChange={(e) => setNewInteraction((n) => ({ ...n, body_preview: e.target.value }))}
              placeholder="Details..."
              rows={2}
              className={inputClass}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddInteraction} disabled={savingInteraction}>
                {savingInteraction ? 'Saving...' : 'Add Interaction'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3">
          {loadingInteractions ? (
            <Spinner />
          ) : interactionsError ? (
            <p className="text-sm text-[var(--color-danger)]">{interactionsError}</p>
          ) : interactions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No interactions recorded</p>
          ) : (
            <div className="space-y-3">
              {interactions.map((i) => (
                <div
                  key={i.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{i.interaction_type.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">{i.direction}</span>
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                      {new Date(i.created_at).toLocaleString()}
                    </span>
                  </div>
                  {i.subject && <p className="mt-1 text-sm font-medium">{i.subject}</p>}
                  {i.body_preview && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{i.body_preview}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">by {i.performed_by}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
