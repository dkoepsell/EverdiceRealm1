-- Repair: undo the unintended second run of
-- scripts/backfill-campaign-participants.sql.
--
-- What went wrong: that script was not idempotent. Its target CTE selected each
-- user's most recent *orphaned* campaign, and its only guard was "this user is
-- not already seated in THIS campaign". After the first run those campaigns
-- were no longer orphaned, so a second run selected each user's NEXT orphaned
-- campaign and seated the same character again.
--
--   ids 23-27 (campaigns 56, 15, 18, 41, 52) -- intended first run, KEEP
--   ids 28-31 (campaigns  9, 14, 40, 51)     -- accidental second run, REMOVE
--
-- Deliberately keyed on those exact ids rather than on a "one seat per
-- character" sweep. Such a sweep looked correct but would have destroyed real
-- data: characters 1 and 2 have each held two seats (ids 1/4 and 3/7) since
-- long before this backfill, so the one-character-one-campaign rule is not
-- something the existing table actually satisfies, and enforcing it here would
-- delete legitimate rows.
--
--   ssh root@204.168.167.44
--   cd /root/EverdiceRealm1 && set -a && . .env && set +a
--   psql "$DATABASE_URL" -f scripts/repair-duplicate-participant-seats.sql

BEGIN;

DELETE FROM campaign_participants
WHERE id IN (28, 29, 30, 31)
  -- Only if they still look like what we measured, so a stale re-run is inert.
  AND (campaign_id, user_id) IN ((9, 37), (14, 45), (40, 62), (51, 69));

COMMIT;

-- Expected: DELETE 4 on first run, DELETE 0 after.
-- Verify the table is back to 27 rows:
--   SELECT count(*) FROM campaign_participants;
