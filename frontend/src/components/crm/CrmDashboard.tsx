import { useState } from 'react'
import { Users, ArrowRightLeft, CheckCircle, TrendingUp } from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import type { CrmContact } from '../../types/database'
import { ContactsTable } from './ContactsTable'
import { PipelineBoard } from './PipelineBoard'
import { ProspectList } from './ProspectList'
import { InteractionLog } from './InteractionLog'

const TABS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'prospects', label: 'Prospects' },
  { key: 'activity', label: 'Activity' },
] as const

type TabKey = typeof TABS[number]['key']

function KpiCards() {
  const { data } = useSupabase<CrmContact>({
    table: 'crm_contacts',
    limit: 1000,
    realtime: true,
  })

  const total = data.length
  const contacted = data.filter((c) => c.outreach_status !== 'not_contacted').length
  const active = data.filter((c) => c.outreach_status === 'partnership_active').length
  const replied = data.filter((c) => c.outreach_status === 'replied').length
  const responseRate = contacted > 0 ? Math.round(((replied + active) / contacted) * 100) : 0

  const cards = [
    { label: 'Total Contacts', value: total, icon: Users, color: 'text-blue-400' },
    { label: 'Contacted', value: contacted, icon: ArrowRightLeft, color: 'text-amber-400' },
    { label: 'Active Partnerships', value: active, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Response Rate', value: `${responseRate}%`, icon: TrendingUp, color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="flex items-center gap-2">
            <card.icon size={16} className={card.color} />
            <span className="text-xs text-[var(--color-text-muted)]">{card.label}</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

export function CrmDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('contacts')

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <KpiCards />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'contacts' && <ContactsTable />}
      {activeTab === 'pipeline' && <PipelineBoard />}
      {activeTab === 'prospects' && <ProspectList />}
      {activeTab === 'activity' && <InteractionLog />}
    </div>
  )
}
