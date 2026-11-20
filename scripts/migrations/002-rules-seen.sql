-- Engagement spec Phase 2: which 5e rules each player has seen fire in play.
-- Additive and idempotent. Run by hand (see EverdiceDeploy.txt).
CREATE TABLE IF NOT EXISTS user_rules_seen (
  user_id integer NOT NULL,
  rule_id text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  first_seen_at text NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  last_seen_at text,
  PRIMARY KEY (user_id, rule_id)
);
