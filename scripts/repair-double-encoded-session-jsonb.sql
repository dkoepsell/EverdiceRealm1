-- Repair sessions whose jsonb columns hold a JSON *string* instead of a value.
--
-- Cause: four initial-session creation paths in server/routes.ts called JSON.stringify()
-- before inserting into the `choices` and `story_state` jsonb columns. Drizzle passed the
-- string straight through, so Postgres stored a jsonb string.
--
-- Impact: CampaignPanel gates the choice buttons on Array.isArray(choices). A string is
-- not an array, so the player saw an opening scene with NOTHING TO CLICK and the campaign
-- ended on turn one. 46 of 73 sessions were in this state. (story_state was already
-- defensively parsed on both server and client, so it was cosmetic — repaired here anyway
-- so the column stops lying about its own shape.)
--
-- The write side is fixed in routes.ts and the client now parses defensively, so this is a
-- one-shot backfill for existing rows.
--
-- Run:  sudo -u postgres psql everdice -f scripts/repair-double-encoded-session-jsonb.sql

BEGIN;

-- Before
SELECT 'before' AS stage,
       jsonb_typeof(choices)     AS choices_type,
       jsonb_typeof(story_state) AS story_state_type,
       COUNT(*)
  FROM campaign_sessions
 GROUP BY 1, 2, 3
 ORDER BY 2, 3;

-- Only touch rows that are actually double-encoded, and only when the inner text really
-- parses to the shape we expect. Anything malformed is left alone rather than destroyed.
UPDATE campaign_sessions
   SET choices = (choices #>> '{}')::jsonb
 WHERE jsonb_typeof(choices) = 'string'
   AND jsonb_typeof((choices #>> '{}')::jsonb) = 'array';

UPDATE campaign_sessions
   SET story_state = (story_state #>> '{}')::jsonb
 WHERE jsonb_typeof(story_state) = 'string'
   AND jsonb_typeof((story_state #>> '{}')::jsonb) = 'object';

-- After
SELECT 'after' AS stage,
       jsonb_typeof(choices)     AS choices_type,
       jsonb_typeof(story_state) AS story_state_type,
       COUNT(*)
  FROM campaign_sessions
 GROUP BY 1, 2, 3
 ORDER BY 2, 3;

COMMIT;
