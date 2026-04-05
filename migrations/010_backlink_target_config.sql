-- Backlink target configuration: per-site discovery parameters
-- controlled from the admin frontend.

CREATE TABLE IF NOT EXISTS backlink_target_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_site TEXT NOT NULL,
    min_dr INTEGER NOT NULL DEFAULT 20,
    enabled_methods JSONB NOT NULL DEFAULT '["competitor_backlink","content_explorer","unlinked_mention","resource_page","broken_link","haro","niche_blog_search","company_search","roundup_search"]',
    excluded_domains JSONB NOT NULL DEFAULT '[]',
    max_prospects_per_method INTEGER NOT NULL DEFAULT 50,
    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(target_site)
);

-- Enable RLS
ALTER TABLE backlink_target_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin dashboard)
CREATE POLICY "authenticated_full_access" ON backlink_target_config
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow anon read access for the backend worker
CREATE POLICY "anon_read_access" ON backlink_target_config
    FOR SELECT
    TO anon
    USING (true);

-- Add unique constraint on seo_backlink_prospects to support upsert on
-- re-discovery (avoids duplicate rows and preserves existing status/score).
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlink_prospects_url_site
    ON seo_backlink_prospects (page_url, target_site);
