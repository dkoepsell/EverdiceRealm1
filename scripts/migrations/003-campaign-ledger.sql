-- Engagement spec Phase 3: the Campaign Ledger (recurring cast, threads, deeds).
-- Additive and idempotent. Run by hand (see EverdiceDeploy.txt).
CREATE TABLE IF NOT EXISTS campaign_ledger (
  campaign_id integer PRIMARY KEY,
  turn integer NOT NULL DEFAULT 0,
  "cast" jsonb NOT NULL DEFAULT '[]'::jsonb,
  threads jsonb NOT NULL DEFAULT '[]'::jsonb,
  deeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  places jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_of_note jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at text
);
