export interface AgentTurn {
  id: string
  session_id: string
  agent_name: string
  turn_type: string
  input: string | null
  output: string | null
  tokens_used: number
  model: string | null
  duration_ms: number | null
  created_at: string
}

export interface CronExecution {
  id: string
  job_id: string
  fired_at: string
  completed_at: string | null
  status: 'running' | 'completed' | 'failed'
  tasks_executed: number
  message_sent: boolean
  tokens_used: number
  error: string | null
  created_at: string
}

export interface LlmCostLog {
  id: string
  task_type: string
  model: string
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  cost_usd: number
  site: string | null
  created_at: string
}

export interface CrmContact {
  id: string
  company_name: string
  contact_name: string | null
  contact_role: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  region: string | null
  postcode: string | null
  country: string
  category: string
  subcategory: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  outreach_status: string
  outreach_segment: string | null
  score: number
  tier: string | null
  source: string | null
  tags: string[]
  notes: string | null
  created_at: string
  updated_at: string
  last_contacted_at: string | null
}

export interface CrmInteraction {
  id: string
  contact_id: string
  interaction_type: string
  direction: string
  channel: string
  subject: string | null
  body_preview: string | null
  status: string
  performed_by: string
  created_at: string
}

export interface BacklinkProspect {
  id: string
  domain: string
  page_url: string | null
  page_title: string | null
  page_summary: string | null
  author_name: string | null
  contact_email: string | null
  dr: number | null
  monthly_traffic: number | null
  prospect_type: string | null
  discovery_method: string | null
  outreach_angle: string | null
  personalisation_notes: string | null
  score: number
  tier: string | null
  status: string
  created_at: string
  last_contacted_at: string | null
  follow_up_count: number
  reply_received: boolean
  target_site: string | null
}

export interface OutreachEmail {
  id: string
  prospect_id: string
  subject: string | null
  body: string | null
  tier: number | null
  template_type: string | null
  sequence_step: number
  status: string
  sent_at: string | null
  opened: boolean
  replied: boolean
  created_at: string
}

export interface CronJob {
  id: string
  interval_hours?: number
  interval_minutes?: number
  first_delay_seconds: number
  description: string
}

export interface ScheduleEntry {
  id: string
  cadence: 'daily' | 'weekly' | 'monthly'
  day_of_week?: number
  day_of_month?: number
  skill: string
  boost_amount: number
  label: string
  description: string
  active: boolean
}

export interface RankingEntry {
  id: string
  target_site: string
  keyword: string
  position: number
  url: string
  previous_position: number | null
  change: number
  volume: number
  snapshot_date: string
  created_at: string
}

export interface ScheduleLogEntry {
  id: string
  skill: string
  site: string | null
  summary: string | null
  status: string
  heartbeat_id: string | null
  schedule_date: string
  completed_at: string | null
  created_at: string
}

export interface StrategyConfig {
  id: string
  key: string
  value: string
  category: string
  label: string | null
  description: string | null
  value_type: string
  updated_at: string
  created_at: string
}

export interface CampaignGoal {
  id: string
  goal_id: string
  description: string
  metric: string
  current_value: number
  target_3m: string | null
  target_6m: string | null
  target_12m: string | null
  last_measured_at: string | null
  notes: string
  updated_at: string
  created_at: string
}

export interface AgentFile {
  id: string
  agent_name: string
  file_name: string
  content: string
  file_type: string
  char_count: number
  word_count: number
  created_at: string
  updated_at: string
}

export interface AgentNotificationConfig {
  id: string
  agent_name: string
  channel: 'email' | 'telegram' | 'slack'
  trigger: 'on_success' | 'on_failure' | 'on_every_run' | 'on_cost_threshold'
  cost_threshold_usd: number | null
  frequency_cap_minutes: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface AgentScheduleConfig {
  id: string
  agent_name: string
  job_id: string
  frequency: 'hourly' | 'daily' | 'weekly' | 'custom'
  cron_expression: string | null
  time_of_day: string | null
  day_of_week: number | null
  active: boolean
  next_run_at: string | null
  created_at: string
  updated_at: string
}

export interface BacklinkTargetConfig {
  id: string
  target_site: string
  min_dr: number
  enabled_methods: string[]
  excluded_domains: string[]
  max_prospects_per_method: number
  active: boolean
  notes: string
  created_at: string
  updated_at: string
}

export interface SiteAgentConfig {
  id: string
  site: string
  agent_id: string
  enabled: boolean
  config: Record<string, unknown>
  last_run_at: string | null
  updated_at: string
}
