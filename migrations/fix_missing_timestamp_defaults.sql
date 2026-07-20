-- Fix NOT NULL text timestamp columns that have NO default.
--
-- The earlier fix_frozen_timestamp_defaults.sql migration only rewrote columns
-- whose DB default already matched the frozen-literal pattern. Columns that had
-- their schema-side `.default(new Date().toISOString())` stripped but never had
-- a DB default (or never carried the frozen literal) were skipped. They are
-- `NOT NULL` with no default, so any insert that does not hand-supply the column
-- fails with: null value in column "..." violates not-null constraint.
--
-- Confirmed impact: characters.created_at broke /api/characters/quick-build for
-- every new user since 2026-07-18 — nobody could create a character, so nobody
-- could play. campaign_participants.joined_at and campaign_sessions.created_at
-- are the same latent failure in the same first-run path.
--
-- Fix: give each creation-semantic column the SAME ISO-8601 default the earlier
-- migration standardized on. A default is only used when the app omits the
-- column, so tables that already pass a value (e.g. campaigns) are unaffected.
-- Expiry / date / presence columns are intentionally excluded — now() is the
-- wrong value there and those are always app-supplied.

DO $$
DECLARE
  cols text[] := ARRAY[
    'adventure_completions.completed_at',
    'campaign_participants.joined_at',
    'campaign_sessions.created_at',
    'campaigns.created_at',
    'character_inventory.acquired_at',
    'character_spells.acquired_at',
    'characters.created_at',
    'dice_rolls.created_at',
    'milestone_rewards.earned_at',
    'player_houses.purchased_at',
    'user_badges.earned_at',
    'user_sessions.created_at',
    'user_sessions_analytics.started_at',
    'user_session_tracking.last_login_at'
  ];
  entry text;
  tbl text;
  col text;
BEGIN
  FOREACH entry IN ARRAY cols LOOP
    tbl := split_part(entry, '.', 1);
    col := split_part(entry, '.', 2);
    -- Only touch it if the column still lacks a default (idempotent / safe to re-run).
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl
        AND column_name = col AND column_default IS NULL
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT to_char((now() AT TIME ZONE ''utc''), ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')',
        tbl, col
      );
      RAISE NOTICE 'Set default on %.%', tbl, col;
    END IF;
  END LOOP;
END $$;
