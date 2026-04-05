-- Migration 009: Add missing segment column to seo_backlink_prospects
--
-- The backlink_prospector node sets segment = "blogger" or "provider" when
-- saving prospects, but the column was never created.  This causes all
-- INSERT calls to fail with "column does not exist".

ALTER TABLE seo_backlink_prospects
    ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT '';
