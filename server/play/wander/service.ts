/**
 * Wander turn logic (wander-threads-spec.md). wanderRoutes.ts stays a thin
 * HTTP layer; this module decides what a move, a choice and a night's camp
 * do. Every feature is behind its own engagement flag, and every thread or
 * rumor read fails soft (store.ts), so a campaign with everything off plays
 * exactly as Wander did before.
 */
import { storage } from "../../storage";
import { resolveFlags, type EngagementFlags } from "@shared/engagementFlags";
import type { WanderRun } from "@shared/schema";
import {
  rollOutcome, calculateDangerRating, resolveChoice, defaultInvestigateCheck, type CuratedOutcome,
} from "../../wanderEngine";
import { generateProceduralDungeon } from "../../delveEngine";
import { markSeen, seenIds } from "../content/seen";
import { loadLedger, saveLedger } from "../ledger/store";
import { mergeLedgerUpdates } from "../ledger/merge";
import {
  WANDER_HEX_DIRECTIONS, bearing, biomeForHex, getTerrainForHex, hexDistance, hexesWithin,
} from "@shared/wander/terrain";
import { landmarkAt, type Landmark } from "@shared/wander/landmarks";
import {
  EXHAUSTION_RUN_ENDS, endOfDay, forageDC, forageYield, forcedMarchSaves, hoursPerHex, initialTravelState,
  isNight, navigationBaseDC, navigationModifiers, navigationCheckDue, absoluteHour, parseTravelState, sightRadius, travelPassivePerception,
  type Pace, type TravelActivity, type TravelState,
} from "@shared/wander/travel";
import { getAbilityModifier } from "@shared/rules/xp";
import { rechargeFeatures, hitDiceAfterLongRest, spendHitDice } from "@shared/rules/rests";
import { parseFeatureState } from "@shared/rules/leveling";
import { getClassDef } from "@shared/rules/classProgression";
import {
  basePassivePerception, determineAwareness, hasDarkvision, rollSave, rollSkill, type WanderCharacter,
} from "./checks";
import {
  MAX_OPEN_THREADS, MAX_RUMORS, START_CHANCE_ON_DISCOVERY, fill, advanceClocks, journalEntry, makeRumor, onMove,
  pickTarget, rollName, signOutcomeFor, startableTemplates, type ThreadRow,
} from "./threads";
import { getTemplate, personalTemplateFor, type ThreadTemplate } from "./threadTemplates";
import { RECURRING_CHANCE, getRecurring, pickRecurring, recurringOutcome } from "./recurring";
import {
  addRealmMark, createThread, getThread, latestWanderCampaign, listThreads, nodRealmMark, postCompletionRumor, realmMarksNear, updateThread,
} from "./store";
import { REALM_PHRASES } from "@shared/wander/realm";

type Rng = () => number;

/** "Days later" in town: several long rests with food bring a collapsed character back to one level. */
const COLLAPSE_RECOVERS_TO = 1;

interface RunFlags {
  travel?: unknown;
  landmarks?: string[];
  [k: string]: unknown;
}

const FALLBACK_CHARACTER: WanderCharacter = {
  level: 3, skills: [], strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
};

async function loadContext(run: WanderRun) {
  const [campaign, character] = await Promise.all([
    storage.getCampaign(run.campaignId),
    storage.getCharacter(run.characterId),
  ]);
  const flags = resolveFlags(campaign);
  const char: WanderCharacter = (character as any) ?? FALLBACK_CHARACTER;
  return { campaign, character, char, flags };
}

function runFlagsOf(run: WanderRun): RunFlags {
  const f = run.flags;
  return f && typeof f === "object" && !Array.isArray(f) ? { ...(f as RunFlags) } : {};
}

export function travelFor(run: WanderRun, exhaustion?: number | null): TravelState {
  return parseTravelState(runFlagsOf(run).travel)
    ?? initialTravelState({ exhaustion, biome: biomeForHex(run.currentHexQ, run.currentHexR) });
}

async function saveExhaustion(characterId: number, before: number, after: number) {
  if (before === after) return;
  try {
    await storage.updateCharacter(characterId, { exhaustionLevel: after } as any);
  } catch (err) {
    console.warn("[wander] could not save exhaustion:", (err as Error)?.message);
  }
}

/** Landmarks and thread targets visible from (q, r). */
function visibleLandmarks(q: number, r: number, radius: number, threads: ThreadRow[]): Landmark[] {
  const out: Landmark[] = [];
  for (const h of hexesWithin(q, r, radius)) {
    const l = landmarkAt(h.q, h.r);
    if (l) out.push(l);
  }
  return out.concat(threadLandmarks(threads));
}

/** Rumored places, and thread targets once you are close (approach beat). */
function threadLandmarks(threads: ThreadRow[]): Landmark[] {
  const out: Landmark[] = [];
  for (const t of threads) {
    const tpl = getTemplate(t.templateId);
    if (!tpl) continue;
    if (t.status === "rumored") {
      out.push({ q: t.targetHexQ, r: t.targetHexR, key: `thread:${t.id}`, name: `Rumor: ${tpl.name}`, distant: t.payload?.rumorText ?? "a place from a Tavern rumor", glyph: "❓", threadId: t.id });
    } else if (t.status === "active" && t.beat >= 2) {
      out.push({ q: t.targetHexQ, r: t.targetHexR, key: `thread:${t.id}`, name: fill(tpl.climax.title, { name: t.payload?.name }), distant: "where the trail leads", glyph: "❗", threadId: t.id });
    }
  }
  return out;
}

function landmarksFromKeys(keys: string[] | undefined): Landmark[] {
  const out: Landmark[] = [];
  for (const k of keys ?? []) {
    const [q, r] = k.split(",").map(Number);
    if (Number.isFinite(q) && Number.isFinite(r)) {
      const l = landmarkAt(q, r);
      if (l) out.push(l);
    }
  }
  return out;
}

function threadsOn(flags: EngagementFlags) { return flags.wanderThreads; }
function rumorsOn(flags: EngagementFlags) { return flags.wanderThreads && flags.wanderRumors; }

async function journalFor(userId: number, campaignId: number, flags: EngagementFlags, q: number, r: number) {
  if (!threadsOn(flags)) return [];
  const rows = await listThreads(userId, campaignId);
  return rows.filter((t) => rumorsOn(flags) || t.status !== "rumored").map((t) => journalEntry(t, q, r));
}

/** The DM-path note that explains this outcome, if any. */
function screenNoteFor(o: CuratedOutcome): string | undefined {
  if (o.thread) {
    if (o.thread.beat === "sign" && (o.thread.templateId ?? "").startsWith("personal_")) return "personal_hook";
    return ({ sign: "breadcrumbs", trace: "breadcrumbs", approach: "breadcrumbs", climax: "many_solutions", debunk: "false_rumor", reminder: "doom_clock" } as Record<string, string>)[o.thread.beat];
  }
  if (o.recurring) return "recurring_npc";
  if (o.awareness) return "surprise";
  return undefined;
}

/** Add check hints to plain investigate choices, so the card can show "(Investigation DC 10)". */
function withCheckHints(outcome: CuratedOutcome): CuratedOutcome {
  return {
    ...outcome,
    choices: outcome.choices.map((c) => (c.intentTag === "investigate" && !c.check ? { ...c, check: defaultInvestigateCheck(outcome) } : c)),
  };
}

// ── start ─────────────────────────────────────────────────────────────────────

/** Initial run flags for a new run (travel state), or null if travel is off. */
export async function initialRunFlags(campaignId: number, characterId: number): Promise<RunFlags | null> {
  const [campaign, character] = await Promise.all([storage.getCampaign(campaignId), storage.getCharacter(characterId)]);
  const flags = resolveFlags(campaign);
  if (!flags.wanderTravel) return null;
  return { travel: initialTravelState({ exhaustion: (character as any)?.exhaustionLevel ?? 0, biome: "grass" }), landmarks: ["0,0"] };
}

// ── move ──────────────────────────────────────────────────────────────────────

export interface MoveBody {
  toHexQ: number;
  toHexR: number;
  pace?: Pace;
  activity?: TravelActivity;
}

export async function wanderMove(userId: number, run: WanderRun, body: MoveBody, rng: Rng = Math.random) {
  const { campaign, char, flags } = await loadContext(run);
  const rolls: string[] = [];
  const notes: string[] = [];
  const runFlags = runFlagsOf(run);
  const fromQ = run.currentHexQ, fromR = run.currentHexR;

  // ── travel: pace, activity, navigation, time ────────────────────────────────
  let travel: TravelState | null = flags.wanderTravel ? travelFor(run, (char as any).exhaustionLevel) : null;
  const exhaustionStart = travel?.exhaustion ?? 0;
  if (travel) {
    if (body.pace === "fast" || body.pace === "normal" || body.pace === "slow") travel.pace = body.pace;
    if (body.activity === "navigate" || body.activity === "forage" || body.activity === "scout") travel.activity = body.activity;
  }
  const night = travel ? isNight(travel.hour) : false;
  const darkvision = hasDarkvision((char as any).race);

  let toQ = body.toHexQ, toR = body.toHexR;
  let lost: { intended: { q: number; r: number }; actual: { q: number; r: number } } | null = null;

  if (travel) {
    const baseDC = navigationBaseDC(biomeForHex(fromQ, fromR));
    const navigating = travel.activity === "navigate";
    if (baseDC == null) {
      notes.push("Following the coastline, you can't get lost.");
    } else if (!navigating && baseDC <= 5) {
      // Open grassland: nobody needs to navigate.
    } else if (!navigationCheckDue(travel, baseDC)) {
      // Still oriented from the last check in this terrain.
    } else {
      const dis = (navigating ? 0 : 1) + (night && !darkvision ? 1 : 0);
      const r = rollSkill(char, "survival", baseDC, { exhaustion: travel.exhaustion, situational: navigationModifiers(travel.pace, travel.weather), disadvantage: dis });
      rolls.push(`${navigating ? "Navigating" : "No one is navigating (disadvantage)"}. ${r.text}`);
      travel.oriented = r.success ? { dc: baseDC, at: absoluteHour(travel) } : null;
      if (!r.success) {
        const options = WANDER_HEX_DIRECTIONS
          .map((d) => ({ q: fromQ + d.dq, r: fromR + d.dr }))
          .filter((h) => !(h.q === toQ && h.r === toR));
        const dry = options.filter((h) => getTerrainForHex(h.q, h.r) !== "ocean");
        const pool = dry.length ? dry : options;
        const actual = pool[Math.floor(rng() * pool.length)];
        lost = { intended: { q: toQ, r: toR }, actual };
        toQ = actual.q; toR = actual.r;
        notes.push(`You lose your bearings and wander ${bearing(fromQ, fromR, toQ, toR)} instead of ${bearing(fromQ, fromR, lost.intended.q, lost.intended.r)}.`);
      }
    }

    const hours = hoursPerHex(travel.pace, travel.exhaustion);
    const before = travel.hoursToday;
    const after = before + hours;
    for (const dc of forcedMarchSaves(before, after)) {
      const s = rollSave(char, "constitution", dc, { exhaustion: travel.exhaustion });
      rolls.push(`Forced march (hour ${Math.round(dc - 10 + 8)} of travel today). ${s.text}`);
      if (!s.success) {
        travel.exhaustion = Math.min(6, travel.exhaustion + 1);
        notes.push("The forced march costs you a level of exhaustion.");
      }
    }
    travel.hoursToday = after;
    travel.hour += hours;
  }

  const toBiome = biomeForHex(toQ, toR);
  const newTick = run.tick + 1;

  // ── forage and water ────────────────────────────────────────────────────────
  if (travel && travel.activity === "forage") {
    if (travel.pace === "fast") {
      notes.push("You can't forage at a fast pace.");
    } else {
      const dc = forageDC(toBiome, travel.weather);
      const r = rollSkill(char, "survival", dc, { exhaustion: travel.exhaustion });
      rolls.push(`Foraging. ${r.text}`);
      if (r.success) {
        const d6 = 1 + Math.floor(rng() * 6);
        const wis = getAbilityModifier(Number(char.wisdom) || 10);
        const y = forageYield(wis, d6);
        travel.food += y;
        travel.water += y;
        notes.push(`You gather ${y} lb of food and ${y} gallon${y === 1 ? "" : "s"} of water (1d6 (${d6}) ${wis >= 0 ? "+" : "−"} ${Math.abs(wis)} Wis).`);
      }
    }
  }
  const lm = flags.wanderLandmarks ? landmarkAt(toQ, toR) : null;
  if (travel && lm?.water && travel.water < 4) {
    travel.water = 4;
    notes.push(`You refill your waterskins at ${lm.name}.`);
  }

  // ── threads and rumors ──────────────────────────────────────────────────────
  let threads = threadsOn(flags) ? await listThreads(userId, run.campaignId) : [];
  if (!rumorsOn(flags)) threads = threads.filter((t) => t.status !== "rumored");
  let outcome: CuratedOutcome | null = null;
  if (threads.length) {
    const tm = onMove(threads, { fromQ, fromR, toQ, toR }, rng);
    for (const p of tm.patches) {
      await updateThread(p.id, { beat: p.beat, status: p.status, payload: p.payload });
      threads = threads.map((t) => (t.id === p.id ? { ...t, beat: p.beat ?? t.beat, status: p.status ?? t.status, payload: p.payload ?? t.payload } : t));
    }
    if (tm.outcome) outcome = tm.outcome as unknown as CuratedOutcome;
  }

  // ── personal trail (backstory) ──────────────────────────────────────────────
  if (!outcome && threadsOn(flags) && flags.backstoryTrails && newTick >= 2 && !runFlags.personalChecked) {
    runFlags.personalChecked = true;
    const all = await listThreads(userId, run.campaignId, ["active", "rumored", "resolved", "abandoned", "expired", "debunked"]);
    const charId = (char as any).id as number | undefined;
    if (charId && !all.some((t) => t.payload?.personal && t.payload?.characterId === charId)) {
      const t = personalTemplateFor((char as any).background);
      const target = pickTarget(t, toQ, toR, rng, [3, 5]);
      const row = await createThread({
        campaignId: run.campaignId, userId, templateId: t.id, beat: 0,
        targetHexQ: target.q, targetHexR: target.r, status: "active",
        payload: { characterId: charId, personal: true, movesSinceAdvance: 0 },
      });
      if (row) {
        const o = signOutcomeFor(t, row, toQ, toR) as unknown as CuratedOutcome;
        const bond = ((char as any).personality as any)?.bond as string | undefined;
        outcome = { ...o, reveal: `${o.reveal} This one is personal${bond ? `. Your bond: "${bond}"` : ""}.` };
        threads = [row, ...threads];
      }
    }
  }

  // ── recurring characters ────────────────────────────────────────────────────
  if (!outcome && flags.wanderRecurring && newTick >= 2 && rng() < RECURRING_CHANCE) {
    const ledger = await loadLedger(run.campaignId, campaign as any);
    outcome = recurringOutcome(pickRecurring(rng), ledger) as unknown as CuratedOutcome;
  }

  // ── the ordinary roll ───────────────────────────────────────────────────────
  const nearTarget = threads.some((t) => t.status === "active" && hexDistance(toQ, toR, t.targetHexQ, t.targetHexR) <= 2);
  const dangerRating = calculateDangerRating({
    biome: toBiome,
    proximityToLairs: nearTarget ? 1 : 0,
    ticksSinceRest: travel ? Math.ceil(travel.hoursToday / 2) : newTick,
    partyLevel: Number(char.level) || 3,
    isHot: travel?.hot ?? false,
  });

  if (!outcome) {
    const fresh = flags.freshContent ? { seen: await seenIds(userId, "wander") } : undefined;
    outcome = rollOutcome({
      biome: toBiome,
      dangerRating,
      lastOutcomeType: run.lastOutcomeType,
      tick: newTick,
      fresh,
      discoveryBias: lm && !(toQ === 0 && toR === 0) ? 0.25 : 0,
    });
    if (fresh && outcome.contentId) void markSeen(userId, "wander", outcome.contentId);

    // A discovery may be the first sign of a new thread.
    const activeCount = threads.filter((t) => t.status === "active").length;
    if (threadsOn(flags) && outcome.type === "discovery" && activeCount < MAX_OPEN_THREADS && rng() < START_CHANCE_ON_DISCOVERY) {
      const candidates = startableTemplates(toBiome, threads);
      if (candidates.length) {
        const t = candidates[Math.floor(rng() * candidates.length)];
        const target = pickTarget(t, toQ, toR, rng);
        const row = await createThread({
          campaignId: run.campaignId, userId, templateId: t.id, beat: 0,
          targetHexQ: target.q, targetHexR: target.r, status: "active",
          payload: { name: rollName(t, rng), movesSinceAdvance: 0 },
        });
        if (row) {
          outcome = signOutcomeFor(t, row, toQ, toR) as unknown as CuratedOutcome;
          threads = [row, ...threads];
        }
      }
    }
  }

  // ── surprise ────────────────────────────────────────────────────────────────
  if (flags.wanderChecks && outcome.type === "risk" && outcome.combatSeed && !outcome.thread) {
    const pp = travel
      ? travelPassivePerception({ base: basePassivePerception(char, travel.exhaustion), pace: travel.pace, activity: travel.activity, weather: travel.weather, night, darkvision })
      : { score: basePassivePerception(char), notes: [] as string[] };
    const aw = determineAwareness({ char, difficulty: outcome.combatSeed.difficulty, slowPace: travel?.pace === "slow", passivePerception: pp.score, exhaustion: travel?.exhaustion ?? 0 });
    if (pp.notes.length) aw.notes[aw.notes.length - 1] += ` (${pp.notes.join(", ")})`;
    rolls.push(...aw.notes);
    outcome = {
      ...outcome,
      awareness: aw.awareness,
      threatPassive: aw.threatPassive,
      choices: outcome.choices.map((c) => {
        if (c.intentTag === "avoid") {
          if (aw.awareness === "ambushed") return { ...c, label: "Try to break away", check: { skill: "athletics", dc: 12 } };
          if (aw.awareness === "spotted") return { ...c, check: { skill: "stealth", dc: aw.threatPassive } };
          return { ...c, label: `${c.label} (they haven't seen you)` };
        }
        if (c.intentTag === "retreat" && aw.awareness === "ambushed") return { ...c, check: { skill: "athletics", dc: 12 } };
        return c;
      }),
    };
  }
  if (flags.wanderChecks && !outcome.thread) outcome = withCheckHints(outcome);
  outcome = { ...outcome, rolls, screenNote: screenNoteFor(outcome) };

  // ── landmarks ───────────────────────────────────────────────────────────────
  let landmarks: Landmark[] = [];
  if (flags.wanderLandmarks) {
    const radius = travel
      ? sightRadius({ terrain: getTerrainForHex(toQ, toR), activity: travel.activity, weather: travel.weather, night: isNight(travel.hour) })
      : 2;
    landmarks = visibleLandmarks(toQ, toR, radius, threads);
    const keys = new Set(runFlags.landmarks ?? []);
    for (const l of landmarks) if (!l.threadId) keys.add(l.key);
    runFlags.landmarks = Array.from(keys).slice(-300);
  }

  // ── shared realm ────────────────────────────────────────────────────────────
  const realmMarks = flags.sharedRealm
    ? await realmMarksNear(toQ, toR, Math.max(1, travel ? sightRadius({ terrain: getTerrainForHex(toQ, toR), activity: travel.activity, weather: travel.weather, night: isNight(travel.hour) }) : 2), userId)
    : [];

  // ── persist ─────────────────────────────────────────────────────────────────
  let collapse = false;
  if (travel) {
    if (travel.exhaustion >= EXHAUSTION_RUN_ENDS) {
      collapse = true;
      notes.push("You can't go on. You collapse, and wake in town days later, carried back by a passing patrol. The rest leaves you at one level of exhaustion.");
      await saveExhaustion(run.characterId, exhaustionStart, COLLAPSE_RECOVERS_TO);
    } else {
      await saveExhaustion(run.characterId, exhaustionStart, travel.exhaustion);
    }
    runFlags.travel = travel;
  }

  const updatedRun = await storage.updateWanderRun(run.id, {
    currentHexQ: toQ,
    currentHexR: toR,
    tick: newTick,
    fatigue: run.fatigue + 1,
    lastOutcomeType: outcome.type,
    flags: runFlags as any,
  });

  await storage.createWanderOutcome({
    runId: run.id,
    tick: newTick,
    fromHexQ: fromQ,
    fromHexR: fromR,
    toHexQ: toQ,
    toHexR: toR,
    outcomeType: outcome.type,
    outcomePayload: outcome as any,
    createdAt: new Date().toISOString(),
  });

  await storage.upsertHexExplorationState({
    userId,
    campaignId: run.campaignId,
    hexQ: toQ,
    hexR: toR,
    state: "seen",
    discoveredAt: new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
  });

  return {
    run: updatedRun,
    outcome,
    dangerRating,
    travel,
    notes,
    lost,
    landmarks,
    journal: threads.filter((t) => t.status === "active" || t.status === "rumored").map((t) => journalEntry(t, toQ, toR)),
    realmMarks,
    collapse,
  };
}

// ── choose ────────────────────────────────────────────────────────────────────

/**
 * The outcome the server actually served for this run's latest move. The
 * client sends the outcome back with its choice; we prefer our own copy so a
 * client cannot rewrite DCs or rewards.
 */
async function servedOutcome(runId: number, fromClient: CuratedOutcome): Promise<CuratedOutcome> {
  try {
    const log = await storage.getWanderOutcomes(runId);
    const last = log.length ? log.reduce((a, b) => (b.tick > a.tick ? b : a)) : null;
    const payload = last?.outcomePayload as CuratedOutcome | undefined;
    if (payload && payload.title === fromClient.title) return payload;
  } catch { /* fall back to the client copy */ }
  return fromClient;
}

export async function wanderChoose(userId: number, run: WanderRun, choiceId: string, clientOutcome: CuratedOutcome, rng: Rng = Math.random) {
  const ctx = await loadContext(run);
  const outcome = await servedOutcome(run.id, clientOutcome);
  const choice = outcome.choices?.find((c) => c.id === choiceId);
  if (!choice) return { error: "Invalid choice ID for this outcome" as const };

  if (outcome.thread && threadsOn(ctx.flags)) return chooseThread(userId, run, ctx, outcome, choiceId, rng);
  if (outcome.recurring && ctx.flags.wanderRecurring) return chooseRecurring(userId, run, ctx, outcome, choiceId, rng);

  const travel = ctx.flags.wanderTravel ? travelFor(run, (ctx.char as any).exhaustionLevel) : null;
  const exhaustion = travel?.exhaustion ?? 0;
  const resolution = resolveChoice({
    intentTag: choice.intentTag,
    outcome,
    characterLevel: Number(ctx.char.level) || 3,
    fatigue: run.fatigue,
    choiceId,
    roll: ctx.flags.wanderChecks ? (skill, dc) => rollSkill(ctx.char, skill, dc, { exhaustion }) : undefined,
  });

  let markerCreated = false;
  if (resolution.markerToCreate) {
    await storage.createWanderMarker({
      campaignId: run.campaignId,
      hexQ: run.currentHexQ,
      hexR: run.currentHexR,
      markerType: resolution.markerToCreate.type,
      title: resolution.markerToCreate.title,
      blurb: resolution.markerToCreate.blurb,
      tags: resolution.markerToCreate.tags,
      discoveredBy: userId,
      persistence: "permanent",
      createdAt: new Date().toISOString(),
    });
    markerCreated = true;
    await storage.upsertHexExplorationState({
      userId, campaignId: run.campaignId, hexQ: run.currentHexQ, hexR: run.currentHexR,
      state: "noted", lastVisitedAt: new Date().toISOString(),
    });
  }
  const fight = resolution.combatTriggered && ctx.flags.exploreCombat;
  await storage.updateWanderRun(run.id, {
    fatigue: Math.max(0, run.fatigue + resolution.fatigueChange),
    ...(fight ? { flags: { ...runFlagsOf(run), pendingCombat: { seed: resolution.combatSeed, source: "wander" } } as any } : {}),
  });

  return {
    resolution,
    markerCreated,
    combatTriggered: resolution.combatTriggered,
    combatSeed: resolution.combatTriggered ? resolution.combatSeed : undefined,
    /** Engagement 2: the fight is real; POST /api/skirmish/start to begin it. */
    skirmishReady: fight,
    travel,
  };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

async function chooseThread(userId: number, run: WanderRun, ctx: Ctx, outcome: CuratedOutcome, choiceId: string, rng: Rng) {
  const ref = outcome.thread!;
  const row = await getThread(ref.id);
  const t = getTemplate(ref.templateId);
  if (!row || row.userId !== userId || !t) {
    return { resolution: { narrativeResult: "The trail has gone cold.", rewards: [], fatigueChange: 0, dangerChange: 0, combatTriggered: false, rolls: [] }, markerCreated: false, combatTriggered: false };
  }
  let travel: TravelState | null = ctx.flags.wanderTravel ? travelFor(run, (ctx.char as any).exhaustionLevel) : null;
  const exhaustionStart = travel?.exhaustion ?? 0;
  const roll = (skill: string, dc: number) => rollSkill(ctx.char, skill, dc, { exhaustion: travel?.exhaustion ?? 0 });
  const rolls: string[] = [];
  const b = bearing(run.currentHexQ, run.currentHexR, row.targetHexQ, row.targetHexR);
  let narrativeResult = "";
  let rewards: Array<{ kind: string; name: string; quantity: number }> = [];
  let fatigueChange = 0;
  let combatTriggered = false;
  let combatSeed: any;
  let markerCreated = false;
  let payoff: { kind: string; dungeonId?: number; name?: string } | undefined;
  let pendingCombat: Record<string, unknown> | undefined;

  const mark = async (q: number, r: number, title: string, blurb: string, linkedDungeonId?: number) => {
    await storage.createWanderMarker({
      campaignId: run.campaignId, hexQ: q, hexR: r, markerType: t.markerType, title, blurb,
      tags: ["thread", t.id], discoveredBy: userId, persistence: "permanent",
      linkedDungeonId: linkedDungeonId ?? null, createdAt: new Date().toISOString(),
    } as any);
    markerCreated = true;
  };

  switch (ref.beat) {
    case "sign":
    case "trace":
    case "approach": {
      if (choiceId === "study") {
        const c = outcome.choices.find((x) => x.id === "study")?.check ?? { skill: t.trackSkill, dc: 12 };
        const r = roll(c.skill, c.dc);
        rolls.push(r.text);
        fatigueChange = 1;
        narrativeResult = r.success ? (outcome.detail ?? outcome.reveal) : `You can't make out much more. The signs point ${b}.`;
        if (r.success) await mark(run.currentHexQ, run.currentHexR, outcome.title, outcome.reveal);
      } else {
        narrativeResult = `You note the bearing in your journal: ${b}.`;
      }
      break;
    }
    case "reminder": {
      if (choiceId === "abandon") {
        await updateThread(row.id, { status: "abandoned" });
        narrativeResult = `You let ${t.name.toLowerCase()} go. Some trails are not worth following.`;
      } else {
        narrativeResult = `You keep it in mind: ${b}.`;
      }
      break;
    }
    case "debunk": {
      narrativeResult = "You cross it off your list. Not every rumor is true.";
      break;
    }
    case "climax": {
      if (choiceId === "leave") {
        narrativeResult = "You mark the place on your map. It will keep.";
        await mark(row.targetHexQ, row.targetHexR, outcome.title, "Where the trail ended. Unfinished business.");
        break;
      }
      const opt = t.climax.options.find((o) => o.id === choiceId);
      if (!opt) { narrativeResult = outcome.reveal; break; }
      let won = false;
      if (opt.fight && ctx.flags.exploreCombat) {
        // A real fight: the payoff comes only if you win it (completeThreadFight).
        combatTriggered = true;
        combatSeed = { ...t.combatSeed };
        pendingCombat = { seed: combatSeed, threadId: row.id, source: "thread" };
        narrativeResult = "It comes to a fight.";
      } else if (opt.fight) {
        won = true;
        combatTriggered = true;
        combatSeed = { ...t.combatSeed };
        if (travel) {
          travel.exhaustion = Math.min(6, travel.exhaustion + 1);
          rolls.push("The fight costs you a level of exhaustion.");
        }
        narrativeResult = fill(opt.success, { name: row.payload?.name });
      } else {
        const r = roll(opt.skill!, opt.dc!);
        rolls.push(r.text);
        won = r.success;
        narrativeResult = fill(r.success ? opt.success : (opt.failure ?? "It doesn't work."), { name: row.payload?.name });
        if (!r.success) {
          fatigueChange = 2;
          await updateThread(row.id, { payload: { ...(row.payload ?? {}), failedAttempts: (row.payload?.failedAttempts ?? 0) + 1 } });
          narrativeResult += " You can try again, or another way.";
        }
      }
      if (won) {
        const applied = await applyPayoff(userId, run, ctx, t, row, travel);
        narrativeResult += ` ${applied.text}`;
        rewards = applied.rewards;
        payoff = applied.payoff;
        markerCreated = true;
      }
      break;
    }
  }

  const nextFlags = { ...runFlagsOf(run), ...(travel ? { travel } : {}), ...(pendingCombat ? { pendingCombat } : {}) };
  if (travel) {
    const collapsed = travel.exhaustion >= EXHAUSTION_RUN_ENDS;
    await saveExhaustion(run.characterId, exhaustionStart, collapsed ? COLLAPSE_RECOVERS_TO : travel.exhaustion);
  }
  await storage.updateWanderRun(run.id, { fatigue: Math.max(0, run.fatigue + fatigueChange), flags: nextFlags as any });

  return {
    resolution: { narrativeResult, rewards, fatigueChange, dangerChange: 0, combatTriggered, combatSeed, rolls, payoff },
    markerCreated,
    combatTriggered,
    combatSeed,
    skirmishReady: !!pendingCombat,
    travel,
    journal: await journalFor(userId, run.campaignId, ctx.flags, run.currentHexQ, run.currentHexR),
    collapse: !!travel && travel.exhaustion >= EXHAUSTION_RUN_ENDS,
  };
}

async function applyPayoff(userId: number, run: WanderRun, ctx: Ctx, t: ThreadTemplate, row: ThreadRow, travel: TravelState | null) {
  const name = row.payload?.name;
  const p = t.payoff;
  let rewards: Array<{ kind: string; name: string; quantity: number }> = [];
  let payoff: { kind: string; dungeonId?: number; name?: string } = { kind: p.kind };
  let linkedDungeonId: number | undefined;

  if (p.kind === "delve") {
    const dungeonName = fill(p.dungeonName, { name });
    try {
      const nodes = generateProceduralDungeon("goblin");
      const def = await storage.createDungeonDefinition({
        name: dungeonName,
        description: `Found by following a trail in the wilds. ${fill(t.climax.reveal, { name })}`,
        themeTags: p.themeTags,
        recommendedLevelMin: 1,
        recommendedLevelMax: 3,
        mapWidth: 9,
        mapHeight: 9,
        mapLayout: nodes.map((n) => ({ q: n.q, r: n.r, nodeId: n.nodeId })),
        nodeTable: nodes,
        rewardProfile: null,
        completionHooks: null,
        createdAt: new Date().toISOString(),
      } as any);
      linkedDungeonId = def.id;
      payoff = { kind: "delve", dungeonId: def.id, name: dungeonName };
    } catch (err) {
      console.warn("[wander] could not create thread dungeon:", (err as Error)?.message);
    }
  } else {
    rewards = p.rewards.map((r) => ({ ...r }));
    if (travel) {
      if (p.food) travel.food += p.food;
      if (p.water) travel.water += p.water;
    }
    if (p.kind === "npc") {
      payoff = { kind: "npc", name: p.npc.name };
      if (ctx.flags.ledger) {
        const ledger = await loadLedger(run.campaignId, ctx.campaign as any);
        const merged = mergeLedgerUpdates(ledger, { cast: [{ name: p.npc.name, role: p.npc.role, want: p.npc.want, attitudeChange: 2, location: "the wilds" }] }, { location: "the wilds" });
        await saveLedger(run.campaignId, merged.ledger);
      }
    }
  }

  await storage.createWanderMarker({
    campaignId: run.campaignId, hexQ: row.targetHexQ, hexR: row.targetHexR, markerType: p.kind === "delve" ? "opportunity" : t.markerType,
    title: p.kind === "delve" ? fill(p.dungeonName, { name }) : fill(t.climax.title, { name }),
    blurb: fill(p.text, { name }), tags: ["thread", t.id, "resolved"], discoveredBy: userId, persistence: "permanent",
    linkedDungeonId: linkedDungeonId ?? null, createdAt: new Date().toISOString(),
  } as any);
  await updateThread(row.id, { status: "resolved", beat: 4, payload: row.payload ?? {} });
  let text = fill(p.text, { name });
  if (ctx.flags.sharedRealm && !t.personal) {
    await addRealmMark({ q: row.targetHexQ, r: row.targetHexR, kind: "cleared", text: `Found ${p.kind === "delve" ? fill(p.dungeonName, { name }) : fill(t.climax.title, { name })}`, characterName: String((ctx.char as any).name ?? "An adventurer"), userId });
  }
  if (t.personal && row.payload?.characterId) {
    // PHB: Inspiration is the DM's reward for playing your character's bonds and history.
    await storage.updateCharacter(row.payload.characterId, { inspiration: true } as any);
    text += " You gain Inspiration.";
  }
  await postCompletionRumor(run.campaignId, fill(t.completionRumor, { bearing: bearing(0, 0, row.targetHexQ, row.targetHexR), name }));

  return { text, rewards, payoff };
}

async function chooseRecurring(userId: number, run: WanderRun, ctx: Ctx, outcome: CuratedOutcome, choiceId: string, rng: Rng) {
  const info = outcome.recurring!;
  const role = getRecurring(info.roleId);
  const travel = ctx.flags.wanderTravel ? travelFor(run, (ctx.char as any).exhaustionLevel) : null;
  const rolls: string[] = [];
  let narrativeResult = "";
  let attitudeChange = 0;
  let rewards: Array<{ kind: string; name: string; quantity: number }> = [];
  let rumorAdded = false;
  if (!role) return { resolution: { narrativeResult: "They move on.", rewards, fatigueChange: 0, dangerChange: 0, combatTriggered: false, rolls }, markerCreated: false, combatTriggered: false };

  const giveGift = async () => {
    const g = role.gift;
    narrativeResult += ` ${g.text}`;
    if (travel) {
      if (g.food) travel.food += g.food;
      if (g.water) travel.water += g.water;
    }
    if (g.reward) rewards = [g.reward];
    if (role.givesRumor && rumorsOn(ctx.flags)) {
      const open = await listThreads(userId, run.campaignId);
      if (open.filter((t) => t.status === "rumored").length < MAX_RUMORS) {
        const rumor = makeRumor(open, rng);
        if (rumor) {
          const row = await createThread({ ...rumor, campaignId: run.campaignId, userId });
          if (row) {
            rumorAdded = true;
            narrativeResult += ` "${row.payload?.rumorText}"`;
          }
        }
      }
    }
  };

  if (choiceId === "help") {
    const r = rollSkill(ctx.char, role.help.skill, role.help.dc, { exhaustion: travel?.exhaustion ?? 0 });
    rolls.push(r.text);
    narrativeResult = r.success ? role.help.success : role.help.failure;
    if (r.success) {
      attitudeChange = 1;
      await giveGift();
    }
  } else if (choiceId === "visit") {
    narrativeResult = `You stop and trade news with ${role.name}.`;
    await giveGift();
  } else {
    narrativeResult = `You nod to ${role.name} and keep walking.`;
    if (!info.metBefore || info.attitude < 1) attitudeChange = info.metBefore ? 0 : -1;
  }

  if (ctx.flags.ledger) {
    const ledger = await loadLedger(run.campaignId, ctx.campaign as any);
    const merged = mergeLedgerUpdates(ledger, { cast: [{ name: role.name, role: role.role, want: role.want, attitudeChange, location: "the road" }] }, { location: "the road" });
    await saveLedger(run.campaignId, merged.ledger);
  }
  if (travel) await storage.updateWanderRun(run.id, { flags: { ...runFlagsOf(run), travel } as any });

  return {
    resolution: { narrativeResult: narrativeResult.trim(), rewards, fatigueChange: 0, dangerChange: 0, combatTriggered: false, rolls },
    markerCreated: false,
    combatTriggered: false,
    travel,
    journal: rumorAdded ? await journalFor(userId, run.campaignId, ctx.flags, run.currentHexQ, run.currentHexR) : undefined,
  };
}

/** A thread climax fight was won (server/play/skirmish): apply the payoff. */
export async function completeThreadFight(userId: number, run: WanderRun, threadId: number) {
  const fresh = (await storage.getWanderRun(run.id)) ?? run;
  const ctx = await loadContext(fresh);
  const row = await getThread(threadId);
  const t = row ? getTemplate(row.templateId) : undefined;
  if (!row || !t || row.userId !== userId || row.status !== "active") return null;
  const travel = ctx.flags.wanderTravel ? travelFor(fresh, (ctx.char as any).exhaustionLevel) : null;
  const applied = await applyPayoff(userId, fresh, ctx, t, row, travel);
  if (travel) await storage.updateWanderRun(fresh.id, { flags: { ...runFlagsOf(fresh), travel } as any });
  return { text: applied.text, rewards: applied.rewards, ...applied.payoff };
}

// ── rests ─────────────────────────────────────────────────────────────────────

/**
 * A long rest's effect on the character (PHB): all hit points back, half your
 * Hit Dice (minimum one), class features and spell slots recharged.
 */
async function longRestCharacter(characterId: number): Promise<string[]> {
  const c: any = await storage.getCharacter(characterId);
  if (!c) return [];
  const notes: string[] = [];
  const level = c.level || 1;
  const scores = { strength: c.strength, dexterity: c.dexterity, constitution: c.constitution, intelligence: c.intelligence, wisdom: c.wisdom, charisma: c.charisma };
  const features = rechargeFeatures(c.class, level, c.subclass, scores as any, parseFeatureState(c.features), "long");
  const hitDice = hitDiceAfterLongRest(level, c.hitDiceRemaining);
  if (c.hitPoints < c.maxHitPoints) notes.push(`You wake at full health (${c.maxHitPoints} HP).`);
  await storage.updateCharacter(characterId, { hitPoints: c.maxHitPoints, features, hitDiceRemaining: hitDice } as any);
  try { await storage.resetSpellSlots(characterId); } catch { /* no slots */ }
  return notes;
}

/**
 * Short rest (1 hour): spend Hit Dice to heal (each die heals its roll + Con
 * modifier), and recharge short-rest features.
 */
export async function wanderShortRest(userId: number, run: WanderRun, hitDice: number) {
  const { char, flags } = await loadContext(run);
  const c: any = await storage.getCharacter(run.characterId);
  if (!c) return { error: "Character not found" as const };
  const level = c.level || 1;
  const def = getClassDef(c.class);
  const die = def?.hitDie ?? 8;
  const remaining = typeof c.hitDiceRemaining === "number" ? c.hitDiceRemaining : level;
  // Spending Hit Dice at full health would waste them.
  const wanted = c.hitPoints >= c.maxHitPoints ? 0 : Math.max(0, Math.min(hitDice, remaining));
  const spend = spendHitDice(die, c.constitution, remaining, wanted);
  const healed = Math.min(c.maxHitPoints - c.hitPoints, spend.healed);
  const scores = { strength: c.strength, dexterity: c.dexterity, constitution: c.constitution, intelligence: c.intelligence, wisdom: c.wisdom, charisma: c.charisma };
  const features = rechargeFeatures(c.class, level, c.subclass, scores as any, parseFeatureState(c.features), "short");
  await storage.updateCharacter(c.id, { hitPoints: c.hitPoints + healed, hitDiceRemaining: remaining - spend.spent, features } as any);
  const notes: string[] = [];
  if (spend.spent) notes.push(`You spend ${spend.spent} Hit ${spend.spent === 1 ? "Die" : "Dice"} (d${die}): ${spend.rolls.join(" + ")} ${spend.conMod >= 0 ? "+" : "−"} ${Math.abs(spend.conMod)} Con each = ${spend.healed}, regaining ${healed} HP. ${remaining - spend.spent} left.`);
  else notes.push(c.hitPoints >= c.maxHitPoints ? "You're at full health, so you keep your Hit Dice." : remaining ? "You rest without spending Hit Dice." : "You have no Hit Dice left; a long rest restores half of them.");
  notes.push("Short-rest features (Second Wind, Action Surge, Ki, and the like) recharge.");
  let travel: TravelState | null = null;
  if (flags.wanderTravel) {
    travel = travelFor(run, (char as any).exhaustionLevel);
    travel.hour += 1;
    await storage.updateWanderRun(run.id, { flags: { ...runFlagsOf(run), travel } as any });
  }
  return { notes, travel, hp: c.hitPoints + healed, maxHp: c.maxHitPoints, hitDiceRemaining: remaining - spend.spent, screenNote: "rest_pressure" };
}

// ── camp ──────────────────────────────────────────────────────────────────────

export async function wanderCamp(userId: number, run: WanderRun, rng: Rng = Math.random) {
  const { char, flags } = await loadContext(run);
  if (!flags.wanderTravel) return { error: "Travel rules are off for this campaign." as const };
  const travel = travelFor(run, (char as any).exhaustionLevel);
  const before = travel.exhaustion;
  const rolls: string[] = [];
  const result = endOfDay(travel, {
    conMod: getAbilityModifier(Number(char.constitution) || 10),
    biome: biomeForHex(run.currentHexQ, run.currentHexR),
    rng,
    conSave: (dc) => {
      const s = rollSave(char, "constitution", dc, { exhaustion: travel.exhaustion });
      rolls.push(s.text);
      return s;
    },
  });
  const collapsed = result.state.exhaustion >= EXHAUSTION_RUN_ENDS;
  if (collapsed) result.notes.push("You don't wake up on your own. A passing patrol carries you back to town, where days of rest leave you at one level of exhaustion.");
  await saveExhaustion(run.characterId, before, collapsed ? COLLAPSE_RECOVERS_TO : result.state.exhaustion);
  // The long rest itself: needs some food and drink, as the PHB's exhaustion rule does.
  const fed = travel.food >= 1 || travel.water >= (travel.hot ? 1 : 0.5);
  if (fed) result.notes.push(...(await longRestCharacter(run.characterId)));
  else result.notes.push("Without food or water, the night's rest does you little good: no hit points, Hit Dice or features come back.");
  // World clocks: a night passes for every open trail.
  let news: string[] = [];
  const cflags = resolveFlags(await storage.getCampaign(run.campaignId));
  if (cflags.worldClocks && threadsOn(cflags)) {
    const open = await listThreads(userId, run.campaignId);
    const clocks = advanceClocks(open);
    for (const p of clocks.patches) await updateThread(p.id, { status: p.status, payload: p.payload });
    for (const n of clocks.news) await postCompletionRumor(run.campaignId, n.text);
    news = clocks.news.map((n) => n.text);
    if (news.length) result.notes.push(...news.map((n) => `News on the road: ${n}`));
  }
  const updated = await storage.updateWanderRun(run.id, { fatigue: 0, flags: { ...runFlagsOf(run), travel: result.state } as any });
  return {
    run: updated,
    travel: result.state,
    notes: result.notes,
    rolls,
    news,
    screenNote: news.length ? "doom_clock" : "rest_pressure",
    journal: await journalFor(userId, run.campaignId, cflags, run.currentHexQ, run.currentHexR),
    collapse: result.state.exhaustion >= EXHAUSTION_RUN_ENDS,
  };
}

// ── journal (resume) ──────────────────────────────────────────────────────────

export async function wanderJournal(userId: number, run: WanderRun) {
  const { char, flags } = await loadContext(run);
  const threads = threadsOn(flags) ? (await listThreads(userId, run.campaignId)).filter((t) => rumorsOn(flags) || t.status !== "rumored") : [];
  return {
    flags: {
      travel: flags.wanderTravel, threads: flags.wanderThreads, landmarks: flags.wanderLandmarks,
      rumors: rumorsOn(flags), checks: flags.wanderChecks,
    },
    travel: flags.wanderTravel ? travelFor(run, (char as any).exhaustionLevel) : null,
    landmarks: flags.wanderLandmarks ? landmarksFromKeys(runFlagsOf(run).landmarks).concat(threadLandmarks(threads)) : [],
    journal: threads.map((t) => journalEntry(t, run.currentHexQ, run.currentHexR)),
    realmMarks: flags.sharedRealm ? await realmMarksNear(run.currentHexQ, run.currentHexR, 3, userId) : [],
  };
}

// ── shared realm ──────────────────────────────────────────────────────────────

export async function leaveRealmSign(userId: number, run: WanderRun, phrase: string) {
  const { char, flags } = await loadContext(run);
  if (!flags.sharedRealm) return { error: "The shared realm is off for this campaign." as const };
  if (!(REALM_PHRASES as readonly string[]).includes(phrase)) return { error: "Pick one of the listed signs." as const };
  const mark = await addRealmMark({ q: run.currentHexQ, r: run.currentHexR, kind: "sign", text: phrase, characterName: String((char as any).name ?? "An adventurer"), userId });
  return { mark, realmMarks: await realmMarksNear(run.currentHexQ, run.currentHexR, 2, userId) };
}

export async function nodRealm(userId: number, markId: number) {
  return { mark: await nodRealmMark(markId, userId) };
}

/** A fight in the wilds was lost: a cairn marks the spot for others. */
export async function markFallen(userId: number, run: WanderRun, characterName: string, foes: string) {
  const campaign = await storage.getCampaign(run.campaignId);
  if (!resolveFlags(campaign).sharedRealm) return;
  await addRealmMark({ q: run.currentHexQ, r: run.currentHexR, kind: "fallen", text: `${characterName} was beaten here by ${foes}`, characterName, userId });
}

// ── Tavern road rumors ────────────────────────────────────────────────────────

export async function roadRumors(userId: number, hear: boolean, rng: Rng = Math.random) {
  const campaignId = await latestWanderCampaign(userId);
  if (!campaignId) return { campaignId: null, campaignTitle: null, rumors: [], message: "Go out wandering once and the regulars will have road news for you." };
  const campaign = await storage.getCampaign(campaignId);
  const flags = resolveFlags(campaign);
  if (!rumorsOn(flags)) return { campaignId, campaignTitle: (campaign as any)?.title ?? null, rumors: [], message: "Road rumors are off for this campaign." };
  let open = await listThreads(userId, campaignId);
  let message: string | undefined;
  if (hear) {
    if (open.filter((t) => t.status === "rumored").length >= MAX_RUMORS) {
      message = "You've heard all the road news there is for now. Go and see if any of it is true.";
    } else {
      const rumor = makeRumor(open, rng);
      if (rumor) {
        const row = await createThread({ ...rumor, campaignId, userId });
        if (row) open = [row, ...open];
        else message = "Nobody has any road news right now.";
      } else {
        message = "Nobody has any road news you haven't already chased.";
      }
    }
  }
  return {
    campaignId,
    campaignTitle: (campaign as any)?.title ?? null,
    rumors: open.filter((t) => t.status === "rumored").map((t) => journalEntry(t, 0, 0)),
    message,
  };
}

