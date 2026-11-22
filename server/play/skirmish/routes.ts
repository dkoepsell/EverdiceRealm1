/**
 * Exploration combat endpoints (Wander and Delve).
 *
 *   POST /api/skirmish/start  { mode, runId }   start the fight the run is waiting on
 *   GET  /api/skirmish/:mode/:runId             current fight, with turn options
 *   POST /api/skirmish/turn   { mode, runId, ...PlayerTurn }
 *
 * The server decides what you're fighting: for Wander, the combat the last
 * choice triggered (run.flags.pendingCombat); for Delve, the encounter or boss
 * in the room you're standing in. Fight state lives in the run's `flags`.
 */
import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { resolveFlags } from "@shared/engagementFlags";
import { parseFeatureState } from "@shared/rules/leveling";
import { availableBonusActions, attacksPerAction, weaponProfile } from "@shared/rules/classActions";
import { buildEncounter, rateEncounter, adjustedXp, xpForCr, MONSTERS, type MonsterStats, type MonsterTrait } from "@shared/rules/monsters";
import { playerTurn, startSkirmish, turnOptions, type PlayerTurn, type SkirmishCharacter, type SkirmishState, type Surprise } from "./engine";
import { completeThreadFight, markFallen } from "../wander/service";

type Mode = "wander" | "delve";

interface Loaded {
  mode: Mode;
  userId: number;
  run: any;
  flags: Record<string, unknown>;
  campaign: any;
  character: any;
  save: (patch: { skirmish?: SkirmishState | null; pendingCombat?: unknown }) => Promise<void>;
}

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as any) } : {});

async function load(req: Request, res: Response, mode: Mode, runId: number): Promise<Loaded | null> {
  if (!req.isAuthenticated?.() || !req.user) { res.status(401).json({ error: "Authentication required" }); return null; }
  const userId = (req.user as any).id as number;
  const run: any = mode === "wander" ? await storage.getWanderRun(runId) : await storage.getDungeonRun(runId);
  if (!run) { res.status(404).json({ error: "Run not found" }); return null; }
  if (run.userId !== userId) { res.status(403).json({ error: "Not your run" }); return null; }
  const campaign = await storage.getCampaign(run.campaignId);
  if (!resolveFlags(campaign).exploreCombat) { res.status(409).json({ error: "Exploration combat is off for this campaign." }); return null; }
  const character = await storage.getCharacter(run.characterId);
  if (!character) { res.status(404).json({ error: "Character not found" }); return null; }
  const flags = asObj(run.flags);
  const save = async (patch: { skirmish?: SkirmishState | null; pendingCombat?: unknown }) => {
    const next = { ...flags, ...patch };
    if (patch.skirmish === null) delete next.skirmish;
    if (patch.pendingCombat === null) delete next.pendingCombat;
    if (mode === "wander") await storage.updateWanderRun(run.id, { flags: next as any });
    else await storage.updateDungeonRun(run.id, { flags: next as any });
    Object.assign(flags, patch);
  };
  return { mode, userId, run, flags, campaign, character, save };
}

function asCharacter(c: any): SkirmishCharacter {
  return { ...c, level: c.level || 1, armorClass: c.armorClass || 10 } as SkirmishCharacter;
}

async function knownSpellNames(characterId: number): Promise<string[]> {
  try {
    const rows = await storage.getCharacterSpells(characterId);
    return rows.map((r: any) => String(r.spell?.name ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

const slotsFreeFn = (slots: any) => (level: number) => !!slots && (slots[`slotsLevel${level}Max`] ?? 0) > (slots[`slotsLevel${level}Used`] ?? 0);

/** Turn options for the UI. */
async function options(L: Loaded, s: SkirmishState) {
  const c = L.character;
  const features = parseFeatureState(c.features);
  const ids = features.map((f) => f.id);
  const slots = await storage.getCharacterSpellSlots(c.id);
  const free = slotsFreeFn(slots);
  return {
    weapon: weaponProfile(c.equippedWeapon).name,
    attacksPerAction: attacksPerAction(c.class, c.level || 1),
    bonusActions: availableBonusActions(c.class, ids).filter((b) => b !== "bardic_inspiration" && b !== "offhand_attack"),
    actionSurge: ids.includes("action_surge") ? features.find((f) => f.id === "action_surge")?.usesRemaining ?? 0 : null,
    recklessAttack: ids.includes("reckless_attack"),
    smiteSlots: ids.includes("divine_smite") ? [1, 2, 3, 4, 5].filter(free) : [],
    slots: [1, 2, 3, 4, 5].filter(free),
    ...turnOptions(asCharacter(c), await knownSpellNames(c.id)),
    raging: (s.classCombat.rageRoundsLeft ?? 0) > 0,
    hidden: !!s.classCombat.hidden,
  };
}

// ── building the enemies ──────────────────────────────────────────────────────

/** Delve stat blocks carry name/hp/ac/attackBonus/damage/abilities; turn them into monster stats. */
function fromDelveBlock(b: any, boss: boolean): MonsterStats {
  const abilities: string[] = Array.isArray(b.abilities) ? b.abilities.map(String) : [];
  const traits: MonsterTrait[] = [];
  if (abilities.some((a) => /pack tactics/i.test(a))) traits.push("pack_tactics");
  if (abilities.some((a) => /nimble escape/i.test(a))) traits.push("nimble_escape");
  if (boss || /skeleton|zombie|ghoul|wight|fungus|myconid/i.test(b.name ?? "")) traits.push("fearless");
  const multi = abilities.map((a) => a.match(/multiattack\s*\((\d+)/i)).find(Boolean);
  const n = multi ? parseInt(multi[1]) : 1;
  const srd = Object.values(MONSTERS).find((m) => m.name.toLowerCase() === String(b.name ?? "").toLowerCase());
  const dmgType = /bite|fang|spider|wolf/i.test(b.name ?? "") ? "piercing" : /club|slam|fist|fungus|crush/i.test(b.name ?? "") ? "bludgeoning" : "slashing";
  const attack = { name: "Attack", bonus: Number(b.attackBonus) || 3, damage: String(b.damage || "1d6+1"), damageType: dmgType };
  return {
    key: srd?.key ?? String(b.name ?? "foe").toLowerCase().replace(/\W+/g, "_"),
    name: String(b.name ?? "Foe"),
    cr: Number(b.cr) || 0.25,
    xp: Number(b.xpReward) && boss ? Number(b.xpReward) : xpForCr(Number(b.cr) || 0.25),
    ac: Number(b.ac) || 12,
    hp: Number(b.hp) || 10,
    dexMod: srd?.dexMod ?? 1,
    speed: srd?.speed ?? 30,
    passive: srd?.passive ?? 10,
    attacks: Array.from({ length: n }, () => ({ ...attack })),
    traits,
    creatureType: srd?.creatureType ?? (/skeleton|zombie|ghoul/i.test(b.name ?? "") ? "undead" : "humanoid"),
  };
}

async function buildFight(L: Loaded): Promise<{ state: SkirmishState } | { error: string; status: number }> {
  const c = asCharacter(L.character);
  if (L.mode === "wander") {
    const p = asObj(L.flags.pendingCombat);
    const seed = asObj(p.seed);
    if (!Object.keys(seed).length) return { error: "There's no fight waiting here.", status: 409 };
    const difficulty = (["easy", "medium", "hard"].includes(String(seed.difficulty)) ? seed.difficulty : "medium") as "easy" | "medium" | "hard";
    const enc = buildEncounter(String(seed.enemyTheme ?? "bandit"), c.level, difficulty);
    const surprise: Surprise = seed.surprise === "party_surprised" || seed.surprise === "enemy_surprised" ? seed.surprise : "none";
    const state = startSkirmish({
      mode: "wander",
      ref: { source: String(p.source ?? "wander"), threadId: typeof p.threadId === "number" ? p.threadId : undefined },
      character: c, monsters: enc.monsters, surprise, encounterNote: enc.note, rating: enc.rating,
    });
    return { state };
  }
  // Delve: the room you're in
  const run = L.run;
  const def = await storage.getDungeonDefinition(run.dungeonId);
  const nodes: any[] = Array.isArray(def?.nodeTable) ? (def!.nodeTable as any[]) : [];
  const node = nodes.find((n) => n.q === run.currentQ && n.r === run.currentR);
  if (!node || (node.type !== "encounter" && node.type !== "boss")) return { error: "There's no fight in this room.", status: 409 };
  if (((run.clearedNodes as string[]) || []).includes(node.nodeId)) return { error: "This room is already cleared.", status: 409 };
  const states = await storage.getDungeonNodeStates(run.id);
  const prior = states.find((st: any) => st.nodeId === node.nodeId);
  if (!(prior?.resolutionPayload as any)?.combatTriggered) return { error: "You haven't started a fight here.", status: 409 };
  const monsters = node.type === "boss" && node.bossData
    ? [fromDelveBlock(node.bossData, true)]
    : (node.encounterData?.enemies ?? []).map((e: any) => fromDelveBlock(e, false));
  if (!monsters.length) return { error: "Nothing here to fight.", status: 409 };
  const adj = adjustedXp(monsters);
  const rating = rateEncounter(adj, c.level);
  const raw = monsters.reduce((s: number, m: MonsterStats) => s + m.xp, 0);
  const note = `${monsters.map((m: MonsterStats) => m.name).join(", ")}: ${raw} XP, ${adj} adjusted. ${/^[aeiou]/.test(rating) ? "An" : "A"} ${rating} fight for a level ${c.level} character on their own.`;
  const state = startSkirmish({ mode: "delve", ref: { source: node.type, nodeId: node.nodeId }, character: c, monsters, encounterNote: note, rating });
  return { state };
}

// ── finishing ─────────────────────────────────────────────────────────────────

async function finish(L: Loaded, s: SkirmishState): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const c = L.character;
  if (s.status === "won" && s.xpEarned > 0) {
    const flags = resolveFlags(L.campaign);
    await storage.awardXPToCharacter(c.id, s.xpEarned, { levelUpsFlag: !!flags.levelUps, mode: (L.campaign as any)?.levelingMode ?? "xp" });
    out.xpAwarded = s.xpEarned;
  }
  if (s.status === "lost") {
    // Knocked out, not killed: stable at 0, back to 1 HP after 1d4 hours (PHB).
    await storage.updateCharacter(c.id, { hitPoints: 1 } as any);
    if (L.mode === "wander") {
      const foes = Array.from(new Set(s.enemies.map((e) => e.name.replace(/ [A-Z]$/, "")))).join(" and ").toLowerCase();
      await markFallen(L.userId, L.run, c.name, foes);
    }
  }
  if (L.mode === "wander" && s.status === "won" && s.ref.threadId) {
    out.payoff = await completeThreadFight(L.userId, L.run, s.ref.threadId);
  }
  if (L.mode === "delve" && s.status === "won" && s.ref.nodeId) {
    const run = L.run;
    const clearedNodes = [...((run.clearedNodes as string[]) || [])];
    if (!clearedNodes.includes(s.ref.nodeId)) clearedNodes.push(s.ref.nodeId);
    const victory = {
      success: true,
      narrative: s.ref.source === "boss" ? "Your foe falls silent. The way to the hoard lies open." : "The last foe falls. The room is yours.",
      nodeCleared: true,
      combatTriggered: false,
      skirmishWon: true,
    };
    out.run = await storage.updateDungeonRun(run.id, { clearedNodes });
    await storage.upsertDungeonNodeState(run.id, s.ref.nodeId, { state: "cleared", resolutionPayload: victory, lastResolvedAt: new Date().toISOString() });
    out.resolution = victory;
  }
  return out;
}

function parseMode(v: unknown): Mode | null {
  return v === "wander" || v === "delve" ? v : null;
}

export function registerSkirmishRoutes(app: Express) {
  app.post("/api/skirmish/start", async (req, res) => {
    try {
      const mode = parseMode(req.body?.mode);
      if (!mode) return res.status(400).json({ error: "mode must be wander or delve" });
      const L = await load(req, res, mode, Number(req.body?.runId));
      if (!L) return;
      const existing = L.flags.skirmish as SkirmishState | undefined;
      if (existing?.status === "active") return res.json({ state: existing, options: await options(L, existing) });
      const built = await buildFight(L);
      if ("error" in built) return res.status(built.status).json({ error: built.error });
      await L.save({ skirmish: built.state, pendingCombat: null });
      await storage.updateCharacter(L.character.id, { hitPoints: built.state.pc.hp } as any);
      const extra = built.state.status !== "active" ? await finish(L, built.state) : {};
      res.json({ state: built.state, options: await options(L, built.state), ...extra });
    } catch (err) {
      console.error("[skirmish] start failed:", err);
      res.status(500).json({ error: "Failed to start the fight" });
    }
  });

  app.get("/api/skirmish/:mode/:runId", async (req, res) => {
    try {
      const mode = parseMode(req.params.mode);
      if (!mode) return res.status(400).json({ error: "mode must be wander or delve" });
      const L = await load(req, res, mode, Number(req.params.runId));
      if (!L) return;
      const s = L.flags.skirmish as SkirmishState | undefined;
      res.json({ state: s ?? null, pending: !!L.flags.pendingCombat, options: s ? await options(L, s) : null });
    } catch (err) {
      console.error("[skirmish] get failed:", err);
      res.status(500).json({ error: "Failed to load the fight" });
    }
  });

  app.post("/api/skirmish/turn", async (req, res) => {
    try {
      const mode = parseMode(req.body?.mode);
      if (!mode) return res.status(400).json({ error: "mode must be wander or delve" });
      const L = await load(req, res, mode, Number(req.body?.runId));
      if (!L) return;
      const s = L.flags.skirmish as SkirmishState | undefined;
      if (!s || s.status !== "active") return res.status(409).json({ error: "You're not in a fight." });
      const b = req.body ?? {};
      const turn: PlayerTurn = {
        action: ["attack", "dash", "disengage", "dodge", "hide", "spell"].includes(b.action) ? b.action : "attack",
        bonus: typeof b.bonus === "string" ? b.bonus : null,
        targetId: typeof b.targetId === "string" ? b.targetId : null,
        spellId: typeof b.spellId === "string" ? b.spellId : null,
        slotLevel: Number.isInteger(b.slotLevel) ? b.slotLevel : null,
        bonusSpellId: typeof b.bonusSpellId === "string" ? b.bonusSpellId : null,
        bonusSlotLevel: Number.isInteger(b.bonusSlotLevel) ? b.bonusSlotLevel : null,
        reckless: !!b.reckless,
        actionSurge: !!b.actionSurge,
        smiteSlot: Number.isInteger(b.smiteSlot) ? b.smiteSlot : null,
        flee: !!b.flee,
      };
      const c = L.character;
      const features = parseFeatureState(c.features);
      const slots = await storage.getCharacterSpellSlots(c.id);
      const r = playerTurn(s, asCharacter(c), turn, { features, slotFree: slotsFreeFn(slots), knownSpells: await knownSpellNames(c.id) });
      if (r.error) return res.status(400).json({ error: r.error });

      // Persist what the turn spent: feature uses, spell slots, hit points.
      const nextFeatures = features.map((f) =>
        r.effects.featureUses[f.id] && typeof f.usesRemaining === "number" ? { ...f, usesRemaining: Math.max(0, f.usesRemaining - r.effects.featureUses[f.id]) } : f,
      );
      await storage.updateCharacter(c.id, { features: nextFeatures, hitPoints: r.state.pc.hp } as any);
      for (const lvl of r.effects.slotsUsed) await storage.useSpellSlot(c.id, lvl);
      L.character = { ...c, features: nextFeatures, hitPoints: r.state.pc.hp };

      await L.save({ skirmish: r.state });
      const extra = r.state.status !== "active" ? await finish(L, r.state) : {};
      res.json({ state: r.state, options: r.state.status === "active" ? await options(L, r.state) : null, ...extra });
    } catch (err) {
      console.error("[skirmish] turn failed:", err);
      res.status(500).json({ error: "Failed to resolve your turn" });
    }
  });
}
