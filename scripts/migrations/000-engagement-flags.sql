-- Engagement spec, Phase F: per-campaign override of ENGAGEMENT_FLAGS
-- (shared/engagementFlags.ts). Additive and idempotent. Run by hand:
--   psql "$DATABASE_URL" -f scripts/migrations/000-engagement-flags.sql
-- Never use `npm run db:push` against production (it drops the session table).
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS engagement_flags jsonb;
