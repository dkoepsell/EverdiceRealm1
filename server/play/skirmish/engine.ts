/**
 * Exploration combat for Wander and Delve: a real 5e fight in theater of the
 * mind, resolved on the server. Pure: no database here (routes.ts loads and
 * saves state).
 *
 *  - Initiative: d20 + Dex for the character and each monster. The character
 *    acts once a round; monsters above them act first, the rest after.
 *  - Surprise (from Wander's passive-Perception check): a surprised side
 *    loses its first round.
 *  - The character's turn reuses the campaign engine's class turn
 *    (server/play/combat/classTurn.ts): Extra Attack, Sneak Attack, Rage,
 *    Reckless Attack, Action Surge, Divine Smite, Cunning Action, Second Wind,
 *    Flurry of Blows. Casters add signature spells (spells.ts).
 *  - Monsters use SRD stat blocks (shared/rules/monsters.ts): multiattack,
 *    Pack Tactics, knock-prone bites, poison, Undead Fortitude, vulnerability.
 *  - Morale (DMG optional rule): the first time a monster that isn't fearless
 *    drops below half its hit points, it makes a DC 10 Wisdom save or flees.
 *  - Fleeing: take the Dash or Disengage action. Dashing away provokes
 *    opportunity attacks; Disengage doesn't. Anything faster than you keeps up
 *    unless you lose it with a Stealth check against its passive Perception
 *    (the DMG chase rules, compressed).
 *  - At 0 HP the monsters knock you out rather than kill you (PHB, "Knocking a
 *    Creature Out"): the fight is lost, not the character.
 */
import { type ClassCombatState, type TurnResolution, resolveClassTurn, rageAdjustedDamage } from "../combat/classTurn";
import type { CharacterFeatureState } from "@shared/rules/leveling";
import type { ActionKind, BonusKind } from "@shared/rules/classActions";
import { combineRollMode } from "@shared/rules/checks";
import { getAbilityModifier } from "@shared/rules/xp";
import type { MonsterAttack, MonsterStats, MonsterTrait } from "@shared/rules/monsters";
import { rollSave, rollSkill, type WanderCharacter } from "../wander/checks";
import { SPELLS, cantripDiceCount, castingMod, spellAttackBonus, spellSaveDC, spellsFor, type SkirmishSpell } from "./spells";

export type Surprise = "none" | "party_surprised" | "enemy_surprised";
export type SkirmishStatus = "active" | "won" | "lost" | "fled";

export interface SkirmishEnemy {
  id: string;
  name: string;
  key: string;
  ac: number;
  hp: number;
  maxHp: number;
  dexMod: number;
  speed: number;
  passive: number;
  attacks: MonsterAttack[];
  traits: MonsterTrait[];
  creatureType: string;
  xp: number;
  initiative: number;
  status: "active" | "down" | "fled";
  moraleChecked?: boolean;
  mocked?: boolean;
}

export interface LogEntry {
  round: number;
  who: "pc" | "enemy" | "system";
  text: string;
  detail?: string[];
}

export interface SkirmishState {
  v: 1;
  mode: "wander" | "delve";
  /** What started it: a Wander outcome, a thread climax, or a Delve room. */
  ref: { source: string; threadId?: number; nodeId?: string };
  round: number;
  status: SkirmishStatus;
  surprise: Surprise;
  pc: { name: string; hp: number; maxHp: number; ac: number; initiative: number; speed: number; prone: boolean };
  enemies: SkirmishEnemy[];
  classCombat: ClassCombatState;
  log: LogEntry[];
  encounterNote: string;
  rating: string;
  xpEarned: number;
  /** DM path: "behind the screen" notes this fight has earned (shared/dm/path.ts). */
  screenNotes?: string[];
}

export interface SkirmishCharacter extends WanderCharacter {
  name: string;
  class: string;
  level: number;
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number;
  equippedWeapon?: string | null;
  subclass?: string | null;
  race?: string | null;
  activeConditions?: unknown;
}

export interface Dice { d: (sides: number) => number }

const defaultDice: Dice = { d: (n) => 1 + Math.floor(Math.random() * n) };

export function rollExpr(expr: string, dice: Dice, crit = false): { total: number; rolls: number[]; text: string } {
  const m = expr.replace(/\s/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return { total: Number(expr) || 0, rolls: [], text: expr };
  const count = parseInt(m[1]) * (crit ? 2 : 1);
  const rolls = Array.from({ length: count }, () => dice.d(parseInt(m[2])));
  const mod = m[3] ? parseInt(m[3]) : 0;
  const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + mod);
  return { total, rolls, text: `${count}d${m[2]} (${rolls.join("+")})${mod ? ` ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}` : ""}` };
}

function baseSpeed(race?: string | null): number {
  return /dwarf|halfling|gnome/i.test(race ?? "") ? 25 : 30;
}

// ── start ─────────────────────────────────────────────────────────────────────

export function startSkirmish(opts: {
  mode: "wander" | "delve";
  ref: SkirmishState["ref"];
  character: SkirmishCharacter;
  monsters: Array<Pick<MonsterStats, "key" | "name" | "ac" | "hp" | "dexMod" | "speed" | "passive" | "attacks" | "traits" | "creatureType" | "xp">>;
  surprise?: Surprise;
  encounterNote: string;
  rating: string;
  dice?: Dice;
}): SkirmishState {
  const dice = opts.dice ?? defaultDice;
  const c = opts.character;
  const counts: Record<string, number> = {};
  opts.monsters.forEach((m) => { counts[m.name] = (counts[m.name] ?? 0) + 1; });
  const seen: Record<string, number> = {};
  const enemies: SkirmishEnemy[] = opts.monsters.map((m, i) => {
    seen[m.name] = (seen[m.name] ?? 0) + 1;
    const name = counts[m.name] > 1 ? `${m.name} ${String.fromCharCode(64 + seen[m.name])}` : m.name;
    return {
      id: `e${i}`, name, key: m.key, ac: m.ac, hp: m.hp, maxHp: m.hp, dexMod: m.dexMod, speed: m.speed, passive: m.passive,
      attacks: m.attacks, traits: m.traits, creatureType: m.creatureType, xp: m.xp,
      initiative: dice.d(20) + m.dexMod, status: "active",
    };
  });
  const pcInit = dice.d(20) + getAbilityModifier(c.dexterity);
  const s: SkirmishState = {
    v: 1, mode: opts.mode, ref: opts.ref, round: 1, status: "active", surprise: opts.surprise ?? "none",
    pc: { name: c.name, hp: Math.max(0, c.hitPoints), maxHp: c.maxHitPoints, ac: c.armorClass || 10, initiative: pcInit, speed: baseSpeed(c.race), prone: false },
    enemies, classCombat: {}, log: [], encounterNote: opts.encounterNote, rating: opts.rating, xpEarned: 0,
    screenNotes: ["encounter_math", ...(opts.surprise && opts.surprise !== "none" ? ["surprise"] : [])],
  };
  const order = [`${c.name} ${pcInit}`, ...enemies.map((e) => `${e.name} ${e.initiative}`)];
  s.log.push({ round: 1, who: "system", text: "Roll initiative!", detail: [opts.encounterNote, `Initiative (d20 + Dex): ${order.join(", ")}.`] });
  if (s.surprise === "party_surprised") s.log.push({ round: 1, who: "system", text: "You are surprised: you can't act in the first round." });
  if (s.surprise === "enemy_surprised") s.log.push({ round: 1, who: "system", text: "They are surprised: they can't act in the first round." });
  if (c.hitPoints <= 0) {
    s.status = "lost";
    s.log.push({ round: 1, who: "system", text: `${c.name} is in no state to fight (0 HP). Rest first.` });
    return s;
  }
  advanceToPlayer(s, c, dice, "start");
  return s;
}

// ── monster turns ─────────────────────────────────────────────────────────────

function activeEnemies(s: SkirmishState) {
  return s.enemies.filter((e) => e.status === "active");
}

function monsterTurn(s: SkirmishState, e: SkirmishEnemy, c: SkirmishCharacter, dice: Dice) {
  if (e.status !== "active" || s.status !== "active") return;
  const detail: string[] = [];
  const allies = activeEnemies(s).filter((x) => x.id !== e.id).length;
  let dealt = 0;
  for (const atk of e.attacks) {
    if (s.pc.hp <= 0) break;
    let adv = 0, dis = 0;
    const why: string[] = [];
    if (e.traits.includes("pack_tactics") && allies > 0) { adv++; why.push("Pack Tactics"); }
    if (s.pc.prone) { adv++; why.push("you're prone"); }
    if (s.classCombat.reckless) { adv++; why.push("you attacked recklessly"); }
    if (s.classCombat.dodging) { dis++; why.push("you're dodging"); }
    if (s.classCombat.hidden) { dis++; why.push("it can't see you"); }
    if (e.mocked) { dis++; why.push("Vicious Mockery"); e.mocked = false; }
    const mode = combineRollMode(adv, dis);
    const rolls = mode === "normal" ? [dice.d(20)] : [dice.d(20), dice.d(20)];
    const kept = mode === "advantage" ? Math.max(...rolls) : mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
    const crit = kept === 20;
    const total = kept + atk.bonus;
    const hit = crit || (kept !== 1 && total >= s.pc.ac);
    const rollText = rolls.length > 1 ? `2d20 ${mode} (${rolls.join(", ")} → ${kept}; ${why.join(", ")})` : `d20 (${kept})`;
    if (!hit) {
      detail.push(`${atk.name}: ${rollText} + ${atk.bonus} = ${total} vs AC ${s.pc.ac}: miss.`);
      continue;
    }
    const dmg = rollExpr(atk.damage, dice, crit);
    let amount = dmg.total;
    if (/slashing|piercing|bludgeoning/.test(atk.damageType)) {
      const raged = rageAdjustedDamage(amount, s.classCombat);
      if (raged !== amount) detail.push(`Rage halves ${atk.damageType} damage.`);
      amount = raged;
    }
    s.pc.hp = Math.max(0, s.pc.hp - amount);
    dealt += amount;
    detail.push(`${atk.name}: ${rollText} + ${atk.bonus} = ${total} vs AC ${s.pc.ac}: ${crit ? "CRITICAL HIT" : "hit"}, ${dmg.text} = ${amount} ${atk.damageType}.`);
    if (atk.poison && s.pc.hp > 0) {
      const save = rollSave(c, "constitution", atk.poison.dc, { d20: () => dice.d(20) });
      const p = rollExpr(atk.poison.damage, dice, false);
      const pd = save.success ? Math.floor(p.total / 2) : p.total;
      s.pc.hp = Math.max(0, s.pc.hp - pd);
      dealt += pd;
      detail.push(`Poison: ${save.text}. ${p.text} poison, ${save.success ? "halved to " : ""}${pd}.`);
    }
    if (atk.knockdownDC && s.pc.hp > 0 && !s.pc.prone) {
      const save = rollSave(c, "strength", atk.knockdownDC, { d20: () => dice.d(20) });
      detail.push(`Knockdown: ${save.text}.${save.success ? "" : " You're knocked prone."}`);
      if (!save.success) s.pc.prone = true;
    }
  }
  const verb = dealt > 0 ? `hits you for ${dealt}` : "misses";
  s.log.push({ round: s.round, who: "enemy", text: `${e.name} ${verb}. (${s.pc.hp}/${s.pc.maxHp} HP)`, detail });
  if (s.pc.hp <= 0) {
    s.status = "lost";
    s.screenNotes = [...(s.screenNotes ?? []), "knock_out"];
    const why = e.creatureType === "humanoid"
      ? "They knock you out rather than finish you, and help themselves to what they want"
      : "Once you stop moving, it loses interest and leaves you";
    s.log.push({ round: s.round, who: "system", text: `${s.pc.name} falls unconscious. ${why}. You wake later, battered, with 1 HP.` });
  }
}

/** Monsters act until it's the character's turn again (or the fight ends). */
function advanceToPlayer(s: SkirmishState, c: SkirmishCharacter, dice: Dice, from: "start" | "after_player") {
  const before = (e: SkirmishEnemy) => e.initiative > s.pc.initiative;
  const enemySkipsRound1 = s.surprise === "enemy_surprised";
  if (from === "start") {
    if (!(enemySkipsRound1)) for (const e of s.enemies.filter(before)) monsterTurn(s, e, c, dice);
    if (s.surprise !== "party_surprised" || s.status !== "active") return;
    // Surprised: the character's first turn passes.
    from = "after_player";
  }
  if (s.status !== "active") return;
  if (!(s.round === 1 && enemySkipsRound1)) for (const e of s.enemies.filter((x) => !before(x))) monsterTurn(s, e, c, dice);
  if (s.status !== "active") return;
  s.round += 1;
  // Start of the character's round: Rage ends early if they neither attacked nor were hit; we keep it simple and let it run its minute.
  for (const e of s.enemies.filter(before)) monsterTurn(s, e, c, dice);
}

// ── the character's turn ──────────────────────────────────────────────────────

export interface PlayerTurn {
  action: ActionKind | "spell" | "hide";
  bonus?: BonusKind | null;
  targetId?: string | null;
  spellId?: string | null;
  slotLevel?: number | null;
  /** Bonus-action spell (Healing Word), cast before the action. */
  bonusSpellId?: string | null;
  bonusSlotLevel?: number | null;
  reckless?: boolean;
  actionSurge?: boolean;
  smiteSlot?: number | null;
  /** With Dash or Disengage: leave the fight. */
  flee?: boolean;
}

export interface TurnEffects {
  featureUses: Record<string, number>;
  slotsUsed: number[];
  rulesFired: string[];
}

export interface TurnContext {
  features: CharacterFeatureState[];
  slotFree: (level: number) => boolean;
  knownSpells?: string[] | null;
  dice?: Dice;
}

function damageEnemy(s: SkirmishState, e: SkirmishEnemy, amount: number, type: string, crit: boolean, dice: Dice, detail: string[]) {
  let dmg = amount;
  if (e.traits.includes("vulnerable_bludgeoning") && type === "bludgeoning") {
    dmg *= 2;
    detail.push(`${e.name} is vulnerable to bludgeoning: damage doubled to ${dmg}.`);
  }
  e.hp = Math.max(0, e.hp - dmg);
  if (e.hp === 0 && e.traits.includes("undead_fortitude") && type !== "radiant" && !crit) {
    const dc = 5 + dmg;
    const r = dice.d(20) + 1;
    if (r >= dc) {
      e.hp = 1;
      detail.push(`Undead Fortitude: Con save ${r} vs DC ${dc}. ${e.name} drops to 1 HP instead of falling.`);
    } else {
      detail.push(`Undead Fortitude: Con save ${r} vs DC ${dc}: fails.`);
    }
  }
  if (e.hp === 0) {
    e.status = "down";
    detail.push(`${e.name} falls.`);
  } else if (!e.moraleChecked && !e.traits.includes("fearless") && e.hp < e.maxHp / 2) {
    e.moraleChecked = true;
    const r = dice.d(20);
    if (r < 10) {
      e.status = "fled";
      if (!(s.screenNotes ?? []).includes("morale")) s.screenNotes = [...(s.screenNotes ?? []), "morale"];
      detail.push(`Morale: ${e.name} is badly hurt (Wisdom save ${r} vs DC 10) and flees${e.traits.includes("nimble_escape") ? ", disengaging nimbly" : ""}.`);
    } else {
      detail.push(`Morale: ${e.name} is badly hurt but holds (Wisdom save ${r} vs DC 10).`);
    }
  }
}

function castSpell(s: SkirmishState, c: SkirmishCharacter, spell: SkirmishSpell, slotLevel: number | null, target: SkirmishEnemy | undefined, dice: Dice, detail: string[]): string {
  const lvl = spell.level === 0 ? 0 : Math.max(spell.level, slotLevel ?? spell.level);
  const upcast = Math.max(0, lvl - spell.level);
  const scale = (expr: string, extraPerLevel: number) => {
    const m = expr.match(/^(\d+)d(\d+)(.*)$/);
    if (!m) return expr;
    const n = spell.level === 0 ? parseInt(m[1]) * cantripDiceCount(c.level) : parseInt(m[1]) + extraPerLevel * upcast;
    return `${n}d${m[2]}${m[3]}`;
  };
  const slotNote = lvl > 0 ? ` (level ${lvl} slot)` : "";
  if (spell.shape === "heal") {
    const roll = rollExpr(scale(spell.dice, 1), dice);
    const mod = spell.addMod ? castingMod(c, c.class) : 0;
    const healed = Math.min(s.pc.maxHp - s.pc.hp, roll.total + mod);
    s.pc.hp += healed;
    detail.push(`${spell.name}${slotNote}: ${roll.text} + ${mod} = ${roll.total + mod}, you regain ${healed} HP.`);
    return `${c.name} casts ${spell.name} and regains ${healed} HP.`;
  }
  if (!target) return `${c.name} casts ${spell.name}, but there's no one to target.`;
  if (spell.shape === "auto") {
    const darts = (spell.darts ?? 1) + upcast;
    let total = 0;
    const parts: string[] = [];
    for (let i = 0; i < darts; i++) { const r = rollExpr(spell.dice, dice); total += r.total; parts.push(String(r.total)); }
    detail.push(`${spell.name}${slotNote}: ${darts} darts (${parts.join(" + ")}) = ${total} ${spell.damageType}, automatically hitting ${target.name}.`);
    damageEnemy(s, target, total, spell.damageType ?? "force", false, dice, detail);
    return `${c.name}'s ${spell.name} strikes ${target.name} for ${total}.`;
  }
  if (spell.shape === "attack") {
    const bonus = spellAttackBonus(c, c.class);
    const adv = s.classCombat.hidden ? 1 : 0;
    const rolls = adv ? [dice.d(20), dice.d(20)] : [dice.d(20)];
    const kept = Math.max(...rolls);
    const crit = kept === 20;
    const total = kept + bonus;
    const hit = crit || (kept !== 1 && total >= target.ac);
    s.classCombat.hidden = false;
    const rt = rolls.length > 1 ? `2d20 advantage (${rolls.join(", ")} → ${kept})` : `d20 (${kept})`;
    if (!hit) {
      detail.push(`${spell.name}${slotNote}: spell attack ${rt} + ${bonus} = ${total} vs AC ${target.ac}: miss.`);
      return `${c.name}'s ${spell.name} misses ${target.name}.`;
    }
    const dmg = rollExpr(scale(spell.dice, 1), dice, crit);
    detail.push(`${spell.name}${slotNote}: spell attack ${rt} + ${bonus} = ${total} vs AC ${target.ac}: ${crit ? "CRITICAL HIT" : "hit"}, ${dmg.text} = ${dmg.total} ${spell.damageType}.`);
    damageEnemy(s, target, dmg.total, spell.damageType ?? "force", crit, dice, detail);
    return `${c.name}'s ${spell.name} hits ${target.name} for ${dmg.total}.`;
  }
  // Saving throw spells. Monster save bonus: Dex uses its Dex modifier, others +0 (SRD stat blocks list few save proficiencies at these CRs).
  const dc = spellSaveDC(c, c.class);
  const saveMod = spell.save === "dexterity" ? target.dexMod : 0;
  const r = dice.d(20);
  const saved = r + saveMod >= dc;
  const dmg = rollExpr(scale(spell.dice, 1), dice);
  const amount = saved ? (spell.halfOnSave ? Math.floor(dmg.total / 2) : 0) : dmg.total;
  detail.push(`${spell.name}${slotNote}: ${target.name} makes a ${spell.save} save, d20 (${r}) ${saveMod >= 0 ? "+" : "−"} ${Math.abs(saveMod)} = ${r + saveMod} vs DC ${dc}: ${saved ? "saves" : "fails"}. ${dmg.text} ${spell.damageType}${saved ? (spell.halfOnSave ? `, halved to ${amount}` : ", no damage") : ` = ${amount}`}.`);
  if (amount > 0) damageEnemy(s, target, amount, spell.damageType ?? "force", false, dice, detail);
  if (!saved && spell.mockery && target.status === "active") target.mocked = true;
  return amount > 0 ? `${c.name}'s ${spell.name} deals ${amount} to ${target.name}.` : `${target.name} shrugs off ${spell.name}.`;
}

/**
 * Resolve the character's turn, then let the monsters act until it is the
 * character's turn again. Returns the new state and what to persist.
 */
export function playerTurn(prev: SkirmishState, c: SkirmishCharacter, req: PlayerTurn, ctx: TurnContext): { state: SkirmishState; effects: TurnEffects; error?: string } {
  const dice = ctx.dice ?? defaultDice;
  const s: SkirmishState = JSON.parse(JSON.stringify(prev));
  const effects: TurnEffects = { featureUses: {}, slotsUsed: [], rulesFired: [] };
  if (s.status !== "active") return { state: s, effects, error: "This fight is over." };
  const detail: string[] = [];
  const said: string[] = [];
  const char = { ...c, hitPoints: s.pc.hp };

  if (s.pc.prone) {
    s.pc.prone = false;
    detail.push("You stand up, using half your movement.");
  }

  const live = activeEnemies(s);
  const target = live.find((e) => e.id === req.targetId) ?? live[0];
  const spells = spellsFor(c.class, c.level, ctx.knownSpells);

  // Bonus-action spell first. If you cast one, your action can only be a cantrip (PHB, "Bonus Action" casting).
  if (req.bonusSpellId) {
    const sp = spells.find((x) => x.id === req.bonusSpellId && x.bonusAction);
    if (!sp) return { state: prev, effects, error: "You can't cast that as a bonus action." };
    if (req.bonus) return { state: prev, effects, error: "You only get one bonus action." };
    if (req.action === "spell") {
      const main = SPELLS[req.spellId ?? ""];
      if (main && main.level > 0) return { state: prev, effects, error: "After a bonus-action spell, your action can only be a cantrip." };
    }
    const lvl = Math.max(sp.level, req.bonusSlotLevel ?? sp.level);
    if (sp.level > 0) {
      if (!ctx.slotFree(lvl)) return { state: prev, effects, error: `No level ${lvl} spell slots left.` };
      effects.slotsUsed.push(lvl);
    }
    said.push(castSpell(s, char, sp, lvl, target, dice, detail));
  }

  let fleeAllowed = false;
  if (req.action === "spell") {
    const sp = spells.find((x) => x.id === req.spellId && !x.bonusAction);
    if (!sp) return { state: prev, effects, error: "You don't have that spell." };
    const lvl = sp.level === 0 ? 0 : Math.max(sp.level, req.slotLevel ?? sp.level);
    if (sp.level > 0) {
      const alreadyUsed = effects.slotsUsed.filter((x) => x === lvl).length;
      if (!ctx.slotFree(lvl) || alreadyUsed > 0 && !ctx.slotFree(lvl)) return { state: prev, effects, error: `No level ${lvl} spell slots left.` };
      effects.slotsUsed.push(lvl);
    }
    s.classCombat = { ...s.classCombat, dodging: false, reckless: false, disengaged: false };
    said.push(castSpell(s, char, sp, lvl, target, dice, detail));
  } else if (req.action === "hide") {
    s.classCombat = { ...s.classCombat, dodging: false, reckless: false, disengaged: false };
    const passive = Math.max(0, ...live.map((e) => e.passive));
    const r = rollSkill(char, "stealth", passive, { d20: () => dice.d(20) });
    s.classCombat.hidden = r.success;
    detail.push(`Hide: ${r.text.replace(`vs DC ${passive}`, `vs their best passive Perception ${passive}`)}.`);
    said.push(r.success ? `${c.name} slips out of sight.` : `${c.name} tries to hide but is spotted.`);
  } else {
    const view = s.enemies.map((e) => ({ name: e.name, ac: e.ac, currentHp: e.hp, status: e.status === "down" ? "defeated" : e.status === "fled" ? "fled" : "active", creatureType: e.creatureType }));
    const r: TurnResolution = resolveClassTurn(
      { action: req.action as ActionKind, bonus: req.bonus ?? null, targetName: target?.name ?? null, reckless: !!req.reckless, smiteSlot: req.smiteSlot ?? null, actionSurge: !!req.actionSurge },
      {
        character: { ...char, level: c.level || 1 } as any,
        features: ctx.features,
        combat: s.classCombat,
        enemies: view,
        allyEngaged: false,
        spellSlotsAvailable: ctx.slotFree,
        d: dice.d,
      },
    );
    if (!r.ok) return { state: prev, effects, error: r.error };
    s.classCombat = r.combat;
    detail.push(...r.breakdown);
    said.push(r.summary);
    effects.featureUses = r.featureUses;
    effects.rulesFired = r.rulesFired;
    if (r.spellSlotUsed) effects.slotsUsed.push(r.spellSlotUsed);
    if (r.healed) s.pc.hp = Math.min(s.pc.maxHp, s.pc.hp + r.healed);
    if (r.damageTotal > 0 && r.targetName) {
      const t = s.enemies.find((e) => e.name === r.targetName);
      if (t) damageEnemy(s, t, r.damageTotal, r.damageType, !!r.attackRoll?.isCritical, dice, detail);
    }
    fleeAllowed = req.action === "dash" || req.action === "disengage"
      || req.bonus === "cunning_dash" || req.bonus === "cunning_disengage" || req.bonus === "step_of_the_wind";
  }

  s.log.push({ round: s.round, who: "pc", text: said.filter(Boolean).join(" "), detail });

  // Fleeing
  if (req.flee) {
    if (!fleeAllowed) return { state: prev, effects, error: "To flee, take the Dash or Disengage action (or a bonus action that does)." };
    const fleeDetail: string[] = [];
    const disengaged = !!s.classCombat.disengaged;
    const dashed = req.action === "dash" || req.bonus === "cunning_dash" || (req.bonus === "step_of_the_wind");
    if (!disengaged) {
      fleeDetail.push("You run without disengaging: each enemy next to you gets an opportunity attack.");
      for (const e of activeEnemies(s)) {
        const single = { ...e, attacks: e.attacks.slice(0, 1) };
        monsterTurn(s, single as SkirmishEnemy, c, dice);
        if (s.status !== "active") return { state: s, effects };
      }
    }
    const mySpeed = s.pc.speed * (dashed ? 2 : 1);
    const faster = activeEnemies(s).filter((e) => e.speed > mySpeed);
    if (!faster.length) {
      s.status = "fled";
      fleeDetail.push(`Your speed this turn is ${mySpeed} ft; nothing here can keep up.`);
      s.log.push({ round: s.round, who: "system", text: "You get away.", detail: fleeDetail });
      return { state: s, effects };
    }
    const best = Math.max(...faster.map((e) => e.passive));
    const r = rollSkill(char, "stealth", best, { d20: () => dice.d(20) });
    fleeDetail.push(`${faster.map((e) => `${e.name} (${e.speed} ft)`).join(", ")} ${faster.length > 1 ? "are" : "is"} faster than your ${mySpeed} ft, so you have to lose them: ${r.text.replace(`vs DC ${best}`, `vs passive Perception ${best}`)}.`);
    if (r.success) {
      s.status = "fled";
      s.log.push({ round: s.round, who: "system", text: "You break line of sight and lose them.", detail: fleeDetail });
      return { state: s, effects };
    }
    s.log.push({ round: s.round, who: "system", text: "They run you down. The fight goes on.", detail: fleeDetail });
  }

  if (!activeEnemies(s).length) {
    s.status = "won";
    s.xpEarned = s.enemies.filter((e) => e.status !== "active").reduce((sum, e) => sum + e.xp, 0);
    const fled = s.enemies.filter((e) => e.status === "fled").length;
    s.log.push({ round: s.round, who: "system", text: `Victory! ${s.xpEarned} XP${fled ? ` (monsters that flee still count as defeated)` : ""}.` });
    return { state: s, effects };
  }

  advanceToPlayer(s, c, dice, "after_player");
  return { state: s, effects };
}

/** Which actions to offer, given the character (for the UI). */
export function turnOptions(c: SkirmishCharacter, knownSpells?: string[] | null) {
  return {
    spells: spellsFor(c.class, c.level, knownSpells).map((sp) => ({ id: sp.id, name: sp.name, level: sp.level, bonusAction: !!sp.bonusAction, text: sp.text })),
  };
}
