-- 2026-07-25: character engagement lock.
-- Additive and idempotent. Safe to run more than once.
-- Run against the LOCAL Postgres on the prod box. Do NOT use `npm run db:push`.
--
-- Playtest feedback: "a character should be either in an adventure or out of
-- one, and if he's in an adventure, the tavern shouldn't be available" /
-- "you shouldn't be able to wander or tavern with the same character that's in
-- an adventure."
--
-- Until now `characters` had no engagement field at all (`status` is HP state:
-- conscious/unconscious/dead), and the only exclusion guards keyed on
-- (userId, campaignId) rather than characterId — so one character could be an
-- active campaign participant, mid-wander, mid-delve and shopping, all at once.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS engagement_kind  text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS engagement_id    integer,
  ADD COLUMN IF NOT EXISTS engagement_since text;

CREATE INDEX IF NOT EXISTS characters_engagement_idx
  ON characters (engagement_kind, engagement_id);

-- Backfill: any character with a wander or dungeon run still marked active is
-- genuinely in the field right now, so reflect that. Everything else stays idle
-- (campaign membership alone is NOT engagement — a party member who isn't
-- currently playing should still be able to visit town).
UPDATE characters c
   SET engagement_kind  = 'wander',
       engagement_id    = r.id,
       engagement_since = r.started_at
  FROM wander_runs r
 WHERE r.character_id = c.id
   AND r.status = 'active'
   AND c.engagement_kind = 'idle';

UPDATE characters c
   SET engagement_kind  = 'delve',
       engagement_id    = r.id,
       engagement_since = r.started_at
  FROM dungeon_runs r
 WHERE r.character_id = c.id
   AND r.status = 'active'
   AND c.engagement_kind = 'idle';
