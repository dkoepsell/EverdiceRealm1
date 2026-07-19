-- Fix frozen created_at/started_at/joined_at/... defaults.
--
-- Bug: the schema used `.default(new Date().toISOString())`, a JS value evaluated
-- ONCE at migration time, so every column's DEFAULT was baked in as a single static
-- ISO literal (e.g. '2026-04-07T21:47:03.772Z'). Every row inserted without an explicit
-- value got that same frozen timestamp, making created_at useless for cohort/retention analysis.
--
-- Fix: replace each static-literal default with a live now()-based expression that produces
-- the identical ISO-8601 UTC format the app writes (e.g. 2026-07-18T14:21:10.503Z).
--
-- Safe & non-destructive: SET DEFAULT only affects FUTURE inserts; existing rows are untouched.
-- Idempotent: re-running is a no-op (already-fixed columns no longer match the pattern).
-- Matches the source-of-truth change in shared/schema.ts.

DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'text'
      AND column_default ~ '^''20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9:.]+Z''::text$'
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT to_char(now() AT TIME ZONE ''utc'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')',
      r.table_name, r.column_name
    );
    n := n + 1;
    RAISE NOTICE 'fixed default: %.%', r.table_name, r.column_name;
  END LOOP;
  RAISE NOTICE 'Total columns fixed: %', n;
END $$;
