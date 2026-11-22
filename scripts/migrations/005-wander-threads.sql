-- Wander threads (wander-threads-spec.md, Features A and D): chains of clues that
-- lead to a payoff, plus Tavern road rumors (a rumor is a thread with status
-- 'rumored'). Additive and idempotent. Run by hand:
--   psql "$DATABASE_URL" -f scripts/migrations/005-wander-threads.sql
-- Never use `npm run db:push` against production (it drops the session table).
-- Until this runs, Wander works as before: thread and rumor reads fail soft.
CREATE TABLE IF NOT EXISTS wander_threads (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL,
  user_id integer NOT NULL,
  template_id text NOT NULL,
  beat integer NOT NULL DEFAULT 0,
  target_hex_q integer NOT NULL,
  target_hex_r integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payload jsonb,
  created_at text NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  updated_at text
);
CREATE INDEX IF NOT EXISTS idx_wander_threads_campaign_user ON wander_threads (campaign_id, user_id);
