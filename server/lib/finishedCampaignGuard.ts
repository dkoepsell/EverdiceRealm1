import type { Request, Response, NextFunction } from "express";

/**
 * A finished campaign is read-only: its story can be read back in the
 * Chronicles but no longer played. Without this, a party member who missed the
 * finale kept taking turns in a campaign that had already ended, and those
 * turns landed in the chronicle after "The End".
 *
 * Only actions that move the story or the table on are refused. Bookkeeping —
 * notes, banking, archiving, marking turns read, recording a visit — still works.
 */
const PLAY_ACTION = new RegExp(
  "^/api/campaigns/(\\d+)/(" +
    [
      "advance-story",
      "advance-story-stream",
      "assess-action",
      "combat-action",
      "start-combat",
      "initiative/roll",
      "oracle",
      "group-choices(/[^/]+)?",
      "sessions",
      "sessions/advance",
      "force-advance-chapter",
      "generate-scene",
      "dungeon-move",
      "dungeon-resolve",
      "exploration/move",
      "trek/[^/]+",
      "enter-location/[^/]+",
      "capital/[^/]+/(enter|move)",
      "city-map/[^/]+/discover",
      "turns/claim",
      "party/[^/]+",
      "start-live-session",
      "npcs/[^/]+/simulate-turn",
      "quests/[^/]+/(accept|complete)",
    ].join("|") +
    ")/?$",
);

/** The campaign id a request would play in, or null if it isn't a play action. */
export function playActionCampaignId(method: string, path: string): number | null {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  const match = path.match(PLAY_ACTION);
  return match ? parseInt(match[1], 10) : null;
}

export function blockFinishedCampaignPlay(getCampaign: (id: number) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const campaignId = playActionCampaignId(req.method, req.path);
    // Leave signed-out requests to the route's own 401, rather than telling a
    // stranger whether a campaign has finished.
    if (campaignId === null || !(req as any).isAuthenticated?.()) return next();
    try {
      const campaign = await getCampaign(campaignId);
      if (campaign?.isCompleted) {
        return res.status(409).json({
          message: "This adventure has ended. Its story can be read in the Chronicles.",
          code: "campaign_completed",
          chronicleUrl: `/chronicles/${campaignId}`,
        });
      }
    } catch (err) {
      // A failed lookup must not cost a player their turn; let the route decide.
      console.error(`[FinishedCampaignGuard] Lookup failed for campaign ${campaignId}:`, err);
    }
    next();
  };
}
