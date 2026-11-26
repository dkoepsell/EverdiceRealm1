/**
 * Resolve one player turn in managed combat with the 5e action economy and
 * class features (engagement spec Phase 4.3): a bonus action, then an action
 * (Action Surge grants a second one). Pure — the route applies the result.
 *
 * Damage, hits and resources are decided here; the model only narrates.
 */
import { checkModifier, combineRollMode } from "@shared/rules/checks";
import {
  type ActionKind, type BonusKind, BONUS_COST, applyResistance, attackAbilityMod, attacksPerAction, availableBonusActions,
  divineSmiteDice, martialArtsDie, rageDamageBonus, secondWindHeal, sneakAttackDice, sneakAttackEligibility, weaponProfile,
} from "@shared/rules/classActions";
import { type CharacterFeatureState } from "@shared/rules/leveling";
import { getAbilityModifier, getProficiencyBonus } from "@shared/rules/xp";

export interface ClassCombatState {
  rageRoundsLeft?: number;
  dodging?: boolean;
  reckless?: boolean;
  hidden?: boolean;
  disengaged?: boolean;
  /** Cover bonus to AC for the enemies' attacks this round (battlefield feature). */
  cover?: 0 | 2 | 5;
}

export interface TurnRequest {
  action: ActionKind;
  bonus?: BonusKind | null;
  targetName?: string | null;
  reckless?: boolean;
  smiteSlot?: number | null;
  actionSurge?: boolean;
}

export interface TurnCharacter {
  name: string;
  class: string;
  level: number;
  subclass?: string | null;
  hitPoints: number;
  maxHitPoints: number;
  strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number;
  skills?: string[] | null;
  equippedWeapon?: string | null;
  activeConditions?: unknown;
}

export interface EnemyView {
  name: string;
  type?: string;
  ac?: number;
  currentHp?: number;
  status?: string;
  creatureType?: string;
}

export interface TurnContext {
  character: TurnCharacter;
  features: CharacterFeatureState[];
  combat: ClassCombatState;
  enemies: EnemyView[];
  /** A conscious companion or ally is in the fight (for Sneak Attack's "ally within 5 feet"). */
  allyEngaged: boolean;
  spellSlotsAvailable: (level: number) => boolean;
  d: (sides: number) => number;
}

export interface TurnResolution {
  ok: boolean;
  error?: string;
  summary: string;
  breakdown: string[];
  targetName: string | null;
  hit: boolean;
  attackRoll: { roll: number; modifier: number; total: number; isCritical: boolean; isCriticalMiss: boolean } | null;
  damageTotal: number;
  damageType: string;
  healed: number;
  featureUses: Record<string, number>; // featureId → uses spent
  spellSlotUsed: number | null;
  combat: ClassCombatState;
  rulesFired: string[];
}

const usesLeft = (features: CharacterFeatureState[], id: string) => features.find((f) => f.id === id)?.usesRemaining ?? 0;
const hasFeature = (features: CharacterFeatureState[], id: string) => features.some((f) => f.id === id);
const rollDice = (expr: string, d: (n: number) => number, crit: boolean) => {
  const m = expr.match(/(\d+)d(\d+)/);
  if (!m) return { rolls: [] as number[], total: Number(expr) || 0 };
  const count = parseInt(m[1]) * (crit ? 2 : 1);
  const rolls = Array.from({ length: count }, () => d(parseInt(m[2])));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
};

export function resolveClassTurn(req: TurnRequest, ctx: TurnContext): TurnResolution {
  const c = ctx.character;
  const cls = c.class.trim().toLowerCase();
  const breakdown: string[] = [];
  const rulesFired = new Set<string>(["action_economy"]);
  const featureUses: Record<string, number> = {};
  const featureIds = ctx.features.map((f) => f.id);
  const combat: ClassCombatState = { ...ctx.combat, dodging: false, reckless: false, disengaged: false };
  let healed = 0;
  let spellSlotUsed: number | null = null;
  const spend = (id: string, n = 1) => {
    if (usesLeft(ctx.features, id) - (featureUses[id] ?? 0) < n) return false;
    featureUses[id] = (featureUses[id] ?? 0) + n;
    return true;
  };
  const fail = (error: string): TurnResolution => ({
    ok: false, error, summary: "", breakdown: [], targetName: null, hit: false, attackRoll: null, damageTotal: 0,
    damageType: "", healed: 0, featureUses: {}, spellSlotUsed: null, combat: ctx.combat, rulesFired: [],
  });

  // ---- Bonus action -------------------------------------------------------
  let extraUnarmedStrikes = 0;
  if (req.bonus) {
    if (!availableBonusActions(c.class, featureIds).includes(req.bonus)) return fail("You don't have that bonus action.");
    const cost = BONUS_COST[req.bonus];
    if (cost && !spend(cost[0], cost[1])) return fail(`No uses of ${cost[0].replace(/_/g, " ")} left.`);
    switch (req.bonus) {
      case "second_wind": {
        const roll = ctx.d(10);
        healed = Math.min(c.maxHitPoints - c.hitPoints, secondWindHeal(c.level, roll));
        breakdown.push(`Bonus action, Second Wind: 1d10 (${roll}) + ${c.level} = ${roll + c.level} HP regained${healed < roll + c.level ? ` (${healed} to full)` : ""}.`);
        break;
      }
      case "rage":
        combat.rageRoundsLeft = 10;
        breakdown.push(`Bonus action, Rage: +${rageDamageBonus(c.level)} melee damage, resistance to bludgeoning/piercing/slashing, advantage on Strength checks, for 1 minute.`);
        break;
      case "cunning_dash": breakdown.push("Bonus action, Cunning Action: Dash (double movement this turn)."); break;
      case "cunning_disengage": combat.disengaged = true; breakdown.push("Bonus action, Cunning Action: Disengage (no opportunity attacks against you this turn)."); rulesFired.add("opportunity_attack"); break;
      case "cunning_hide": {
        const mod = checkModifier(c, "stealth");
        const roll = ctx.d(20);
        const dc = 11; // a typical guard's passive Perception (10 + Wisdom +1)
        combat.hidden = roll + mod.total >= dc;
        breakdown.push(`Bonus action, Cunning Action: Hide. Stealth d20 (${roll}) + ${mod.total} = ${roll + mod.total} vs their passive Perception ${dc}: ${combat.hidden ? "hidden (your next attack has advantage)" : "spotted"}.`);
        break;
      }
      case "flurry_of_blows": extraUnarmedStrikes = 2; breakdown.push("Bonus action, Flurry of Blows (1 ki): two unarmed strikes after your Attack action."); break;
      case "patient_defense": combat.dodging = true; breakdown.push("Bonus action, Patient Defense (1 ki): Dodge."); break;
      case "step_of_the_wind": combat.disengaged = true; breakdown.push("Bonus action, Step of the Wind (1 ki): Disengage, and your jump distance doubles."); break;
      case "bardic_inspiration": breakdown.push("Bonus action, Bardic Inspiration: an ally gains an inspiration die to add to one roll."); break;
      default: break;
    }
  }

  // ---- Action(s) ----------------------------------------------------------
  let actions = 1;
  if (req.actionSurge) {
    if (!hasFeature(ctx.features, "action_surge") || !spend("action_surge")) return fail("No Action Surge left.");
    actions = 2;
    breakdown.push("Action Surge: you take one additional action this turn.");
  }

  let targetName: string | null = null;
  let firstRoll: TurnResolution["attackRoll"] = null;
  let hitAny = false;
  let damageTotal = 0;
  let damageType = "";

  if (req.action !== "attack") {
    const label: Record<string, string> = {
      dash: "Dash: double your movement this turn.",
      disengage: "Disengage: no opportunity attacks against you this turn.",
      dodge: "Dodge: attacks against you have disadvantage until your next turn.",
      help: "Help: an ally gains advantage on their next attack against your target.",
      hide: "Hide: you try to slip out of sight.",
      shove: "Shove: you try to push the target 5 feet or knock it prone.",
    };
    if (req.action === "dodge") combat.dodging = true;
    if (req.action === "disengage") { combat.disengaged = true; rulesFired.add("opportunity_attack"); }
    breakdown.push(`Action, ${label[req.action] ?? req.action}`);
  } else {
    const live = ctx.enemies.filter((e) => e.status !== "defeated" && e.status !== "fled" && e.status !== "surrendered" && (e.currentHp ?? 1) > 0);
    const target = live.find((e) => req.targetName && e.name.toLowerCase() === req.targetName.toLowerCase()) ?? live[0];
    if (!target) return fail("There's no one left to attack.");
    targetName = target.name;
    const monk = cls === "monk";
    const weapon = weaponProfile(c.equippedWeapon);
    const abilityMod = attackAbilityMod(weapon, c.strength, c.dexterity, { monk });
    const prof = getProficiencyBonus(c.level);
    const attackBonus = abilityMod + prof;
    const ac = target.ac ?? 12;
    const reckless = !!req.reckless && hasFeature(ctx.features, "reckless_attack") && !weapon.ranged;
    if (reckless) { combat.reckless = true; breakdown.push("Reckless Attack: advantage on your melee attacks this turn; attacks against you have advantage until your next turn."); }
    const raging = (combat.rageRoundsLeft ?? 0) > 0;
    // Rage's damage bonus applies to melee weapon attacks made with Strength.
    const strBased = !weapon.ranged && (!weapon.finesse || getAbilityModifier(c.strength) >= getAbilityModifier(c.dexterity));
    const conds = Array.isArray(c.activeConditions) ? (c.activeConditions as any[]).map((x) => String(x?.name ?? x).toLowerCase()) : [];
    const disadvSources = conds.filter((x) => ["poisoned", "frightened", "blinded", "prone", "restrained"].includes(x)).length;
    const advSources = (reckless ? 1 : 0) + (combat.hidden ? 1 : 0);
    const mode = combineRollMode(advSources, disadvSources);
    if (advSources || disadvSources) rulesFired.add("advantage");
    const critOn = hasFeature(ctx.features, "improved_critical") ? 19 : 20;
    const swings = attacksPerAction(c.class, c.level) * actions + extraUnarmedStrikes;
    let sneakUsed = false;
    let smiteUsed = false;
    for (let i = 0; i < swings; i++) {
      const unarmed = i >= swings - extraUnarmedStrikes && extraUnarmedStrikes > 0;
      const w = unarmed ? weaponProfile("Unarmed") : weapon;
      const dice = mode === "normal" ? [ctx.d(20)] : [ctx.d(20), ctx.d(20)];
      const kept = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0];
      const crit = kept >= critOn;
      const fumble = kept === 1;
      const total = kept + attackBonus;
      const hit = crit || (!fumble && total >= ac);
      if (!firstRoll) firstRoll = { roll: kept, modifier: attackBonus, total, isCritical: crit, isCriticalMiss: fumble };
      const name = unarmed ? "Unarmed strike" : w.name;
      const rollText = dice.length > 1 ? `2d20 ${mode} (${dice.join(", ")} → ${kept})` : `d20 (${kept})`;
      if (!hit) {
        breakdown.push(`${name}: ${rollText} + ${attackBonus} = ${total} vs AC ${ac}: ${fumble ? "natural 1, miss" : "miss"}.`);
        continue;
      }
      hitAny = true;
      const dmgDice = unarmed || (monk && w.name.toLowerCase() === "unarmed") ? martialArtsDie(c.level) : w.damageDice;
      const base = rollDice(dmgDice, ctx.d, crit);
      let dmg = base.total + abilityMod;
      const parts = [`${dmgDice}${crit ? " ×2 dice" : ""} (${base.rolls.join("+") || dmgDice}) + ${abilityMod}`];
      if (raging && strBased && !w.ranged) { dmg += rageDamageBonus(c.level); parts.push(`+ ${rageDamageBonus(c.level)} rage`); }
      if (!sneakUsed && !unarmed) {
        const sa = sneakAttackEligibility({ className: c.class, weapon: w, advantage: mode === "advantage", disadvantage: mode === "disadvantage", allyAdjacent: ctx.allyEngaged, usedThisTurn: false });
        if (sa.eligible) {
          const sd = rollDice(sneakAttackDice(c.level), ctx.d, crit);
          dmg += sd.total;
          sneakUsed = true;
          rulesFired.add("sneak_attack");
          parts.push(`+ Sneak Attack ${sneakAttackDice(c.level)} (${sd.rolls.join("+")}): ${sa.reason}`);
        }
      }
      if (!smiteUsed && req.smiteSlot && hasFeature(ctx.features, "divine_smite") && !w.ranged && ctx.spellSlotsAvailable(req.smiteSlot)) {
        const undead = /undead|fiend|zombie|skeleton|ghoul|demon|devil|vampire|wight|wraith/i.test(`${target.creatureType ?? ""} ${target.name}`);
        const n = divineSmiteDice(req.smiteSlot, undead);
        const sm = rollDice(`${n}d8`, ctx.d, crit);
        dmg += sm.total;
        smiteUsed = true;
        spellSlotUsed = req.smiteSlot;
        parts.push(`+ Divine Smite ${n}d8 radiant (${sm.rolls.join("+")}, level ${req.smiteSlot} slot)`);
      }
      dmg = Math.max(1, dmg);
      damageTotal += dmg;
      damageType = w.damageType;
      breakdown.push(`${name}: ${rollText} + ${attackBonus} = ${total} vs AC ${ac}: ${crit ? "CRITICAL HIT" : "hit"} for ${dmg} (${parts.join(" ")}).`);
    }
    combat.hidden = false; // attacking reveals you
    if (req.smiteSlot && !smiteUsed && hitAny === false) breakdown.push("Divine Smite is only spent on a hit, so your spell slot is kept.");
  }

  if (combat.rageRoundsLeft) combat.rageRoundsLeft = Math.max(0, combat.rageRoundsLeft - 1);
  const summary = [
    req.bonus ? `${c.name} uses ${req.bonus.replace(/_/g, " ")}.` : "",
    req.action === "attack"
      ? (hitAny ? `${c.name} hits ${targetName} for ${damageTotal} ${damageType} damage in total.` : `${c.name} attacks ${targetName} but misses.`)
      : `${c.name} takes the ${req.action} action.`,
    healed ? `${c.name} regains ${healed} HP.` : "",
  ].filter(Boolean).join(" ");
  return {
    ok: true, summary, breakdown, targetName, hit: hitAny, attackRoll: firstRoll, damageTotal, damageType, healed,
    featureUses, spellSlotUsed, combat, rulesFired: Array.from(rulesFired),
  };
}

/** Halve damage to a raging barbarian (bludgeoning/piercing/slashing). */
export function rageAdjustedDamage(damage: number, combat: ClassCombatState | null | undefined): number {
  return (combat?.rageRoundsLeft ?? 0) > 0 ? applyResistance(damage) : damage;
}
