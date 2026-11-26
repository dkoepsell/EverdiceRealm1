/**
 * The monsters' side of a campaign combat round (danger spec Phases 2 and 3),
 * replacing combatManager.processEnemyAttacks for campaigns with the
 * dangerPacing flag. Same CombatTurnResult shape, so routes.ts applies it the
 * same way, but the monsters now fight like their SRD stat blocks:
 *
 *  - every attack in the stat block (Multiattack), with Pack Tactics, Martial
 *    Advantage, knock-prone bites, poison riders and extra damage dice;
 *  - recharge actions (breath weapons) that are TELEGRAPHED a round ahead, so
 *    the party can react (Dodge gives advantage on Dexterity saves; spreading
 *    out is narrated), then hit everyone with a saving throw;
 *  - targets picked by role, not at random: brutes stick to one foe,
 *    skirmishers go for the most wounded, artillery for the softest armour,
 *    leaders for the player character, mindless creatures for whoever is near.
 *
 * Enemies without a known stat block keep their single attack (attackBonus,
 * damageRoll) as before. Pure apart from the injected dice.
 */
import type { Combatant, CombatLogEntry, CombatTurnResult, DamageRollResult } from "../../combatManager";
import { computeConditionModifiers } from "../../combatManager";
import { MONSTERS, type MonsterAttack, type MonsterSpecial, type MonsterStats } from "@shared/rules/monsters";

export type Role = "brute" | "skirmisher" | "artillery" | "leader" | "mindless" | "controller";

/** Per-enemy memory between rounds, stored on the storyState combatant as `tactics`. */
export interface EnemyTactics {
  lastTarget?: string;
  /** The recharge action is ready. Undefined means ready (it starts charged). */
  specialReady?: boolean;
  /** The special was announced last round and fires this round. */
  telegraphed?: boolean;
}

export interface MonsterInput extends Combatant {
  /** SRD key (from a planned skirmish), or matched from the name. */
  srdKey?: string;
  tactics?: EnemyTactics;
}

export interface PartySaves {
  /** Saving throw bonus for a party member (ability modifier + proficiency if proficient). */
  (name: string, ability: string): number;
}

export interface Dice { d: (sides: number) => number }
const defaultDice: Dice = { d: (n) => 1 + Math.floor(Math.random() * n) };

export interface MonsterRoundResult extends CombatTurnResult {
  /** New tactics per enemy name, to write back onto storyState.combatants. */
  tactics: Record<string, EnemyTactics>;
  /** Party members knocked prone this round (until they stand on their turn). */
  knockedProne: string[];
  /** Telegraphs announced this round, for the narrator and the turn notes. */
  telegraphs: string[];
  /** Plain-language lines for the turn notes, with the math. */
  notes: string[];
}

/** Match a combatant to an SRD stat block: by key, then by name ("Wolf 2", "Goblin B" → wolf, goblin). */
export function statBlockFor(e: { srdKey?: string; name: string }): MonsterStats | null {
  if (e.srdKey && MONSTERS[e.srdKey]) return MONSTERS[e.srdKey];
  const base = e.name.toLowerCase().replace(/\s+([0-9]+|[a-z])$/i, "").trim();
  const byName = Object.values(MONSTERS).find((m) => m.name.toLowerCase() === base);
  if (byName) return byName;
  const contained = Object.values(MONSTERS)
    .filter((m) => new RegExp(`\\b${m.name.toLowerCase()}s?\\b`).test(base))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return contained ?? null;
}

const RANGED = /\b(bow|longbow|shortbow|crossbow|sling|javelin|dart|spikes|spit)\b/i;

export function roleOf(m: MonsterStats | null, name: string): Role {
  if (/\b(captain|boss|chief|lord|leader|priest|warlord)\b/i.test(name)) return "leader";
  if (!m) return "brute";
  if (m.special) return "controller";
  if (m.traits.includes("fearless") && /undead|construct|ooze/.test(m.creatureType)) return "mindless";
  if (m.attacks.length && m.attacks.every((a) => RANGED.test(a.name))) return "artillery";
  if (m.traits.includes("pack_tactics") || m.traits.includes("nimble_escape") || m.traits.includes("martial_advantage")) return "skirmisher";
  return "brute";
}

const ROLE_WHY: Record<Role, string> = {
  brute: "stays on the foe in front of it",
  skirmisher: "goes for whoever looks weakest",
  artillery: "picks the target with the thinnest armour",
  leader: "goes after the biggest threat",
  mindless: "lashes out at whatever is nearest",
  controller: "looks for the most of you to catch at once",
};

function pickTarget(role: Role, party: Combatant[], tactics: EnemyTactics, dice: Dice, leadName?: string): Combatant {
  const up = party.filter((p) => p.status === "conscious" && p.currentHp > 0);
  const byLowHp = [...up].sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp || a.armorClass - b.armorClass);
  const byLowAc = [...up].sort((a, b) => a.armorClass - b.armorClass || a.currentHp - b.currentHp);
  switch (role) {
    case "brute": {
      const last = up.find((p) => p.name === tactics.lastTarget);
      return last ?? up.find((p) => p.type === "player") ?? up[0];
    }
    case "skirmisher":
      return byLowHp[0];
    case "artillery":
      return byLowAc[0];
    case "leader":
      return up.find((p) => p.name === leadName) ?? up.find((p) => p.type === "player") ?? up[0];
    default:
      return up[Math.floor((dice.d(up.length * 10) - 1) / 10)] ?? up[0];
  }
}

function roll(expr: string, dice: Dice, crit = false): DamageRollResult {
  const m = expr.replace(/\s/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return { diceRolls: [], diceType: "d0", modifier: Number(expr) || 0, total: Math.max(0, Number(expr) || 0), isCritical: crit };
  const count = parseInt(m[1]) * (crit ? 2 : 1);
  const sides = parseInt(m[2]);
  const rolls = Array.from({ length: count }, () => dice.d(sides));
  const mod = m[3] ? parseInt(m[3]) : 0;
  return { diceRolls: rolls, diceType: `d${sides}`, modifier: mod, total: Math.max(0, rolls.reduce((a, b) => a + b, 0) + mod), isCritical: crit };
}

const fmtDice = (r: DamageRollResult) => `${r.diceRolls.length}${r.diceType} (${r.diceRolls.join("+")})${r.modifier ? ` ${r.modifier > 0 ? "+" : "−"} ${Math.abs(r.modifier)}` : ""}`;

/**
 * Resolve every conscious enemy's turn. `leadName` is the acting player
 * character (a leader's preferred target). `saves` gives each party member's
 * save bonus; companions without stats default to +1.
 */
export function processMonsterRound(
  enemies: MonsterInput[],
  partyIn: Combatant[],
  opts: { saves?: PartySaves; dice?: Dice; leadName?: string } = {},
): MonsterRoundResult {
  const dice = opts.dice ?? defaultDice;
  const saveBonus = opts.saves ?? (() => 1);
  const party = partyIn.map((p) => ({ ...p, conditions: [...(p.conditions ?? [])] }));
  const logs: CombatLogEntry[] = [];
  const damageByName = new Map<string, number>();
  const tactics: Record<string, EnemyTactics> = {};
  const knockedProne: string[] = [];
  const telegraphs: string[] = [];
  const notes: string[] = [];

  const active = enemies.filter((e) => e.status === "conscious" && e.currentHp > 0);
  const hurt = (p: Combatant, amount: number) => {
    p.currentHp = Math.max(0, p.currentHp - amount);
    if (p.currentHp <= 0) p.status = "unconscious";
    damageByName.set(p.name, (damageByName.get(p.name) ?? 0) + amount);
  };

  for (const e of active) {
    if (!party.some((p) => p.status === "conscious" && p.currentHp > 0)) break;
    const block = statBlockFor(e);
    const role = roleOf(block, e.name);
    const t: EnemyTactics = { ...(e.tactics ?? {}) };
    const special: MonsterSpecial | undefined = block?.special;

    // Recharge (SRD "Recharge 5–6"): roll at the start of its turn if spent.
    if (special && t.specialReady === false && !t.telegraphed) {
      const r = dice.d(6);
      if (r >= special.recharge) {
        t.specialReady = true;
        notes.push(`${e.name}'s ${special.name} recharges (d6: ${r}, needs ${special.recharge}+).`);
      }
    }

    // A telegraphed special fires now, instead of its attacks.
    if (special && t.telegraphed) {
      const targets = party.filter((p) => p.status === "conscious" && p.currentHp > 0);
      const dmg = roll(special.damage, dice);
      const lines: string[] = [];
      for (const p of targets) {
        const dodgingDex = special.save.ability === "dexterity" && (p.conditions ?? []).includes("dodging");
        const d20s = dodgingDex ? [dice.d(20), dice.d(20)] : [dice.d(20)];
        const kept = Math.max(...d20s);
        const bonus = saveBonus(p.name, special.save.ability);
        const total = kept + bonus;
        const saved = total >= special.save.dc;
        const amount = saved ? (special.halfOnSave ? Math.floor(dmg.total / 2) : 0) : dmg.total;
        if (amount > 0) hurt(p, amount);
        const ab = special.save.ability.charAt(0).toUpperCase() + special.save.ability.slice(1);
        lines.push(
          `${p.name}: ${ab} save ${dodgingDex ? `2d20 advantage, Dodge (${d20s.join(", ")} → ${kept})` : `d20 (${kept})`} ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)} = ${total} vs DC ${special.save.dc}: ${saved ? "success" : "failure"}, ${amount} ${special.damageType} damage.`,
        );
        logs.push({
          attacker: e.name, attackerType: "enemy", target: p.name, targetType: p.type,
          attackRoll: { roll: kept, modifier: bonus, total, isCritical: false, isCriticalMiss: false },
          targetAC: special.save.dc, isHit: !saved || amount > 0, damage: amount > 0 ? { ...dmg, total: amount } : undefined,
          targetNewHp: p.currentHp, targetMaxHp: p.maxHp, targetStatus: p.status,
          description: `${e.name} unleashes ${special.name}! ${p.name} ${saved ? (amount ? `dives aside and takes ${amount}` : "dives clear") : `takes ${amount}`} ${special.damageType} damage.`,
          mechanicsBreakdown: `${special.name}: ${fmtDice(dmg)} = ${dmg.total} ${special.damageType}. ${lines[lines.length - 1]}`,
        });
      }
      notes.push(`${e.name} uses ${special.name}: ${special.save.ability} saving throw DC ${special.save.dc}, ${special.damage} ${special.damageType}${special.halfOnSave ? ", half on a success" : ""}.`);
      t.telegraphed = false;
      t.specialReady = false;
      tactics[e.name] = t;
      continue;
    }

    const target = pickTarget(role, party, t, dice, opts.leadName);
    if (!target) break;
    t.lastTarget = target.name;

    // Announce the special for next round (it still attacks this round).
    if (special && t.specialReady !== false && !t.telegraphed) {
      t.telegraphed = true;
      telegraphs.push(`${e.name}: ${special.tell}. Next round it uses ${special.name} (${special.save.ability} save DC ${special.save.dc}).${special.save.ability === "dexterity" ? " Taking the Dodge action gives advantage on Dexterity saves." : ""}`);
    }

    const attacks: MonsterAttack[] = block?.attacks?.length
      ? block.attacks
      : [{ name: "Attack", bonus: e.attackBonus ?? 3, damage: e.damageRoll || "1d6+1", damageType: "bludgeoning" }];
    const alliesUp = active.filter((x) => x !== e && x.status === "conscious" && x.currentHp > 0).length;
    let martialUsed = false;

    for (const atk of attacks) {
      const tgt = target.status === "conscious" && target.currentHp > 0 ? target : pickTarget(role, party, t, dice, opts.leadName);
      if (!tgt) break;
      const cond = computeConditionModifiers(e.conditions ?? [], tgt.conditions ?? []);
      let adv = cond.advantage ? 1 : 0;
      const dis = cond.disadvantage ? 1 : 0;
      const why: string[] = [...cond.notes];
      if (block?.traits.includes("pack_tactics") && alliesUp > 0) { adv++; why.push("Pack Tactics: an ally is beside the target"); }
      if ((tgt.conditions ?? []).includes("prone") && !RANGED.test(atk.name)) { adv++; why.push("the target is prone"); }
      const mode = adv > 0 && dis === 0 ? "advantage" : dis > 0 && adv === 0 ? "disadvantage" : "normal";
      const d20s = mode === "normal" ? [dice.d(20)] : [dice.d(20), dice.d(20)];
      const kept = mode === "advantage" ? Math.max(...d20s) : mode === "disadvantage" ? Math.min(...d20s) : d20s[0];
      const crit = kept === 20 || (cond.autoCrit && kept !== 1);
      const total = kept + atk.bonus;
      const hit = crit || (kept !== 1 && total >= tgt.armorClass);
      const rollText = d20s.length > 1 ? `2d20 ${mode} (${d20s.join(", ")} → ${kept}${why.length ? `; ${why.join(", ")}` : ""})` : `d20 (${kept})`;
      const parts: string[] = [`${atk.name}: ${rollText} + ${atk.bonus} = ${total} vs AC ${tgt.armorClass}: ${crit ? "critical hit" : hit ? "hit" : "miss"}.`];
      let dmgResult: DamageRollResult | undefined;
      if (hit) {
        dmgResult = roll(atk.damage, dice, crit);
        let amount = dmgResult.total;
        parts.push(`Damage ${fmtDice(dmgResult)} = ${dmgResult.total} ${atk.damageType}.`);
        if (atk.extra) {
          const x = roll(atk.extra.damage, dice, crit);
          amount += x.total;
          parts.push(`Plus ${fmtDice(x)} = ${x.total} ${atk.extra.damageType}.`);
        }
        if (block?.traits.includes("martial_advantage") && alliesUp > 0 && !martialUsed) {
          const x = roll("2d6", dice, crit);
          amount += x.total;
          martialUsed = true;
          parts.push(`Martial Advantage (an ally is beside the target): ${fmtDice(x)} = ${x.total}.`);
        }
        if (cond.damageResistance && /slashing|piercing|bludgeoning/.test(atk.damageType)) {
          amount = Math.max(1, Math.floor(amount / 2));
          parts.push(`Resistance halves it to ${amount}.`);
        }
        if (atk.poison) {
          const b = saveBonus(tgt.name, "constitution");
          const r = dice.d(20);
          const pd = roll(atk.poison.damage, dice);
          const saved = r + b >= atk.poison.dc;
          const pAmount = saved ? Math.floor(pd.total / 2) : pd.total;
          amount += pAmount;
          parts.push(`Poison: Constitution save d20 (${r}) ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${r + b} vs DC ${atk.poison.dc}: ${saved ? "success, half" : "failure"}, ${pAmount} poison.`);
        }
        hurt(tgt, amount);
        if (atk.knockdownDC && tgt.currentHp > 0 && !(tgt.conditions ?? []).includes("prone")) {
          const b = saveBonus(tgt.name, "strength");
          const r = dice.d(20);
          if (r + b < atk.knockdownDC) {
            tgt.conditions = [...(tgt.conditions ?? []), "prone"];
            knockedProne.push(tgt.name);
            parts.push(`Knocked prone: Strength save d20 (${r}) ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${r + b} vs DC ${atk.knockdownDC}: failure.`);
          } else {
            parts.push(`Keeps their feet: Strength save ${r + b} vs DC ${atk.knockdownDC}.`);
          }
        }
        if (dmgResult) dmgResult = { ...dmgResult, total: amount };
      }
      const label = tgt.type === "companion" ? `your companion ${tgt.name}` : tgt.name;
      const description = !hit
        ? `${e.name}'s ${atk.name.toLowerCase()} misses ${label}.`
        : `${e.name} ${crit ? "lands a brutal critical with its" : "hits with its"} ${atk.name.toLowerCase()}: ${dmgResult?.total ?? 0} damage to ${label}${tgt.currentHp <= 0 ? `, who falls unconscious!` : "."}`;
      logs.push({
        attacker: e.name, attackerType: "enemy", target: tgt.name, targetType: tgt.type,
        attackRoll: { roll: kept, modifier: atk.bonus, total, isCritical: crit, isCriticalMiss: kept === 1 },
        targetAC: tgt.armorClass, isHit: hit, damage: dmgResult,
        targetNewHp: tgt.currentHp, targetMaxHp: tgt.maxHp, targetStatus: tgt.status,
        description,
        mechanicsBreakdown: `${e.name} (${role}: ${ROLE_WHY[role]}). ${parts.join(" ")}`,
      });
    }
    tactics[e.name] = t;
  }

  const partyDamageDealt = Array.from(damageByName.entries()).map(([name, dmg]) => {
    const p = party.find((x) => x.name === name)!;
    return { name, damageTaken: dmg, newHp: p.currentHp, maxHp: p.maxHp, defeated: p.currentHp <= 0, isCompanion: p.type === "companion" };
  });
  // Prone lasts until the creature stands on its own turn: clear it from what we hand back.
  const updatedCombatants = party.map((p) => ({ ...p, conditions: (p.conditions ?? []).filter((c) => c !== "prone") }));
  const hits = logs.filter((l) => l.isHit).length;
  return {
    logs,
    updatedCombatants,
    enemyDamageDealt: [],
    partyDamageDealt,
    combatSummary: `The enemies act: ${hits} of ${logs.length} attacks land.`,
    mechanicsExplanation: logs.map((l) => l.mechanicsBreakdown).join("\n"),
    tactics,
    knockedProne,
    telegraphs,
    notes,
  };
}
