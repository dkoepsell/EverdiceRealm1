-- Migration: Add session context fields to campaigns table
-- These fields support the DM Workspace "Session Context Strip" feature
-- Added: January 2026

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS session_name text,
ADD COLUMN IF NOT EXISTS session_focus text,
ADD COLUMN IF NOT EXISTS active_pressures text[],
ADD COLUMN IF NOT EXISTS unresolved_thread text;

-- Index for quick lookup when loading DM workspace
CREATE INDEX IF NOT EXISTS idx_campaigns_session_context 
ON campaigns(id) WHERE session_name IS NOT NULL OR session_focus IS NOT NULL;
