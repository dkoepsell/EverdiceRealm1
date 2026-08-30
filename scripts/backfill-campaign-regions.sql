-- Anchor unanchored campaigns to a region of the shared world.
--
-- Why: campaigns are created with world_region_id = NULL, so the narrator was never told
-- where it was and invented a fresh, private geography every session. Only 17 of 70
-- campaigns had a region. getWorldContext() falls back to the old free-text location for
-- anything still unanchored, so this backfill is safe to run late, partially, or twice.
--
-- Rule: pick among the regions whose level_range contains the campaign owner's highest
-- character level, spreading campaigns across them (campaign_id modulo) while ordering by
-- prior visitors so populated regions come first. Concentrating enough that players meet
-- each other's trails, spread enough that the world isn't one room.
--
-- Run:  sudo -u postgres psql everdice -f scripts/backfill-campaign-regions.sql
-- Undo: UPDATE campaigns SET world_region_id = NULL WHERE id IN (...);

BEGIN;

WITH party_level AS (
  SELECT c.id AS cid,
         GREATEST(COALESCE(MAX(ch.level), 1), 1) AS lvl
  FROM campaigns c
  LEFT JOIN characters ch ON ch.user_id = c.user_id
  WHERE c.world_region_id IS NULL
  GROUP BY c.id
),
region_pop AS (
  SELECT r.id,
         COALESCE(NULLIF(split_part(r.level_range, '-', 1), '')::int, 1)  AS lo,
         COALESCE(NULLIF(split_part(r.level_range, '-', 2), '')::int, 99) AS hi,
         (SELECT COUNT(DISTINCT p.user_id)
            FROM user_world_progress p
           WHERE p.region_id = r.id) AS visitors
  FROM world_regions r
),
banded AS (
  SELECT pl.cid,
         rp.id AS rid,
         ROW_NUMBER() OVER (PARTITION BY pl.cid ORDER BY rp.visitors DESC, rp.lo, rp.id) AS rn,
         COUNT(*)     OVER (PARTITION BY pl.cid) AS n
  FROM party_level pl
  JOIN region_pop rp ON pl.lvl BETWEEN rp.lo AND rp.hi
),
choice AS (
  SELECT cid, rid FROM banded WHERE rn = (cid % n) + 1
),
-- Anything whose level matched no region at all falls back to the lowest-level region.
fallback AS (
  SELECT pl.cid,
         (SELECT rp.id FROM region_pop rp ORDER BY rp.lo, rp.id LIMIT 1) AS rid
  FROM party_level pl
  WHERE pl.cid NOT IN (SELECT cid FROM choice)
),
final AS (
  SELECT * FROM choice
  UNION ALL
  SELECT * FROM fallback
)
UPDATE campaigns c
   SET world_region_id = f.rid
  FROM final f
 WHERE c.id = f.cid
   AND c.world_region_id IS NULL
   AND f.rid IS NOT NULL;

-- Report what changed before committing.
SELECT r.name AS region, COUNT(*) AS campaigns
  FROM campaigns c
  JOIN world_regions r ON r.id = c.world_region_id
 GROUP BY r.name
 ORDER BY 2 DESC;

COMMIT;
