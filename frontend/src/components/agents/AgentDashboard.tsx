import { useEffect, useMemo, useState } from 'react'
import {
  Activity as ActivityIcon,
  DollarSign,
  FileText,
  CalendarClock,
  Bell,
  LayoutDashboard,
} from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import type { AgentTurn, CronExecution } from '../../types/database'
import { AgentCard } from './AgentCard'
import { AgentTurnLog } from './AgentTurnLog'
import { ActivityTimeline } from './ActivityTimeline'
import { CostChart } from './CostChart'
import { CostSummary } from './CostSummary'
import { AgentFiles } from './AgentFiles'
import { AgentSchedule } from './AgentSchedule'
import { AgentNotifications } from './AgentNotifications'
import { Tabs } from '../ui/Tabs'
import { SkeletonCard } from '../ui/Skeleton'
import { useShellContext } from '../layout/Shell'

export const AGENTS = [
  { name: 'ralf', description: 'SEO agent — content, outreach, rankings, reporting' },
  { name: 'scraper', description: 'Web scraper — data collection and enrichment' },
]

export const AGENT_JOB_IDS: Record<string, string[]> = {
  ralf: ['worker', 'pulse'],
  scraper: ['scraper_batch'],
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
  { key: 'activity', label: 'Activity', icon: <ActivityIcon size={14} /> },
  { key: 'cost', label: 'Cost', icon: <DollarSign size={14} /> },
  { key: 'files', label: 'Files', icon: <FileText size={14} /> },
  { key: 'schedule', label: 'Schedule', icon: <CalendarClock size={14} /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
]

export function AgentDashboard() {
  const { registerRefetch } = useShellContext()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].name)
  const [activeTab, setActiveTab] = useState('overview')

  const { data: turns, loading: loadingTurns, refetch: refetchTurns } = useSupabase<AgentTurn>({
    table: 'agent_turns',
    order: { column: 'created_at', ascending: false },
    limit: 200,
    realtime: true,
  })

  const { data: executions, loading: loadingExecs, refetch: refetchExecs } = useSupabase<CronExecution>({
    table: 'cron_executions',
    order: { column: 'fired_at', ascending: false },
    limit: 10,
    realtime: true,
  })

  useEffect(() => {
    const cleanup1 = registerRefetch(refetchTurns)
    const cleanup2 = registerRefetch(refetchExecs)
    return () => { cleanup1(); cleanup2() }
  }, [registerRefetch, refetchTurns, refetchExecs])

  const agentStats = useMemo(() => {
    const stats: Record<string, { lastActive: string | null; turnsToday: number; tokensToday: number; hasRunning: boolean; hasError: boolean }> = {}

    for (const agent of AGENTS) {
      const agentTurns = turns.filter((t) => t.agent_name === agent.name)
      const todayTurns = agentTurns.filter((t) => t.created_at.startsWith(todayStr))
      const jobIds = AGENT_JOB_IDS[agent.name] ?? []
      const agentExecs = executions.filter((e) => jobIds.includes(e.job_id))

      stats[agent.name] = {
        lastActive: agentTurns[0]?.created_at ?? null,
        turnsToday: todayTurns.length,
        tokensToday: todayTurns.reduce((sum, t) => sum + t.tokens_used, 0),
        hasRunning: agentExecs.some((e) => e.status === 'running'),
        hasError: agentExecs.some((e) => e.status === 'failed'),
      }
    }
    return stats
  }, [turns, executions, todayStr])

  const getStatus = (name: string): 'idle' | 'running' | 'error' => {
    const s = agentStats[name]
    if (!s) return 'idle'
    if (s.hasRunning) return 'running'
    if (s.hasError) return 'error'
    return 'idle'
  }

  const loading = loadingTurns || loadingExecs

  return (
    <div className="space-y-6">
      {/* Agent selector cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.name}
              name={agent.name}
              description={agent.description}
              status={getStatus(agent.name)}
              lastActive={agentStats[agent.name]?.lastActive ?? null}
              turnsToday={agentStats[agent.name]?.turnsToday ?? 0}
              tokensToday={agentStats[agent.name]?.tokensToday ?? 0}
              selected={selectedAgent === agent.name}
              onClick={() => setSelectedAgent(agent.name)}
            />
          ))}
        </div>
      )}

      {/* Tab bar */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ActivityTimeline agentName={selectedAgent} />
            <CostChart agentName={selectedAgent} />
            <AgentTurnLog agentName={selectedAgent} />
          </div>
        )}
        {activeTab === 'activity' && (
          <ActivityTimeline agentName={selectedAgent} />
        )}
        {activeTab === 'cost' && (
          <div className="space-y-6">
            <CostSummary agentName={selectedAgent} />
            <CostChart agentName={selectedAgent} />
          </div>
        )}
        {activeTab === 'files' && (
          <AgentFiles agentName={selectedAgent} />
        )}
        {activeTab === 'schedule' && (
          <AgentSchedule agentName={selectedAgent} />
        )}
        {activeTab === 'notifications' && (
          <AgentNotifications agentName={selectedAgent} />
        )}
      </div>
    </div>
  )
}
