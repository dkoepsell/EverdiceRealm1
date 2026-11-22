-- The DM path and "open to live play" (dm-path.md). Additive and idempotent.
--   psql "$DATABASE_URL" -f scripts/migrations/007-dm-path.sql
-- Until this runs, the DM path page loads but saves nothing.
CREATE TABLE IF NOT EXISTS dm_path_progress (
  user_id integer NOT NULL,
  step_id text NOT NULL,
  data jsonb,
  completed_at text,
  updated_at text,
  PRIMARY KEY (user_id, step_id)
);
CREATE TABLE IF NOT EXISTS play_preferences (
  user_id integer PRIMARY KEY,
  open boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'player',
  timezone text,
  slots jsonb DEFAULT '[]'::jsonb,
  styles jsonb DEFAULT '[]'::jsonb,
  updated_at text
);
