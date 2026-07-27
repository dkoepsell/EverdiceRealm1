-- Backfill seats for campaigns that were created with zero participants.
--
-- Why these exist: POST /api/campaigns only seated the creator when
-- req.body.characterId was present, and no client ever sent it. Campaigns made
-- anywhere except /begin therefore ended up with no participant row -- and a
-- campaign with no participant is unenterable, because CampaignPanel denied its
-- own owner both the Join button and the NoCharacterPrompt fallback. 23 of the
-- 30 zero-turn campaigns created since 2026-07-19 are in this state.
--
-- The code fix (commit 5ab6a8c) stops new ones appearing. This repairs the
-- existing ones so those users have something to come back to.
--
-- Run this AFTER 5ab6a8c is deployed, so the fix and the backfill cannot race.
--
--   ssh root@204.168.167.44
--   cd /root/EverdiceRealm1 && set -a && . .env && set +a
--   psql "$DATABASE_URL" -f scripts/backfill-campaign-participants.sql
--
-- Additive INSERTs only. No schema change -- do NOT run this via drizzle-kit
-- push, which proposes dropping the session table.

BEGIN;

-- One campaign per user, not all of them.
--
-- characters.engagement_kind encodes "a character is in exactly one place at a
-- time", so seating a user's single character into all five of their orphaned
-- campaigns would violate that invariant. Each user gets their most recent
-- orphaned campaign seated with their newest character; the rest stay orphaned
-- and are reachable through the Join button that the code fix restores.
--
-- Users with no character at all (23 of the 37 orphaned campaigns) are skipped
-- -- there is nothing to seat. They now get the NoCharacterPrompt inside the
-- campaign instead, which lets them make one on the spot.
WITH target AS (
  SELECT DISTINCT ON (c.user_id)
    c.id            AS campaign_id,
    c.user_id       AS user_id,
    (SELECT max(ch.id) FROM characters ch WHERE ch.user_id = c.user_id) AS character_id
  FROM campaigns c
  WHERE NOT EXISTS (
          SELECT 1 FROM campaign_participants p WHERE p.campaign_id = c.id
        )
    AND EXISTS (
          SELECT 1 FROM characters ch WHERE ch.user_id = c.user_id
        )
  ORDER BY c.user_id, c.id DESC
)
INSERT INTO campaign_participants
  (campaign_id, user_id, character_id, role, turn_order, is_active, joined_at)
SELECT
  t.campaign_id,
  t.user_id,
  t.character_id,
  'player',
  1,
  true,
  now()::text
FROM target t
-- Belt and braces: never double-seat, so re-running is safe.
WHERE NOT EXISTS (
  SELECT 1 FROM campaign_participants p
  WHERE p.campaign_id = t.campaign_id AND p.user_id = t.user_id
);

-- Expected: INSERT 0 5 on first run (users 37, 45, 49, 62, 69), INSERT 0 0 after.
-- Review before committing:
--   SELECT campaign_id, user_id, character_id, role FROM campaign_participants
--   ORDER BY id DESC LIMIT 10;

COMMIT;
