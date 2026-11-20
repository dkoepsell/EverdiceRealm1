-- Engagement spec Phase 6: content each player has already seen (Wander outcomes,
-- rooms, puzzles), so repeats wait until the pool runs dry. Additive, idempotent.
CREATE TABLE IF NOT EXISTS user_seen_content (
  user_id integer NOT NULL,
  kind text NOT NULL,
  content_id text NOT NULL,
  seen_at text NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  PRIMARY KEY (user_id, kind, content_id)
);
