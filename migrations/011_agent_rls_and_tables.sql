-- Migration 011: RLS policies for agent tables + create missing frontend tables
-- Fixes: frontend (anon key) cannot read agent_turns, cron_executions, etc.
-- because RLS is enabled but no SELECT policy exists for the anon role.
--
-- Run via: Supabase Dashboard -> SQL Editor

-- ===========================================================================
-- 1. RLS policies for EXISTING tables
-- ===========================================================================

-- agent_turns
ALTER TABLE agent_turns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_turns" ON agent_turns;
CREATE POLICY "anon_select_agent_turns"
    ON agent_turns FOR SELECT TO anon USING (true);

-- cron_executions
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_cron_executions" ON cron_executions;
CREATE POLICY "anon_select_cron_executions"
    ON cron_executions FOR SELECT TO anon USING (true);

-- llm_cost_log
ALTER TABLE llm_cost_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_llm_cost_log" ON llm_cost_log;
CREATE POLICY "anon_select_llm_cost_log"
    ON llm_cost_log FOR SELECT TO anon USING (true);

-- ralf_schedule_log
ALTER TABLE ralf_schedule_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ralf_schedule_log" ON ralf_schedule_log;
CREATE POLICY "anon_select_ralf_schedule_log"
    ON ralf_schedule_log FOR SELECT TO anon USING (true);

-- ralf_schedule (frontend reads + updates frequency)
ALTER TABLE ralf_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ralf_schedule" ON ralf_schedule;
DROP POLICY IF EXISTS "anon_update_ralf_schedule" ON ralf_schedule;
CREATE POLICY "anon_select_ralf_schedule"
    ON ralf_schedule FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_ralf_schedule"
    ON ralf_schedule FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- seo_our_rankings
ALTER TABLE seo_our_rankings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_seo_our_rankings" ON seo_our_rankings;
CREATE POLICY "anon_select_seo_our_rankings"
    ON seo_our_rankings FOR SELECT TO anon USING (true);

-- seo_backlink_prospects
ALTER TABLE seo_backlink_prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_seo_backlink_prospects" ON seo_backlink_prospects;
CREATE POLICY "anon_select_seo_backlink_prospects"
    ON seo_backlink_prospects FOR SELECT TO anon USING (true);

-- agent_memories (read-only from frontend)
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_memories" ON agent_memories;
CREATE POLICY "anon_select_agent_memories"
    ON agent_memories FOR SELECT TO anon USING (true);

-- ===========================================================================
-- 2. Defensive: explicit service_role full access (in case RLS bypass toggled off)
-- ===========================================================================

DROP POLICY IF EXISTS "service_role_all_agent_turns" ON agent_turns;
CREATE POLICY "service_role_all_agent_turns"
    ON agent_turns FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_cron_executions" ON cron_executions;
CREATE POLICY "service_role_all_cron_executions"
    ON cron_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_llm_cost_log" ON llm_cost_log;
CREATE POLICY "service_role_all_llm_cost_log"
    ON llm_cost_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_ralf_schedule_log" ON ralf_schedule_log;
CREATE POLICY "service_role_all_ralf_schedule_log"
    ON ralf_schedule_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_ralf_schedule" ON ralf_schedule;
CREATE POLICY "service_role_all_ralf_schedule"
    ON ralf_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 3. CREATE missing tables referenced by frontend
-- ===========================================================================

-- agent_files — documents/artifacts produced by agents
CREATE TABLE IF NOT EXISTS agent_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    file_type TEXT NOT NULL DEFAULT 'text',
    char_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_files_agent ON agent_files(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_files_created ON agent_files(created_at DESC);

ALTER TABLE agent_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_files" ON agent_files;
CREATE POLICY "anon_select_agent_files"
    ON agent_files FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "service_role_all_agent_files" ON agent_files;
CREATE POLICY "service_role_all_agent_files"
    ON agent_files FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_schedule_config — per-agent job schedule settings (frontend reads + writes)
CREATE TABLE IF NOT EXISTS agent_schedule_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    job_id TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',       -- hourly, daily, weekly, custom
    cron_expression TEXT,
    time_of_day TEXT,                              -- HH:MM format
    day_of_week INTEGER,                           -- 0=Sun .. 6=Sat
    active BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_schedule_config_agent ON agent_schedule_config(agent_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_schedule_config_unique ON agent_schedule_config(agent_name, job_id);

ALTER TABLE agent_schedule_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_schedule_config" ON agent_schedule_config;
DROP POLICY IF EXISTS "anon_insert_agent_schedule_config" ON agent_schedule_config;
DROP POLICY IF EXISTS "anon_update_agent_schedule_config" ON agent_schedule_config;
CREATE POLICY "anon_select_agent_schedule_config"
    ON agent_schedule_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_agent_schedule_config"
    ON agent_schedule_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_agent_schedule_config"
    ON agent_schedule_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_agent_schedule_config" ON agent_schedule_config;
CREATE POLICY "service_role_all_agent_schedule_config"
    ON agent_schedule_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_notification_config — per-agent notification preferences (frontend reads + writes)
CREATE TABLE IF NOT EXISTS agent_notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'telegram',       -- email, telegram, slack
    trigger TEXT NOT NULL DEFAULT 'on_failure',     -- on_success, on_failure, on_every_run, on_cost_threshold
    cost_threshold_usd NUMERIC,
    frequency_cap_minutes INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_notification_config_agent ON agent_notification_config(agent_name);

ALTER TABLE agent_notification_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_notification_config" ON agent_notification_config;
DROP POLICY IF EXISTS "anon_insert_agent_notification_config" ON agent_notification_config;
DROP POLICY IF EXISTS "anon_update_agent_notification_config" ON agent_notification_config;
CREATE POLICY "anon_select_agent_notification_config"
    ON agent_notification_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_agent_notification_config"
    ON agent_notification_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_agent_notification_config"
    ON agent_notification_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_agent_notification_config" ON agent_notification_config;
CREATE POLICY "service_role_all_agent_notification_config"
    ON agent_notification_config FOR ALL TO service_role USING (true) WITH CHECK (true);
