-- Migration 008: Add columns for backlink hunt workflow enhancements
--
-- Adds: contact_source, dead_page_topic, wayback_url, mentions_competitors,
-- already_lists_us to seo_backlink_prospects.

-- Contact discovery source tracking
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS contact_source TEXT DEFAULT '';

-- Wayback Machine context for broken link prospects
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS dead_page_topic TEXT DEFAULT '';
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS wayback_url TEXT DEFAULT '';

-- Roundup/listicle discovery fields
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS mentions_competitors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS already_lists_us BOOLEAN DEFAULT FALSE;

-- Dead URL and anchor text for broken link prospects (may already exist
-- from insert but not as formal columns)
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS dead_url TEXT DEFAULT '';
ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS anchor TEXT DEFAULT '';
