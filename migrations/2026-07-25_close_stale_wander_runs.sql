-- 2026-07-25: close abandoned wander runs left open before the engagement lock.
-- Idempotent. Run once, after 2026-07-25_character_engagement.sql.
--
-- Two wander_runs rows (April and June 2026) were still status='active' at
-- tick 0 — i.e. started and never stepped, then abandoned. The engagement
-- backfill dutifully marked their characters as "out wandering the wilds",
-- which would have locked those players out of the tavern, trading post and
-- downtime for a run they left months ago.
--
-- Only touches runs that never moved (tick = 0) and predate this release, so
-- a genuinely in-progress run is never closed.

UPDATE wander_runs
   SET status = 'abandoned',
       ended_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 WHERE status = 'active'
   AND tick = 0
   AND started_at < '2026-07-01';

-- Release any character pointed at a run that is no longer active.
-- (The app self-heals this too, but doing it here keeps the data honest.)
UPDATE characters
   SET engagement_kind = 'idle',
       engagement_id = NULL,
       engagement_since = NULL
 WHERE engagement_kind = 'wander'
   AND engagement_id IN (SELECT id FROM wander_runs WHERE status <> 'active');
