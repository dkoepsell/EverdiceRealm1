-- 2026-07-25: backfill campaigns.updated_at ("last played").
-- Additive and idempotent. Safe to run more than once.
-- Run against the LOCAL Postgres on the prod box. Do NOT use `npm run db:push`.
--
-- campaigns.updated_at existed in the schema but nothing ever wrote to it, so it
-- was NULL for every campaign ever created. The dashboard resumes the campaign
-- you played most recently; with no timestamp to sort by it fell through to
-- created_at, so a campaign created once and never played outranked the story
-- actually in progress. The player then saw a campaign they had never joined,
-- and — because the dashboard substituted their first character when they had
-- no seat in it — their adventure looked like it had swapped their character.
--
-- Going forward advance-story stamps this on every turn. This backfills history
-- from the session rows, which DO carry an accurate updated_at.

UPDATE campaigns c
   SET updated_at = s.updated_at
  FROM (
        SELECT campaign_id, MAX(updated_at) AS updated_at
          FROM campaign_sessions
         WHERE updated_at IS NOT NULL
         GROUP BY campaign_id
       ) s
 WHERE s.campaign_id = c.id
   AND c.updated_at IS NULL;

-- Campaigns with no session activity at all fall back to their creation time,
-- so the sort key is never NULL and ordering is total.
UPDATE campaigns
   SET updated_at = created_at
 WHERE updated_at IS NULL
   AND created_at IS NOT NULL;
