-- Engagement report (engagement spec, Phase 0). READ-ONLY.
--   npm run report:engagement           (uses $DATABASE_URL)
-- On prod, run on the Hetzner box against its LOCAL Postgres (see
-- EverdiceDeploy.txt); the Neon URL in a dev .env is a stale copy.
--
-- Turns are counted from campaign_turn_log (one append-only row per turn).
-- campaign_sessions is NOT a turn count: each turn updates the chapter's
-- session row in place. Campaigns that predate the turn log show 0 turns
-- there, so "chapter" (current_session) is reported alongside.

\pset pager off
\echo '== A. Turns per campaign, most recent activity first'
SELECT c.id, left(c.title, 40) AS title, c.campaign_length, c.is_completed,
       c.current_session AS chapter, c.total_chapters,
       COUNT(t.id) AS turns, MIN(t.created_at) AS first_turn, MAX(t.created_at) AS last_turn
FROM campaigns c LEFT JOIN campaign_turn_log t ON t.campaign_id = c.id
GROUP BY c.id ORDER BY last_turn DESC NULLS LAST LIMIT 200;

\echo '== B. Drop-off histogram: how many campaigns stop after N turns (5-turn buckets)'
WITH n AS (
  SELECT c.id, c.is_completed, COUNT(t.id) AS turns
  FROM campaigns c JOIN campaign_turn_log t ON t.campaign_id = c.id
  GROUP BY c.id
)
SELECT width_bucket(turns, 0, 80, 16) AS bucket, MIN(turns) AS min_turns, MAX(turns) AS max_turns,
       COUNT(*) AS campaigns, COUNT(*) FILTER (WHERE is_completed) AS completed
FROM n GROUP BY 1 ORDER BY 1;

\echo '== B2. Chapter reached by unfinished campaigns'
SELECT current_session AS chapter, total_chapters, COUNT(*)
FROM campaigns WHERE NOT COALESCE(is_completed, false)
GROUP BY 1, 2 ORDER BY 2, 1;

\echo '== C. Scene-type mix across all turns'
SELECT COALESCE(scene_type, '(none)') AS scene_type, COUNT(*) FROM campaign_turn_log GROUP BY 1 ORDER BY 2 DESC;

\echo '== C2. Scene type of the LAST turn in unfinished campaigns idle 7+ days'
SELECT COALESCE(t.scene_type, '(none)') AS last_scene_type, COUNT(*)
FROM campaign_turn_log t
JOIN (SELECT campaign_id, MAX(id) AS mid FROM campaign_turn_log GROUP BY 1) last ON last.mid = t.id
JOIN campaigns c ON c.id = t.campaign_id
WHERE NOT COALESCE(c.is_completed, false)
  AND t.created_at::timestamptz < now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

\echo '== C3. Did the last turn involve a roll? (abandoned campaigns)'
SELECT (t.roll_result IS NOT NULL) AS last_turn_rolled, COUNT(*)
FROM campaign_turn_log t
JOIN (SELECT campaign_id, MAX(id) AS mid FROM campaign_turn_log GROUP BY 1) last ON last.mid = t.id
JOIN campaigns c ON c.id = t.campaign_id
WHERE NOT COALESCE(c.is_completed, false)
  AND t.created_at::timestamptz < now() - interval '7 days'
GROUP BY 1;

\echo '== D. Level distribution of characters that have played at least one turn'
SELECT ch.level, COUNT(DISTINCT ch.id)
FROM characters ch JOIN campaign_turn_log t ON t.character_id = ch.id
GROUP BY 1 ORDER BY 1;

\echo '== E. Feedback (latest 200)'
SELECT rating, category, felt_confusing, felt_slow, would_use, left(comment, 120) AS comment, page_path, created_at
FROM user_feedback ORDER BY created_at DESC LIMIT 200;

\echo '== F. Return rate: users active on 2+ distinct days (browser events only)'
SELECT COUNT(*) FILTER (WHERE d >= 2) AS returned, COUNT(*) AS total FROM
 (SELECT user_id, COUNT(DISTINCT left(created_at, 10)) AS d FROM user_activity_events
  WHERE user_id IS NOT NULL AND session_id <> 'server' GROUP BY 1) x;

\echo '== G. Turn latency from turn_submitted events (last 30 days)'
SELECT COUNT(*) AS turns,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (event_data->>'latencyMs')::numeric) AS median_ms,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY (event_data->>'latencyMs')::numeric) AS p90_ms,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (event_data->>'promptChars')::numeric) AS median_prompt_chars,
       AVG(CASE WHEN (event_data->>'rolled')::boolean THEN 1 ELSE 0 END) AS roll_rate
FROM user_activity_events
WHERE event_name = 'turn_submitted' AND created_at::timestamptz > now() - interval '30 days';

\echo '== H. Campaigns flagged abandoned (no turn for 7 days), by last scene type'
SELECT event_data->>'lastSceneType' AS last_scene_type, COUNT(*),
       ROUND(AVG((event_data->>'turns')::numeric), 1) AS avg_turns
FROM user_activity_events WHERE event_name = 'campaign_abandoned_candidate'
GROUP BY 1 ORDER BY 2 DESC;

\echo '== I. Level-ups completed'
SELECT event_data->>'from' AS from_level, event_data->>'to' AS to_level, COUNT(*)
FROM user_activity_events WHERE event_name = 'level_up_completed'
GROUP BY 1, 2 ORDER BY 1, 2;
