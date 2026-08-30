import { db } from "../db";
import {
  campaigns, worldRegions, worldLocations, worldEvents, worldRumors,
  worldDiscoveries, userWorldProgress,
} from "@shared/schema";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";

/**
 * Everything the narrator needs to know about *where the party is standing*.
 *
 * This exists because the story and the map used to be two unrelated systems: the AI
 * invented a fresh place name every session (41 distinct ones, none canonical) while the
 * hand-authored world of 13 regions and 21 locations sat unused, and the map was
 * retrofitted afterwards by regex-scraping the finished prose. Place is now an input.
 */
export interface WorldContext {
  regionId: number;
  regionName: string;
  regionDescription: string | null;
  terrain: string | null;
  levelRange: string | null;
  /** 0-100 pressure dials that make a region feel different between visits. */
  instability: number;
  danger: number;
  mood: string;
  /** The specific place within the region, when the campaign has one. */
  locationId: number | null;
  locationName: string | null;
  locationType: string | null;
  /** Named places already known in this region — the narrator should reuse these. */
  knownLocations: string[];
  /** Live world news for this region, newest first. */
  events: string[];
  rumors: string[];
  /** Other people's marks on the same ground. */
  otherTravelers: string[];
  otherTravelerCount: number;
}

/** Renders a WorldContext as the prompt block the narrator reads. Kept tight on purpose. */
export function formatWorldContext(ctx: WorldContext | null, fallbackLocation?: string): string {
  if (!ctx) {
    return `Location: ${fallbackLocation || "Unknown"}`;
  }

  const lines: string[] = [];
  const place = ctx.locationName ? `${ctx.locationName}, ${ctx.regionName}` : ctx.regionName;
  lines.push(`Location: ${place}`);
  lines.push(
    `Region: ${ctx.regionName}${ctx.terrain ? ` (${ctx.terrain})` : ""} — mood: ${ctx.mood}, danger ${ctx.danger}/100, instability ${ctx.instability}/100`
  );
  if (ctx.regionDescription) {
    lines.push(`Region character: ${ctx.regionDescription.slice(0, 200)}`);
  }
  if (ctx.knownLocations.length) {
    lines.push(`Known places in this region: ${ctx.knownLocations.slice(0, 8).join(", ")}`);
  }
  if (ctx.events.length) {
    lines.push(`Recent events here: ${ctx.events.slice(0, 3).join(" | ")}`);
  }
  if (ctx.rumors.length) {
    lines.push(`Rumors circulating: ${ctx.rumors.slice(0, 2).join(" | ")}`);
  }
  if (ctx.otherTravelerCount > 0) {
    const named = ctx.otherTravelers.slice(0, 3).join(", ");
    lines.push(
      `Others who have travelled here: ${ctx.otherTravelerCount} adventurer(s)${named ? ` including ${named}` : ""}. You may reference their passage as rumor, trail-sign, or local memory — never as present company.`
    );
  }

  lines.push(
    `GEOGRAPHY RULES: This scene takes place in ${ctx.regionName}. Do NOT invent or rename the region. ` +
      `Reuse the known places above where they fit. If the scene genuinely needs a new place, name it once and keep it consistent — it becomes part of ${ctx.regionName} permanently.`
  );

  return lines.join("\n");
}

/** "5-10" -> [5, 10]. Returns null for anything unparseable. */
function parseLevelRange(range: string | null | undefined): [number, number] | null {
  if (!range) return null;
  const m = range.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

/**
 * Picks the region a new campaign should be anchored to.
 *
 * Chooses among regions whose level range contains `partyLevel`, preferring the one the
 * most other players have already visited — landing new campaigns where other people have
 * been is the entire point of a shared world. Falls back to the widest-matching region,
 * then to the lowest-level one. Returns null if the world has no regions.
 */
export async function pickRegionForCampaign(partyLevel: number = 1): Promise<number | null> {
  try {
    const regions = await db.select().from(worldRegions);
    if (!regions.length) return null;

    const visits = await db
      .select({
        regionId: userWorldProgress.regionId,
        n: sql<number>`count(distinct ${userWorldProgress.userId})::int`,
      })
      .from(userWorldProgress)
      .groupBy(userWorldProgress.regionId);

    const visitsByRegion = new Map<number, number>();
    for (const v of visits) {
      if (v.regionId != null) visitsByRegion.set(v.regionId, v.n);
    }

    const inBand = regions.filter((r) => {
      const parsed = parseLevelRange(r.levelRange);
      return parsed ? partyLevel >= parsed[0] && partyLevel <= parsed[1] : false;
    });

    const candidates = inBand.length ? inBand : regions;
    if (!candidates.length) return null;

    // Weighted random, weight = prior visitors + 1. This leans toward regions people have
    // already explored — meeting someone else's trail is the whole point — without
    // funnelling every campaign into a single region and making the world feel like one
    // room. Three starter regions exist; all three should see traffic.
    const weights = candidates.map((r) => (visitsByRegion.get(r.id) ?? 0) + 1);
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i].id;
    }
    return candidates[candidates.length - 1].id;
  } catch (error) {
    console.error("[worldContext] Failed to pick a region:", error);
    return null;
  }
}

/**
 * Records a place the narrator invented as a real location in the campaign's region, so
 * other players can later travel to it. No-ops if the campaign has no region, if the name
 * looks like a placeholder, or if the place is already known.
 */
export async function adoptInventedLocation(
  campaignId: number,
  rawName: string
): Promise<number | null> {
  const name = rawName?.trim();
  if (!name || name.length < 3 || name.length > 120) return null;
  if (/^(unknown|starting village|the starting village|n\/a|none)$/i.test(name)) return null;

  try {
    const [campaign] = await db
      .select({ regionId: campaigns.worldRegionId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign?.regionId) return null;

    const [existing] = await db
      .select({ id: worldLocations.id })
      .from(worldLocations)
      .where(and(eq(worldLocations.regionId, campaign.regionId), sql`lower(${worldLocations.name}) = lower(${name})`))
      .limit(1);
    if (existing) return existing.id;

    const [created] = await db
      .insert(worldLocations)
      .values({
        regionId: campaign.regionId,
        name,
        locationType: "landmark",
        description: `Discovered in play.`,
      } as any)
      .returning({ id: worldLocations.id });

    console.log(`[worldContext] Adopted "${name}" into region ${campaign.regionId} (campaign ${campaignId})`);
    return created?.id ?? null;
  } catch (error) {
    console.error(`[worldContext] Failed to adopt location "${name}":`, error);
    return null;
  }
}

/**
 * World events that struck this campaign's region since a given moment.
 *
 * "While you were away" previously drew only on `world_memory`, which is campaign-scoped —
 * so it could only ever report the party's own past back to them. These events come from
 * the shared world and are largely driven by *other* players, which is what makes a
 * returning player feel they left a place rather than paused a document.
 */
export async function getRegionEventsSince(
  campaignId: number,
  sinceIso: string
): Promise<string[]> {
  try {
    const [campaign] = await db
      .select({ regionId: campaigns.worldRegionId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign?.regionId) return [];

    const rows = await db
      .select({ title: worldEvents.title, description: worldEvents.description })
      .from(worldEvents)
      .where(
        and(
          sql`${worldEvents.affectedRegionIds}::jsonb @> ${JSON.stringify([campaign.regionId])}::jsonb`,
          sql`${worldEvents.createdAt} > ${sinceIso}`
        )
      )
      .orderBy(desc(worldEvents.createdAt))
      .limit(4);

    return rows
      .map((r) => (r.description ? `${r.title} — ${r.description}` : r.title))
      .filter(Boolean) as string[];
  } catch (error) {
    console.error(`[worldContext] Failed to load region events for campaign ${campaignId}:`, error);
    return [];
  }
}

/**
 * Loads the shared-world context for a campaign. Returns null when the campaign has no
 * region anchor, so callers fall back to the old free-text location.
 */
export async function getWorldContext(campaignId: number): Promise<WorldContext | null> {
  try {
    const [campaign] = await db
      .select({
        worldRegionId: campaigns.worldRegionId,
        worldLocationId: campaigns.worldLocationId,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign?.worldRegionId) return null;
    const regionId = campaign.worldRegionId;

    const [region] = await db
      .select()
      .from(worldRegions)
      .where(eq(worldRegions.id, regionId))
      .limit(1);
    if (!region) return null;

    const [
      locationRows,
      allRegionLocations,
      eventRows,
      rumorRows,
      travelerRows,
      travelerCountRows,
    ] = await Promise.all([
      campaign.worldLocationId
        ? db.select().from(worldLocations).where(eq(worldLocations.id, campaign.worldLocationId)).limit(1)
        : Promise.resolve([]),
      db
        .select({ name: worldLocations.name })
        .from(worldLocations)
        .where(eq(worldLocations.regionId, regionId))
        .limit(12),
      db
        .select({ title: worldEvents.title, description: worldEvents.description })
        .from(worldEvents)
        .where(sql`${worldEvents.affectedRegionIds}::jsonb @> ${JSON.stringify([regionId])}::jsonb`)
        .orderBy(desc(worldEvents.createdAt))
        .limit(3),
      db
        .select({ text: worldRumors.narrative })
        .from(worldRumors)
        .where(
          and(
            eq(worldRumors.isActive, true),
            or(eq(worldRumors.regionId, regionId), isNull(worldRumors.regionId))
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(2),
      db
        .selectDistinct({ name: worldDiscoveries.discoveredByCharacterName })
        .from(worldDiscoveries)
        .where(
          and(
            eq(worldDiscoveries.regionId, regionId),
            sql`${worldDiscoveries.discoveredByCharacterName} IS NOT NULL`
          )
        )
        .limit(6),
      db
        .select({ n: sql<number>`count(distinct ${userWorldProgress.userId})::int` })
        .from(userWorldProgress)
        .where(eq(userWorldProgress.regionId, regionId)),
    ]);

    const location = locationRows[0];

    return {
      regionId,
      regionName: region.name,
      regionDescription: region.description ?? null,
      terrain: (region as any).terrain ?? null,
      levelRange: region.levelRange ?? null,
      instability: region.instability ?? 0,
      danger: region.danger ?? 0,
      mood: region.currentMood ?? "stable",
      locationId: location?.id ?? null,
      locationName: location?.name ?? null,
      locationType: location?.locationType ?? null,
      knownLocations: allRegionLocations.map((l) => l.name).filter(Boolean),
      events: eventRows.map((e) => e.title).filter(Boolean),
      rumors: rumorRows.map((r) => r.text).filter(Boolean) as string[],
      otherTravelers: travelerRows.map((t) => t.name).filter(Boolean) as string[],
      otherTravelerCount: travelerCountRows[0]?.n ?? 0,
    };
  } catch (error) {
    // Never let world context break story generation — fall back to the old behaviour.
    console.error(`[worldContext] Failed to load context for campaign ${campaignId}:`, error);
    return null;
  }
}
