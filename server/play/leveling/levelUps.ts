/**
 * Server side of level-ups (engagement spec Phase 1): recording earned levels
 * and applying the player's Level Up choices. The rules themselves are in
 * shared/rules/leveling.ts; this module only reads and writes the database.
 */
import { storage } from "../../storage";
import { getSpellSlotsByLevel } from "../../spellData";
import { logServerEvent } from "../../lib/activityLog";
import type { Character } from "@shared/schema";
import {
  type LevelUpChoices,
  type LevelUpPlan,
  type PendingLevelUp,
  applyLevelUp,
  earnLevel,
  parsePendingLevelUp,
  planLevelUp,
  validateLevelUpChoices,
} from "@shared/rules/leveling";

/**
 * A milestone (chapter gate or campaign completion) earns one level. Idempotent
 * per reason: the same gate reported twice does not grant two levels.
 */
export async function grantMilestoneLevel(characterId: number, reason: string): Promise<PendingLevelUp | null> {
  const character = await storage.getCharacter(characterId);
  if (!character) return null;
  const existing = parsePendingLevelUp(character.pendingLevelUp);
  const next = earnLevel(character.level || 1, existing, reason, { mode: "milestone" });
  if (next && JSON.stringify(next) !== JSON.stringify(existing)) {
    await storage.updateCharacter(characterId, { pendingLevelUp: next, updatedAt: new Date().toISOString() } as Partial<Character>);
  }
  return next;
}

export function levelUpPlanFor(character: Character): LevelUpPlan | null {
  const pending = parsePendingLevelUp(character.pendingLevelUp);
  if (!pending) return null;
  return planLevelUp(asLevelUpCharacter(character), pending);
}

function asLevelUpCharacter(c: Character) {
  return {
    class: c.class,
    level: c.level || 1,
    subclass: c.subclass,
    maxHitPoints: c.maxHitPoints,
    hitPoints: c.hitPoints,
    strength: c.strength,
    dexterity: c.dexterity,
    constitution: c.constitution,
    intelligence: c.intelligence,
    wisdom: c.wisdom,
    charisma: c.charisma,
    features: c.features,
    hitDiceRemaining: c.hitDiceRemaining,
  };
}

/** Recompute spell slot maxima for the new level (they were never updated on level-up before). */
async function refreshSpellSlotMaxima(characterId: number, className: string, level: number) {
  const slots = getSpellSlotsByLevel(className, level);
  if (!slots.some((n) => n > 0)) return;
  const existing = await storage.getCharacterSpellSlots(characterId);
  const update: Record<string, number> = {};
  slots.forEach((max, i) => {
    update[`slotsLevel${i + 1}Max`] = max;
  });
  if (existing) await storage.updateSpellSlots(characterId, update as any);
  else await storage.initializeSpellSlots(characterId, { characterId, ...update } as any);
}

export type CompleteLevelUpResult =
  | { ok: true; character: Character; plan: LevelUpPlan; hp: ReturnType<typeof applyLevelUp>["hp"]; newFeatureIds: string[]; morePending: boolean }
  | { ok: false; status: number; errors: string[] };

export async function completeLevelUp(
  character: Character,
  choices: LevelUpChoices,
  userId: number,
): Promise<CompleteLevelUpResult> {
  const pending = parsePendingLevelUp(character.pendingLevelUp);
  if (!pending) return { ok: false, status: 409, errors: ["No level-up is waiting for this character."] };
  const lc = asLevelUpCharacter(character);
  const plan = planLevelUp(lc, pending);
  if (!plan) {
    await storage.updateCharacter(character.id, { pendingLevelUp: null } as Partial<Character>);
    return { ok: false, status: 409, errors: ["This level-up is no longer valid."] };
  }
  const errors = validateLevelUpChoices(lc, plan, choices);
  if (errors.length) return { ok: false, status: 400, errors };

  const result = applyLevelUp(lc, plan, choices);
  const morePending = plan.remainingAfter > 0;
  const updated = await storage.updateCharacter(character.id, {
    ...result.updates,
    pendingLevelUp: morePending ? { ...pending, fromLevel: plan.toLevel } : null,
    updatedAt: new Date().toISOString(),
  } as Partial<Character>);
  await refreshSpellSlotMaxima(character.id, character.class, plan.toLevel);
  await logServerEvent(userId, "character_action", "progression", "level_up_completed", {
    characterId: character.id,
    from: plan.fromLevel,
    to: plan.toLevel,
    choicesMade: {
      hpMode: choices.hpMode,
      asi: choices.asi ?? null,
      subclass: plan.needsSubclass ? choices.subclass : null,
    },
    reason: pending.reason,
  }, { characterId: character.id });
  return { ok: true, character: updated ?? character, plan, hp: result.hp, newFeatureIds: result.newFeatureIds, morePending };
}
