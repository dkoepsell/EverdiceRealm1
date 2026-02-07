import { db } from "../db";
import { 
  campaigns, characters, worldRegions, worldEvents, worldDiscoveries, 
  worldWhispers, campaignParticipants, campaignExplorationHexes,
  adventureCompletions, diceRolls
} from "@shared/schema";
import { eq, desc, sql, and, gt, inArray } from "drizzle-orm";

interface PressureEffects {
  instability?: number;
  danger?: number;
  opportunity?: number;
  mystery?: number;
}

interface EventCandidate {
  title: string;
  description: string;
  eventType: string;
  severity: string;
  affectedRegionIds: number[];
  pressureEffects: PressureEffects;
  sourceCampaignId: number;
  sourceCharacterName?: string;
  triggerType: string;
  triggerDetail: string;
}

export async function generateWorldEvents(): Promise<number> {
  let eventsCreated = 0;

  try {
    const candidates: EventCandidate[] = [];

    await Promise.all([
      scanStakeThresholds(candidates),
      scanAdventureCompletions(candidates),
      scanCriticalMoments(candidates),
      scanNarrativeMilestones(candidates),
    ]);

    for (const candidate of candidates) {
      const duplicate = await db.select({ id: worldEvents.id })
        .from(worldEvents)
        .where(and(
          eq(worldEvents.triggerType, candidate.triggerType),
          eq(worldEvents.triggerDetail, candidate.triggerDetail),
          eq(worldEvents.sourceCampaignId, candidate.sourceCampaignId!)
        ))
        .limit(1);

      if (duplicate.length > 0) continue;

      const [newEvent] = await db.insert(worldEvents).values({
        title: candidate.title,
        description: candidate.description,
        eventType: candidate.eventType,
        severity: candidate.severity,
        affectedRegionIds: candidate.affectedRegionIds,
        pressureEffects: candidate.pressureEffects,
        sourceCampaignId: candidate.sourceCampaignId,
        sourceCharacterName: candidate.sourceCharacterName,
        triggerType: candidate.triggerType,
        triggerDetail: candidate.triggerDetail,
        isActive: true,
        createdAt: new Date().toISOString(),
      }).returning();

      if (newEvent && candidate.affectedRegionIds.length > 0) {
        await applyPressureEffects(candidate.affectedRegionIds, candidate.pressureEffects);
        await generateWhispers(newEvent.id, candidate.affectedRegionIds, candidate.title);
      }

      eventsCreated++;
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error generating events:", error);
  }

  return eventsCreated;
}

async function scanStakeThresholds(candidates: EventCandidate[]) {
  try {
    const activeCampaigns = await db.select({
      id: campaigns.id,
      title: campaigns.title,
      campaignStakes: campaigns.campaignStakes,
      campaignQuestion: campaigns.campaignQuestion,
      worldRegionId: campaigns.worldRegionId,
      currentSession: campaigns.currentSession,
    })
      .from(campaigns)
      .where(sql`${campaigns.campaignStakes} IS NOT NULL AND ${campaigns.isCompleted} = false`);

    for (const camp of activeCampaigns) {
      const stakes = camp.campaignStakes as any[];
      if (!stakes || !Array.isArray(stakes)) continue;

      for (const stake of stakes) {
        if (!stake.name || stake.value === undefined) continue;

        if (stake.value >= (stake.max || 5)) {
          const regionIds = camp.worldRegionId ? [camp.worldRegionId] : await findNearestRegionIds();
          candidates.push({
            title: `${stake.name} Reaches Critical Mass`,
            description: `In the campaign "${camp.title}", ${stake.name.toLowerCase()} has reached its peak. ${stake.thresholdConsequence?.at5?.event || "The consequences ripple across the land."}`,
            eventType: "stake_threshold",
            severity: "major",
            affectedRegionIds: regionIds,
            pressureEffects: stakeToPresssure(stake.name, "max"),
            sourceCampaignId: camp.id,
            triggerType: "stake_max",
            triggerDetail: `${camp.id}-${stake.id || stake.name}-max`,
          });
        }

        if (stake.value <= 0 && stake.thresholdConsequence?.at0) {
          const regionIds = camp.worldRegionId ? [camp.worldRegionId] : await findNearestRegionIds();
          candidates.push({
            title: `${stake.name} Collapses`,
            description: `In the campaign "${camp.title}", ${stake.name.toLowerCase()} has fallen to nothing. ${stake.thresholdConsequence.at0.event || "A void opens where purpose once stood."}`,
            eventType: "stake_threshold",
            severity: "major",
            affectedRegionIds: regionIds,
            pressureEffects: stakeToPresssure(stake.name, "min"),
            sourceCampaignId: camp.id,
            triggerType: "stake_min",
            triggerDetail: `${camp.id}-${stake.id || stake.name}-min`,
          });
        }
      }
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error scanning stake thresholds:", error);
  }
}

async function scanAdventureCompletions(candidates: EventCandidate[]) {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentCompletions = await db.select({
      id: adventureCompletions.id,
      campaignId: adventureCompletions.campaignId,
      characterId: adventureCompletions.characterId,
      completedAt: adventureCompletions.completedAt,
      notes: adventureCompletions.notes,
    })
      .from(adventureCompletions)
      .where(gt(adventureCompletions.completedAt, threeDaysAgo))
      .orderBy(desc(adventureCompletions.completedAt))
      .limit(10);

    for (const comp of recentCompletions) {
      const camp = await db.select({ 
        title: campaigns.title, 
        worldRegionId: campaigns.worldRegionId,
        campaignStakes: campaigns.campaignStakes,
      })
        .from(campaigns)
        .where(eq(campaigns.id, comp.campaignId))
        .limit(1);

      const char = comp.characterId ? await db.select({ name: characters.name })
        .from(characters)
        .where(eq(characters.id, comp.characterId))
        .limit(1) : [];

      const campTitle = camp[0]?.title || "an unknown campaign";
      const charName = char[0]?.name || "An adventurer";
      const regionIds = camp[0]?.worldRegionId ? [camp[0].worldRegionId] : await findNearestRegionIds();

      candidates.push({
        title: `"${campTitle}" Concludes`,
        description: `${charName}'s campaign "${campTitle}" has reached a milestone. ${comp.notes || "The echoes of their choices linger across the realm."}`,
        eventType: "campaign_completion",
        severity: "moderate",
        affectedRegionIds: regionIds,
        pressureEffects: completionToPressure(null),
        sourceCampaignId: comp.campaignId,
        sourceCharacterName: charName,
        triggerType: "completion",
        triggerDetail: `completion-${comp.id}`,
      });
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error scanning completions:", error);
  }
}

async function scanCriticalMoments(candidates: EventCandidate[]) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const critRolls = await db.select({
      id: diceRolls.id,
      userId: diceRolls.userId,
      characterId: diceRolls.characterId,
      diceType: diceRolls.diceType,
      result: diceRolls.result,
      purpose: diceRolls.purpose,
      createdAt: diceRolls.createdAt,
    })
      .from(diceRolls)
      .where(and(
        gt(diceRolls.createdAt, oneDayAgo),
        eq(diceRolls.result, 20),
        eq(diceRolls.diceType, "d20")
      ))
      .orderBy(desc(diceRolls.createdAt))
      .limit(5);

    for (const roll of critRolls) {
      const char = roll.characterId ? await db.select({ name: characters.name })
        .from(characters)
        .where(eq(characters.id, roll.characterId))
        .limit(1) : [];

      const charName = char[0]?.name || "A hero";

      const userCampaign = await db.select({ 
        id: campaigns.id, 
        title: campaigns.title, 
        worldRegionId: campaigns.worldRegionId 
      })
        .from(campaigns)
        .where(and(eq(campaigns.userId, roll.userId), sql`${campaigns.isCompleted} = false`))
        .orderBy(desc(campaigns.currentSession))
        .limit(1);

      if (!userCampaign[0]?.worldRegionId) continue;

      const regionIds = [userCampaign[0].worldRegionId];
      const purpose = roll.purpose || "a critical moment";

      candidates.push({
        title: `${charName}'s Legendary ${purpose}`,
        description: `During "${userCampaign[0].title}", ${charName} achieved a natural 20 on ${purpose}. The feat reverberates across the realm.`,
        eventType: "heroic_feat",
        severity: "minor",
        affectedRegionIds: regionIds,
        pressureEffects: { opportunity: 3, mystery: -2 },
        sourceCampaignId: userCampaign[0].id,
        sourceCharacterName: charName,
        triggerType: "critical_roll",
        triggerDetail: `crit-${roll.id}`,
      });
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error scanning critical moments:", error);
  }
}

async function scanNarrativeMilestones(candidates: EventCandidate[]) {
  try {
    const activeCampaigns = await db.select({
      id: campaigns.id,
      title: campaigns.title,
      narrativeLog: campaigns.narrativeLog,
      worldRegionId: campaigns.worldRegionId,
      currentSession: campaigns.currentSession,
      globalStakes: campaigns.globalStakes,
    })
      .from(campaigns)
      .where(sql`${campaigns.narrativeLog} IS NOT NULL AND ${campaigns.isCompleted} = false`)
      .limit(20);

    for (const camp of activeCampaigns) {
      const log = camp.narrativeLog as any[];
      if (!log || log.length === 0) continue;

      const recentEntries = log.slice(-5);
      for (const entry of recentEntries) {
        const text = (entry.summary || entry.event || entry.reason || "").toLowerCase();
        if (text.length < 20) continue;

        let eventCandidate: EventCandidate | null = null;
        const regionIds = camp.worldRegionId ? [camp.worldRegionId] : [];
        if (regionIds.length === 0) continue;

        if (text.includes("war") || text.includes("battle") || text.includes("siege") || text.includes("army")) {
          eventCandidate = {
            title: `Conflict Erupts Near ${camp.title}`,
            description: `Reports of military activity from the campaign "${camp.title}": ${entry.summary || entry.event || entry.reason}`,
            eventType: "conflict",
            severity: "moderate",
            affectedRegionIds: regionIds,
            pressureEffects: { danger: 8, instability: 5, opportunity: -3 },
            sourceCampaignId: camp.id,
            triggerType: "narrative_conflict",
            triggerDetail: `narrative-conflict-${camp.id}-${log.indexOf(entry)}`,
          };
        } else if (text.includes("dragon") || text.includes("ancient evil") || text.includes("lich") || text.includes("demon")) {
          eventCandidate = {
            title: `Dark Power Stirs`,
            description: `From "${camp.title}": ${entry.summary || entry.event || entry.reason}. Dark forces grow restless.`,
            eventType: "supernatural",
            severity: "major",
            affectedRegionIds: regionIds,
            pressureEffects: { danger: 10, mystery: 8, instability: 3 },
            sourceCampaignId: camp.id,
            triggerType: "narrative_supernatural",
            triggerDetail: `narrative-super-${camp.id}-${log.indexOf(entry)}`,
          };
        } else if (text.includes("treaty") || text.includes("alliance") || text.includes("peace") || text.includes("trade")) {
          eventCandidate = {
            title: `Diplomatic Winds Shift`,
            description: `From "${camp.title}": ${entry.summary || entry.event || entry.reason}. New alliances may reshape the realm.`,
            eventType: "diplomatic",
            severity: "moderate",
            affectedRegionIds: regionIds,
            pressureEffects: { instability: -5, opportunity: 8, danger: -3 },
            sourceCampaignId: camp.id,
            triggerType: "narrative_diplomatic",
            triggerDetail: `narrative-diplo-${camp.id}-${log.indexOf(entry)}`,
          };
        } else if (text.includes("discover") || text.includes("ancient") || text.includes("ruin") || text.includes("artifact") || text.includes("tomb")) {
          eventCandidate = {
            title: `Ancient Secrets Uncovered`,
            description: `From "${camp.title}": ${entry.summary || entry.event || entry.reason}. The discovery draws attention from across the realm.`,
            eventType: "discovery",
            severity: "minor",
            affectedRegionIds: regionIds,
            pressureEffects: { mystery: 10, opportunity: 5 },
            sourceCampaignId: camp.id,
            triggerType: "narrative_discovery",
            triggerDetail: `narrative-disc-${camp.id}-${log.indexOf(entry)}`,
          };
        }

        if (eventCandidate) {
          candidates.push(eventCandidate);
        }
      }
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error scanning narrative milestones:", error);
  }
}

async function applyPressureEffects(regionIds: number[], effects: PressureEffects) {
  if (!effects || regionIds.length === 0) return;

  for (const regionId of regionIds) {
    const updates: Record<string, any> = {};
    if (effects.instability) updates.instability = sql`LEAST(100, GREATEST(0, ${worldRegions.instability} + ${effects.instability}))`;
    if (effects.danger) updates.danger = sql`LEAST(100, GREATEST(0, ${worldRegions.danger} + ${effects.danger}))`;
    if (effects.opportunity) updates.opportunity = sql`LEAST(100, GREATEST(0, ${worldRegions.opportunity} + ${effects.opportunity}))`;
    if (effects.mystery) updates.mystery = sql`LEAST(100, GREATEST(0, ${worldRegions.mystery} + ${effects.mystery}))`;

    if (Object.keys(updates).length > 0) {
      updates.lastPressureUpdate = new Date().toISOString();
      await db.update(worldRegions).set(updates).where(eq(worldRegions.id, regionId));
    }
  }
}

async function generateWhispers(eventId: number, affectedRegionIds: number[], eventTitle: string) {
  try {
    const affectedCampaigns = await db.select({ id: campaigns.id })
      .from(campaigns)
      .where(and(
        sql`${campaigns.isCompleted} = false`,
        inArray(campaigns.worldRegionId!, affectedRegionIds)
      ));

    for (const camp of affectedCampaigns) {
      await db.insert(worldWhispers).values({
        worldEventId: eventId,
        campaignId: camp.id,
        message: `World Event: "${eventTitle}" — This event affects the region where your campaign takes place. Consider weaving its consequences into your narrative.`,
        isRead: false,
        isDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error generating whispers:", error);
  }
}

export async function aggregateDiscoveries(): Promise<number> {
  let discoveryCount = 0;

  try {
    const exploredHexes = await db.select({
      campaignId: campaignExplorationHexes.campaignId,
      q: campaignExplorationHexes.q,
      r: campaignExplorationHexes.r,
      terrainType: campaignExplorationHexes.terrainType,
      locationName: campaignExplorationHexes.locationName,
      locationDescription: campaignExplorationHexes.locationDescription,
      hexMeta: campaignExplorationHexes.hexMeta,
      isExplored: campaignExplorationHexes.isExplored,
    })
      .from(campaignExplorationHexes)
      .where(eq(campaignExplorationHexes.isExplored, true))
      .limit(200);

    for (const hex of exploredHexes) {
      if (!hex.locationName) continue;

      const existing = await db.select({ id: worldDiscoveries.id })
        .from(worldDiscoveries)
        .where(and(
          eq(worldDiscoveries.hexQ!, hex.q),
          eq(worldDiscoveries.hexR!, hex.r),
          eq(worldDiscoveries.sourceCampaignId!, hex.campaignId)
        ))
        .limit(1);

      if (existing.length > 0) continue;

      const camp = await db.select({ 
        title: campaigns.title, 
        worldRegionId: campaigns.worldRegionId,
        userId: campaigns.userId 
      })
        .from(campaigns)
        .where(eq(campaigns.id, hex.campaignId))
        .limit(1);

      const participant = await db.select({ name: characters.name })
        .from(campaignParticipants)
        .leftJoin(characters, eq(campaignParticipants.characterId, characters.id))
        .where(eq(campaignParticipants.campaignId, hex.campaignId))
        .limit(1);

      const meta = hex.hexMeta as any;

      await db.insert(worldDiscoveries).values({
        regionId: camp[0]?.worldRegionId || null,
        discoveryType: meta?.importanceType === "quest_critical" ? "quest_site" : "exploration",
        title: hex.locationName,
        description: hex.locationDescription || `A ${hex.terrainType} area discovered during exploration.`,
        discoveredByUserId: camp[0]?.userId,
        discoveredByCharacterName: participant[0]?.name || "Unknown Explorer",
        sourceCampaignId: hex.campaignId,
        hexQ: hex.q,
        hexR: hex.r,
        terrainType: hex.terrainType,
        isPublic: true,
        metadata: {
          narrativeTone: meta?.narrativeTone,
          tension: meta?.tension,
          regionName: meta?.regionName,
          environmentTags: meta?.environmentTags,
        },
        createdAt: new Date().toISOString(),
      });

      discoveryCount++;
    }
  } catch (error) {
    console.error("[WorldEventEngine] Error aggregating discoveries:", error);
  }

  return discoveryCount;
}

function stakeToPresssure(stakeName: string, threshold: "max" | "min"): PressureEffects {
  const name = stakeName.toLowerCase();
  if (name.includes("trust") || name.includes("loyalty") || name.includes("alliance")) {
    return threshold === "max" 
      ? { instability: -5, opportunity: 8 }
      : { instability: 10, danger: 5 };
  }
  if (name.includes("corruption") || name.includes("dark") || name.includes("evil")) {
    return threshold === "max"
      ? { danger: 10, mystery: 5, instability: 8 }
      : { danger: -5, opportunity: 5 };
  }
  if (name.includes("discovery") || name.includes("knowledge") || name.includes("arcane")) {
    return threshold === "max"
      ? { mystery: 10, opportunity: 5 }
      : { mystery: -8, opportunity: -3 };
  }
  if (name.includes("survival") || name.includes("health") || name.includes("resource")) {
    return threshold === "max"
      ? { danger: -5, opportunity: 5 }
      : { danger: 8, instability: 5 };
  }
  return threshold === "max" ? { instability: 5, mystery: 3 } : { instability: 5, danger: 3 };
}

function completionToPressure(endingType?: string | null): PressureEffects {
  switch (endingType) {
    case "triumphant": return { danger: -8, opportunity: 10, instability: -5 };
    case "bittersweet": return { mystery: 5, opportunity: 3, instability: 3 };
    case "tragic": return { danger: 5, instability: 8, mystery: 3 };
    case "pyrrhic": return { danger: -3, instability: 5, opportunity: -5 };
    default: return { mystery: 3 };
  }
}

async function findNearestRegionIds(): Promise<number[]> {
  const regions = await db.select({ id: worldRegions.id })
    .from(worldRegions)
    .limit(1);
  return regions.map(r => r.id);
}
