-- 010_strategy_config.sql
-- Runtime-editable strategy configuration table.
-- Key-value pairs that agents read at runtime and the frontend can edit.
-- Also adds anon RLS policies so the frontend can read/write strategy_config
-- and read/update campaign_goals.
--
-- Run via: Supabase Dashboard -> SQL Editor

-- ---------------------------------------------------------------------------
-- strategy_config — runtime-editable agent parameters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS strategy_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL UNIQUE,
    value       TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',
    label       TEXT,
    description TEXT,
    value_type  TEXT NOT NULL DEFAULT 'text',
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS for strategy_config
-- ---------------------------------------------------------------------------

ALTER TABLE strategy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_strategy_config" ON strategy_config;
DROP POLICY IF EXISTS "anon_update_strategy_config" ON strategy_config;
DROP POLICY IF EXISTS "anon_insert_strategy_config" ON strategy_config;
DROP POLICY IF EXISTS "service_role_all_strategy_config" ON strategy_config;

CREATE POLICY "anon_select_strategy_config"
    ON strategy_config FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_strategy_config"
    ON strategy_config FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert_strategy_config"
    ON strategy_config FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "service_role_all_strategy_config"
    ON strategy_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- RLS for campaign_goals (add anon read + update to existing service_role policy)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "anon_select_campaign_goals" ON campaign_goals;
DROP POLICY IF EXISTS "anon_update_campaign_goals" ON campaign_goals;

CREATE POLICY "anon_select_campaign_goals"
    ON campaign_goals FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_campaign_goals"
    ON campaign_goals FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Enable realtime for frontend subscriptions
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE strategy_config;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_goals;

-- ---------------------------------------------------------------------------
-- Seed default config values
-- ---------------------------------------------------------------------------

INSERT INTO strategy_config (key, value, category, label, description, value_type) VALUES
    ('dr_min_threshold', '10', 'prospecting', 'Min DR Threshold', 'Minimum Ahrefs Domain Rating for prospect scoring', 'number'),
    ('dr_max_threshold', '75', 'prospecting', 'Max DR Threshold', 'Maximum DR — prospects above this are likely unreachable', 'number'),
    ('content_target', '30', 'content', 'Content Target', 'Total blog posts target across all sites', 'number'),
    ('content_diversity_cooldown_days', '7', 'content', 'Topic Cooldown (days)', 'Days before revisiting a topic cluster', 'number'),
    ('contact_cooldown_days', '90', 'outreach', 'Contact Cooldown (days)', 'Days before re-contacting a domain', 'number'),
    ('max_email_word_count', '150', 'outreach', 'Max Email Words', 'Maximum word count for outreach emails', 'number'),
    ('blocked_keywords', '', 'content', 'Blocked Keywords', 'Comma-separated keywords to never target', 'textarea'),
    ('blocked_domains', '', 'outreach', 'Blocked Domains', 'Comma-separated domains to never contact', 'textarea'),
    ('outreach_monthly_targets', '{"kitchen_bathroom_providers":20,"home_interior_bloggers":15,"home_improvement_influencers":5,"resource_page_targets":10,"pr_journalists":5,"interior_designers":15}', 'outreach', 'Monthly Outreach Targets', 'Per-segment monthly outreach targets (JSON)', 'json'),
    ('budget_tiers', '{"normal":{"threshold":0.8,"behavior":"full speed"},"cautious":{"threshold":0.2,"behavior":"switch to cheaper models"},"paused":{"threshold":0.05,"behavior":"pause non-essential tasks"}}', 'general', 'Budget Tiers', 'Budget threshold behavior rules (JSON)', 'json'),
    ('site_priorities', '{"freeroomplanner":"active","kitchensdirectory":"upcoming","ralf_seo":"active"}', 'general', 'Site Priorities', 'Site status and priority (JSON)', 'json')
ON CONFLICT (key) DO NOTHING;
