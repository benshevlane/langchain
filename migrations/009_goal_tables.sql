-- 009_goal_tables.sql
-- Shared goal state for campaign tracking across agents.
-- Goals are seeded from strategy.py on first boot, then editable via
-- Telegram or Supabase dashboard. Snapshots track progress over time.

-- ---------------------------------------------------------------------------
-- campaign_goals — the canonical goals Ralf works towards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_goals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id     TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    metric      TEXT NOT NULL,
    current_value NUMERIC DEFAULT 0,
    target_3m   TEXT,
    target_6m   TEXT,
    target_12m  TEXT,
    last_measured_at TIMESTAMPTZ,
    notes       TEXT DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- goal_snapshots — daily progress snapshots for trend tracking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS goal_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id       TEXT NOT NULL,
    value         NUMERIC NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_snapshots_goal_date
    ON goal_snapshots (goal_id, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- RLS policies (match existing pattern from 007_crm_rls_policies.sql)
-- ---------------------------------------------------------------------------

ALTER TABLE campaign_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (agent runs as service role)
CREATE POLICY "service_role_goals" ON campaign_goals
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_snapshots" ON goal_snapshots
    FOR ALL USING (auth.role() = 'service_role');
