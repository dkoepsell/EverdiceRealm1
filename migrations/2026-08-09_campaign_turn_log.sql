-- Party turn log: a permanent, attributed record of who chose what.
--
-- Asynchronous tables need to know that another player moved while they were
-- gone, in that player's own words. campaign_sessions.action_log cannot answer
-- that: it records no actor and keeps only the last 200 entries. This table is
-- append-only and never trimmed.
--
-- Additive and idempotent. Run by hand; do NOT db:push (that drops the session
-- table).

CREATE TABLE IF NOT EXISTS campaign_turn_log (
  id               SERIAL PRIMARY KEY,
  campaign_id      INTEGER NOT NULL,
  session_id       INTEGER,
  user_id          INTEGER,
  character_id     INTEGER,
  actor_name       TEXT NOT NULL,
  character_name   TEXT,
  choice           TEXT,
  narrative        TEXT,
  roll_result      JSONB,
  scene_type       TEXT,
  chapter_number   INTEGER,
  created_at       TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_campaign_turn_log_campaign_id
  ON campaign_turn_log (campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_turn_log_campaign_seq
  ON campaign_turn_log (campaign_id, id);

-- How far each player has read the chronicle. 0 means "has read nothing", which
-- the API treats as a first run and seeds from recent history rather than
-- dumping the campaign's entire past into the notice.
ALTER TABLE user_session_tracking
  ADD COLUMN IF NOT EXISTS last_seen_turn_log_id INTEGER DEFAULT 0;
