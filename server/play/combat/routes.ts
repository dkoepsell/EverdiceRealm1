/**
 * Managed combat with the 5e action economy (engagement spec Phase 4.3).
 *
 *   GET  /api/campaigns/:campaignId/combat-action/options
 *        → what this character can do: attacks per action, bonus actions with
 *          uses left, Action Surge, Divine Smite slots, Reckless Attack,
 *          whether Sneak Attack currently applies.
 *   POST /api/campaigns/:campaignId/combat-action
 *        body: { action, bonus?, targetName?, reckless?, smiteSlot?, actionSurge? }
 *        → resolves the turn on the server, spends resources, and returns a
 *          signed token the turn routes apply (damage once, via the normal path).
 */
import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import type { Character } from "@shared/schema";
import { resolveFlags } from "@shared/engagementFlags";
import { parseFeatureState } from "@shared/rules/leveling";
import {
  attacksPerAction, availableBonusActions, rageDamageBonus, sneakAttackDice, sneakAttackEligibility, weaponProfile,
} from "@shared/rules/classActions";
import { type ClassCombatState, resolveClassTurn } from "./classTurn";
import { signPayload, type ClassTurnPayload } from "../checks/rollToken";
import { recordRulesFired } from "../rules/rulesSeen";

const parseState = (raw: unknown): any => {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" ? raw : {};
};

async function load(req: Request, res: Response) {
  if (!req.isAuthenticated?.() || !req.user) { res.status(401).json({ message: "Not authenticated" }); return null; }
  const userId = (req.user as any).id as number;
  const campaignId = Number(req.params.campaignId);
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return null; }
  const flags = resolveFlags(campaign);
  if (!flags.classCombat) { res.status(409).json({ message: "Class combat isn't enabled for this campaign." }); return null; }
  const participants = await storage.getCampaignParticipants(campaignId);
  const mine = participants.filter((p: any) => p.userId === userId && p.characterId);
  const wanted = Number((req.body as any)?.characterId ?? req.query.characterId);
  const seat = mine.find((p: any) => p.characterId === wanted) ?? mine[0];
  if (!seat) { res.status(403).json({ message: "You don't have a character in this campaign." }); return null; }
  const character = await storage.getCharacter(seat.characterId!);
  if (!character) { res.status(404).json({ message: "Character not found" }); return null; }
  const session = await storage.getCurrentSession(campaignId);
  const storyState = parseState(session?.storyState);
  if (!storyState.inCombat) { res.status(409).json({ message: "You're not in a fight right now." }); return null; }
  const enemies = (Array.isArray(storyState.combatants) ? storyState.combatants : []).filter((e: any) => e?.type === "enemy" || e?.type === "boss");
  const npcs = await storage.getCampaignNpcs(campaignId);
  const allyEngaged =
    npcs.some((n) => (n.role === "companion" || n.role === "ally") && (n.status ?? "conscious") === "conscious") ||
    participants.some((p: any) => p.characterId && p.characterId !== character.id);
  const slots = await storage.getCharacterSpellSlots(character.id);
  return { userId, campaignId, character, session, storyState, enemies, allyEngaged, slots };
}

const slotFree = (slots: any, level: number) => !!slots && (slots[`slotsLevel${level}Max`] ?? 0) > (slots[`slotsLevel${level}Used`] ?? 0);

export function registerCombatRoutes(app: Express) {
  app.get("/api/campaigns/:campaignId/combat-action/options", async (req, res) => {
    try {
      const ctx = await load(req, res);
      if (!ctx) return;
      const c = ctx.character;
      const features = parseFeatureState(c.features);
      const ids = features.map((f) => f.id);
      const weapon = weaponProfile(c.equippedWeapon);
      const combat: ClassCombatState = ctx.storyState.classCombat ?? {};
      const sneak = sneakAttackEligibility({ className: c.class, weapon, advantage: !!combat.hidden, disadvantage: false, allyAdjacent: ctx.allyEngaged, usedThisTurn: false });
      res.json({
        weapon,
        attacksPerAction: attacksPerAction(c.class, c.level || 1),
        bonusActions: availableBonusActions(c.class, ids).map((b) => ({ id: b, usesLeft: features.find((f) => f.id === ({ second_wind: "second_wind", rage: "rage", flurry_of_blows: "ki", patient_defense: "ki", step_of_the_wind: "ki", bardic_inspiration: "bardic_inspiration" } as any)[b])?.usesRemaining ?? null })),
        actionSurge: ids.includes("action_surge") ? features.find((f) => f.id === "action_surge")?.usesRemaining ?? 0 : null,
        recklessAttack: ids.includes("reckless_attack"),
        smiteSlots: ids.includes("divine_smite") ? [1, 2, 3, 4, 5].filter((l) => slotFree(ctx.slots, l)) : [],
        sneakAttack: c.class.toLowerCase() === "rogue" ? { dice: sneakAttackDice(c.level || 1), ...sneak } : null,
        raging: (combat.rageRoundsLeft ?? 0) > 0 ? { roundsLeft: combat.rageRoundsLeft, damageBonus: rageDamageBonus(c.level || 1) } : null,
        hidden: !!combat.hidden,
        enemies: ctx.enemies.map((e: any) => ({ name: e.name, ac: e.ac, currentHp: e.currentHp, maxHp: e.maxHp, status: e.status, zone: e.zone ?? "engaged" })),
        encounter: ctx.storyState.encounter ?? null,
      });
    } catch (err) {
      console.error("[combat-action] options failed:", err);
      res.status(500).json({ message: "Failed to load combat options" });
    }
  });

  app.post("/api/campaigns/:campaignId/combat-action", async (req, res) => {
    try {
      const ctx = await load(req, res);
      if (!ctx) return;
      const c = ctx.character;
      const body = req.body ?? {};
      const features = parseFeatureState(c.features);
      const r = resolveClassTurn(
        {
          action: ["attack", "dash", "disengage", "dodge", "help", "hide", "shove"].includes(body.action) ? body.action : "attack",
          bonus: typeof body.bonus === "string" ? body.bonus : null,
          targetName: typeof body.targetName === "string" ? body.targetName : null,
          reckless: !!body.reckless,
          smiteSlot: Number.isInteger(body.smiteSlot) ? body.smiteSlot : null,
          actionSurge: !!body.actionSurge,
        },
        {
          character: { ...c, level: c.level || 1 } as any,
          features,
          combat: ctx.storyState.classCombat ?? {},
          enemies: ctx.enemies,
          allyEngaged: ctx.allyEngaged,
          spellSlotsAvailable: (l) => slotFree(ctx.slots, l),
          d: (n) => 1 + Math.floor(Math.random() * n),
        },
      );
      if (!r.ok) return res.status(400).json({ message: r.error });

      // Spend resources and heal now; damage to enemies is applied by the turn route from the token.
      const nextFeatures = features.map((f) =>
        r.featureUses[f.id] && typeof f.usesRemaining === "number" ? { ...f, usesRemaining: Math.max(0, f.usesRemaining - r.featureUses[f.id]) } : f,
      );
      await storage.updateCharacter(c.id, {
        features: nextFeatures,
        ...(r.healed ? { hitPoints: Math.min(c.maxHitPoints, c.hitPoints + r.healed) } : {}),
      } as Partial<Character>);
      if (r.spellSlotUsed) await storage.useSpellSlot(c.id, r.spellSlotUsed);
      if (ctx.session) {
        await storage.updateSessionStoryState(ctx.campaignId, ctx.session.sessionNumber, { ...ctx.storyState, classCombat: r.combat });
      }
      const payload: ClassTurnPayload = {
        kind: "class_turn",
        campaignId: ctx.campaignId,
        userId: ctx.userId,
        characterId: c.id,
        issuedAt: Date.now(),
        action: body.action === "attack" ? weaponProfile(c.equippedWeapon).name : String(body.action ?? "attack"),
        targetName: r.targetName,
        hit: r.hit,
        attackRoll: r.attackRoll,
        damageTotal: r.damageTotal,
        damageType: r.damageType,
        summary: r.summary,
        breakdown: r.breakdown,
      };
      const flags = resolveFlags(await storage.getCampaign(ctx.campaignId));
      const rules = flags.rulesUnderneath ? await recordRulesFired(ctx.userId, r.rulesFired.map((id) => ({ id }))) : [];
      res.json({ ...r, token: signPayload(payload), rulesFired: rules });
    } catch (err) {
      console.error("[combat-action] failed:", err);
      res.status(500).json({ message: "Failed to resolve your turn" });
    }
  });
}
