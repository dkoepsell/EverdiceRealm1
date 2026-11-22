-- The shared realm (engagement 2): signs, cairns and finish-flags every player
-- sees on the Wander map. Additive and idempotent. Run by hand:
--   psql "$DATABASE_URL" -f scripts/migrations/006-realm-marks.sql
-- Until this runs, realm reads return nothing and writes are skipped.
CREATE TABLE IF NOT EXISTS realm_marks (
  id serial PRIMARY KEY,
  hex_q integer NOT NULL,
  hex_r integer NOT NULL,
  kind text NOT NULL,
  text text NOT NULL,
  character_name text NOT NULL,
  user_id integer NOT NULL,
  nodded_by jsonb DEFAULT '[]'::jsonb,
  created_at text NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);
CREATE INDEX IF NOT EXISTS idx_realm_marks_hex ON realm_marks (hex_q, hex_r);
