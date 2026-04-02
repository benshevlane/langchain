-- Multi-site context: scope agent_runs, content, tracked_keywords by site
-- and add per-site agent configuration table.

-- Extend agent_runs to scope by site
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS site TEXT;
CREATE INDEX IF NOT EXISTS agent_runs_site_idx ON agent_runs(site, started_at DESC);

-- Extend content to support the third site
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_site_check;
ALTER TABLE content ADD CONSTRAINT content_site_check
  CHECK (site IN ('kitchens', 'rooms', 'costs'));

-- Extend tracked_keywords similarly
ALTER TABLE tracked_keywords DROP CONSTRAINT IF EXISTS tracked_keywords_site_check;
ALTER TABLE tracked_keywords ADD CONSTRAINT tracked_keywords_site_check
  CHECK (site IN ('kitchens', 'rooms', 'costs'));

-- New table: per-site agent strategy config
CREATE TABLE IF NOT EXISTS site_agent_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site        TEXT NOT NULL CHECK (site IN ('kitchens', 'rooms', 'costs')),
  agent_id    TEXT NOT NULL,
  enabled     BOOLEAN DEFAULT true,
  config      JSONB DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site, agent_id)
);

-- Seed default configs for all three sites
INSERT INTO site_agent_config (site, agent_id, enabled) VALUES
  ('kitchens', 'seo', true),
  ('kitchens', 'content', true),
  ('kitchens', 'backlink', true),
  ('kitchens', 'outreach', true),
  ('rooms', 'seo', true),
  ('rooms', 'content', true),
  ('rooms', 'backlink', true),
  ('rooms', 'outreach', false),
  ('costs', 'seo', true),
  ('costs', 'content', true),
  ('costs', 'backlink', true),
  ('costs', 'outreach', false)
ON CONFLICT (site, agent_id) DO NOTHING;
