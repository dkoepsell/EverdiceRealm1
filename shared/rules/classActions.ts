/**
 * Class signature actions and the action economy, as SRD 5.1 rules
 * (engagement spec Phase 4.3). Pure functions; the server's combat-action
 * resolver applies them and the client shows the same numbers.
 */
import { atLevel, getClassDef } from "./classProgression";
import { getAbilityModifier } from "./xp";

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

const FINESSE = ["dagger", "dart", "rapier", "scimitar", "shortsword", "short sword", "whip"];
const RANGED = ["bow", "crossbow", "sling", "dart", "blowgun", "javelin"];

export interface WeaponProfile {
  name: string;
  finesse: boolean;
  ranged: boolean;
  damageDice: string;
  damageType: string;
}

const DEFAULT_DICE: Record<string, [string, string]> = {
  dagger: ["1d4", "piercing"], shortsword: ["1d6", "piercing"], "short sword": ["1d6", "piercing"], rapier: ["1d8", "piercing"],
  scimitar: ["1d6", "slashing"], longsword: ["1d8", "slashing"], greatsword: ["2d6", "slashing"], greataxe: ["1d12", "slashing"],
  handaxe: ["1d6", "slashing"], battleaxe: ["1d8", "slashing"], mace: ["1d6", "bludgeoning"], warhammer: ["1d8", "bludgeoning"],
  quarterstaff: ["1d6", "bludgeoning"], club: ["1d4", "bludgeoning"], spear: ["1d6", "piercing"], javelin: ["1d6", "piercing"],
  shortbow: ["1d6", "piercing"], longbow: ["1d8", "piercing"], "light crossbow": ["1d8", "piercing"], "hand crossbow": ["1d6", "piercing"],
  sling: ["1d4", "bludgeoning"], dart: ["1d4", "piercing"], whip: ["1d4", "slashing"], maul: ["2d6", "bludgeoning"],
};

export function weaponProfile(rawName: string | null | undefined, stats?: { damageDice?: string; damageType?: string; properties?: string[] } | null): WeaponProfile {
  const name = (rawName || "Unarmed").trim();
  const lower = name.toLowerCase();
  const key = Object.keys(DEFAULT_DICE).sort((a, b) => b.length - a.length).find((k) => lower.includes(k));
  const [dice, type] = key ? DEFAULT_DICE[key] : lower === "unarmed" ? ["1", "bludgeoning"] : ["1d6", "slashing"];
  return {
    name,
    finesse: FINESSE.some((w) => lower.includes(w)) || !!stats?.properties?.includes("finesse"),
    ranged: (RANGED.some((w) => lower.includes(w)) && !lower.includes("thrown")) || !!stats?.properties?.includes("ranged"),
    damageDice: stats?.damageDice || dice,
    damageType: stats?.damageType || type,
  };
}

/** Finesse lets you use the better of STR and DEX; ranged uses DEX; otherwise STR. Monks may use DEX unarmed. */
export function attackAbilityMod(w: WeaponProfile, str: number, dex: number, opts: { monk?: boolean } = {}): number {
  const s = getAbilityModifier(str);
  const d = getAbilityModifier(dex);
  if (w.ranged) return d;
  if (w.finesse || (opts.monk && w.name.toLowerCase() === "unarmed")) return Math.max(s, d);
  return s;
}

// ---------------------------------------------------------------------------
// Class features
// ---------------------------------------------------------------------------

const isClass = (className: string, c: string) => className.trim().toLowerCase() === c;

export function sneakAttackDice(level: number): string {
  const def = getClassDef("rogue");
  const f = def?.features[1]?.find((x) => x.id === "sneak_attack");
  return atLevel(f?.scaling, level) ?? `${Math.ceil(level / 2)}d6`;
}

export interface SneakAttackCheck {
  eligible: boolean;
  reason: string;
}

/**
 * SRD: once per turn, extra damage on a hit with a finesse or ranged weapon if
 * you have advantage on the attack roll, OR another enemy of the target (an
 * ally) is within 5 feet of it, it isn't incapacitated, and you don't have
 * disadvantage.
 */
export function sneakAttackEligibility(o: {
  className: string;
  weapon: WeaponProfile;
  advantage: boolean;
  disadvantage: boolean;
  allyAdjacent: boolean;
  usedThisTurn: boolean;
}): SneakAttackCheck {
  if (!isClass(o.className, "rogue")) return { eligible: false, reason: "Only Rogues have Sneak Attack." };
  if (o.usedThisTurn) return { eligible: false, reason: "Sneak Attack works once per turn." };
  if (!o.weapon.finesse && !o.weapon.ranged) return { eligible: false, reason: "Sneak Attack needs a finesse or ranged weapon." };
  const adv = o.advantage && !o.disadvantage;
  if (adv) return { eligible: true, reason: "You have advantage on the attack." };
  if (o.allyAdjacent && !o.disadvantage) return { eligible: true, reason: "An ally is next to the target and you don't have disadvantage." };
  if (o.disadvantage) return { eligible: false, reason: "You have disadvantage on the attack." };
  return { eligible: false, reason: "You need advantage, or an ally within 5 feet of the target." };
}

/** Rage damage bonus: +2 (levels 1–8), +3 (9–15), +4 (16+). Melee STR weapon attacks only. */
export function rageDamageBonus(level: number): number {
  return level >= 16 ? 4 : level >= 9 ? 3 : 2;
}

/** Resistance halves damage, rounded down. */
export function applyResistance(damage: number): number {
  return Math.floor(Math.max(0, damage) / 2);
}

/** Divine Smite: 2d8 for a 1st-level slot, +1d8 per slot level above 1st (max 5d8), +1d8 vs undead or fiends. */
export function divineSmiteDice(slotLevel: number, undeadOrFiend: boolean): number {
  const base = Math.min(5, 1 + Math.max(1, slotLevel));
  return base + (undeadOrFiend ? 1 : 0);
}

/** Second Wind: bonus action, regain 1d10 + fighter level HP. */
export function secondWindHeal(level: number, d10: number): number {
  return d10 + level;
}

/** Attacks per Attack action: Extra Attack at 5 (Barbarian, Fighter, Monk, Paladin, Ranger); Fighter 3 at 11. */
export function attacksPerAction(className: string, level: number): number {
  const c = className.trim().toLowerCase();
  if (c === "fighter" && level >= 11) return 3;
  if (["barbarian", "fighter", "monk", "paladin", "ranger"].includes(c) && level >= 5) return 2;
  return 1;
}

/** Damage cantrips gain a die at 5th, 11th and 17th character level. */
export function cantripDiceCount(level: number): number {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

/** Arcane Recovery: slots with combined level ≤ half your wizard level (rounded up), none 6th or higher. */
export function arcaneRecoveryBudget(level: number): { totalLevels: number; maxSlotLevel: number } {
  return { totalLevels: Math.ceil(level / 2), maxSlotLevel: 5 };
}

export function validateArcaneRecovery(level: number, slotLevels: number[]): boolean {
  const b = arcaneRecoveryBudget(level);
  return slotLevels.every((s) => s >= 1 && s <= b.maxSlotLevel) && slotLevels.reduce((a, s) => a + s, 0) <= b.totalLevels;
}

export function martialArtsDie(level: number): string {
  return level >= 17 ? "1d10" : level >= 11 ? "1d8" : level >= 5 ? "1d6" : "1d4";
}

export function bardicInspirationDie(level: number): string {
  return level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6";
}

// ---------------------------------------------------------------------------
// Action economy
// ---------------------------------------------------------------------------

export type ActionKind = "attack" | "dash" | "disengage" | "dodge" | "help" | "hide" | "shove";
export type BonusKind =
  | "second_wind" | "rage" | "cunning_dash" | "cunning_disengage" | "cunning_hide"
  | "flurry_of_blows" | "patient_defense" | "step_of_the_wind" | "bardic_inspiration" | "offhand_attack";

export interface TurnEconomy {
  actions: number; // 1, or 2 after Action Surge
  actionsUsed: number;
  bonusUsed: boolean;
  reactionUsed: boolean;
  sneakAttackUsed: boolean;
}

export const FRESH_TURN: TurnEconomy = { actions: 1, actionsUsed: 0, bonusUsed: false, reactionUsed: false, sneakAttackUsed: false };

/** Which bonus actions this character's features allow. */
export function availableBonusActions(className: string, featureIds: string[]): BonusKind[] {
  const has = (id: string) => featureIds.includes(id);
  const out: BonusKind[] = [];
  if (has("second_wind")) out.push("second_wind");
  if (has("rage")) out.push("rage");
  if (has("cunning_action")) out.push("cunning_dash", "cunning_disengage", "cunning_hide");
  if (has("flurry_of_blows")) out.push("flurry_of_blows");
  if (has("patient_defense")) out.push("patient_defense");
  if (has("step_of_the_wind")) out.push("step_of_the_wind");
  if (has("bardic_inspiration")) out.push("bardic_inspiration");
  void className;
  return out;
}

/** Feature use cost of a bonus action: [featureId, uses] (Ki-powered options spend 1 ki). */
export const BONUS_COST: Partial<Record<BonusKind, [string, number]>> = {
  second_wind: ["second_wind", 1],
  rage: ["rage", 1],
  flurry_of_blows: ["ki", 1],
  patient_defense: ["ki", 1],
  step_of_the_wind: ["ki", 1],
  bardic_inspiration: ["bardic_inspiration", 1],
};
