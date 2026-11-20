/**
 * Nightly engagement bookkeeping (engagement spec, Phase 0).
 *
 * Writes one `campaign_abandoned_candidate` event per unfinished campaign whose
 * last turn is 7+ days old, recording what the player was looking at when they
 * stopped. Idempotent: a campaign is flagged once per last turn, so a player
 * who comes back and stalls again is flagged again, but a campaign idling for
 * months is not re-flagged every night.
 *
 * Same scheduling pattern as the re-engagement job: an hourly tick that runs
 * once per day at a fixed server hour.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { logServerEvent } from "./activityLog";

const IDLE_DAYS = 7;
const BATCH_LIMIT = 500;

interface CandidateRow {
  campaign_id: number;
  user_id: number;
  last_turn_id: number;
  last_scene_type: string | null;
  turns: number;
  chapter: number;
  total_chapters: number;
}

export async function flagAbandonedCampaigns(): Promise<number> {
  const result = await db.execute(sql`
    WITH last AS (
      SELECT campaign_id, MAX(id) AS last_turn_id, COUNT(*)::int AS turns
      FROM campaign_turn_log GROUP BY campaign_id
    )
    SELECT c.id AS campaign_id, c.user_id, last.last_turn_id, t.scene_type AS last_scene_type,
           last.turns, c.current_session AS chapter, c.total_chapters
    FROM campaigns c
    JOIN last ON last.campaign_id = c.id
    JOIN campaign_turn_log t ON t.id = last.last_turn_id
    WHERE NOT COALESCE(c.is_completed, false)
      AND NOT COALESCE(c.is_archived, false)
      AND t.created_at::timestamptz < now() - make_interval(days => ${IDLE_DAYS})
      AND NOT EXISTS (
        SELECT 1 FROM user_activity_events e
        WHERE e.event_name = 'campaign_abandoned_candidate'
          AND e.campaign_id = c.id
          AND (e.event_data->>'lastTurnId')::int = last.last_turn_id
      )
    LIMIT ${BATCH_LIMIT}
  `);
  const rows = ((result as any).rows ?? result) as CandidateRow[];
  for (const r of rows) {
    await logServerEvent(
      r.user_id,
      "campaign_action",
      "retention",
      "campaign_abandoned_candidate",
      {
        lastSceneType: r.last_scene_type,
        turns: r.turns,
        chapter: r.chapter,
        totalChapters: r.total_chapters,
        lastTurnId: r.last_turn_id,
      },
      { campaignId: r.campaign_id },
    );
  }
  return rows.length;
}

let timer: ReturnType<typeof setInterval> | null = null;
let lastRunDay: string | null = null;

export function startEngagementJobs(): void {
  if (timer) return;
  const RUN_HOUR = Number(process.env.ENGAGEMENT_JOB_HOUR ?? 4); // quiet hour, server time
  const tick = async () => {
    try {
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      if (now.getHours() !== RUN_HOUR || lastRunDay === day) return;
      lastRunDay = day;
      const flagged = await flagAbandonedCampaigns();
      if (flagged) console.log(`[engagementJobs] flagged ${flagged} abandoned-candidate campaign(s)`);
    } catch (err) {
      console.warn("[engagementJobs] tick failed:", (err as Error)?.message);
    }
  };
  timer = setInterval(tick, 60 * 60 * 1000);
  console.log(`[engagementJobs] scheduler started (daily near ${RUN_HOUR}:00 server time)`);
}

export function stopEngagementJobs(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
