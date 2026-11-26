/**
 * Battlefield features (danger spec Phase 4.2): one to three things in each
 * fight that give the player a real tactical choice besides "attack the
 * nearest enemy". Every one is a 5e rule, resolved in code:
 *
 *  - cover: fight from behind it for +2 AC (half cover) or +5 AC
 *    (three-quarters cover) against the enemies' attacks this round (SRD "Cover");
 *  - push hazard: Shove an enemy into it (Athletics contested by the
 *    target's Athletics or Acrobatics, SRD "Shoving a Creature"), and it
 *    takes the hazard's damage;
 *  - interactable: Use an Object (your action) with an ability check, and
 *    up to two enemies make a Dexterity save or take damage. DC and damage
 *    follow the DMG's improvised-damage guidance (setback 1d10 / dangerous 2d10
 *    at levels 1-4, doubling per tier).
 */

export type FeatureKind = "cover" | "push_hazard" | "interactable";

export interface BattlefieldFeature {
  id: string;
  name: string;
  kind: FeatureKind;
  /** One line the player reads on the button. */
  detail: string;
  cover?: 2 | 5;
  /** Push hazard or interactable damage. */
  damage?: string;
  damageType?: string;
  /** Interactable: the check to set it off, and the save the enemies make. */
  check?: { skill: string; dc: number };
  save?: { ability: "dexterity"; dc: number };
  /** Interactables are spent once used. */
  spent?: boolean;
}

type Terrainish = "crypt" | "cave" | "forest" | "swamp" | "coast" | "desert" | "mountain" | "snow" | "town" | "ruin" | "road";

const T = (f: Omit<BattlefieldFeature, "detail"> & { detail?: string }) => f;

const TABLE: Record<Terrainish, ReturnType<typeof T>[]> = {
  crypt: [
    T({ id: "sarcophagus", name: "Stone sarcophagus", kind: "cover", cover: 5 }),
    T({ id: "pillar", name: "Crumbling pillar", kind: "interactable", check: { skill: "athletics", dc: 13 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "open_grave", name: "Open grave", kind: "push_hazard", damage: "1d6", damageType: "bludgeoning" }),
  ],
  cave: [
    T({ id: "boulder", name: "Boulder", kind: "cover", cover: 2 }),
    T({ id: "stalactites", name: "Loose stalactites", kind: "interactable", check: { skill: "athletics", dc: 13 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "piercing" }),
    T({ id: "chasm", name: "Edge of a drop", kind: "push_hazard", damage: "2d6", damageType: "bludgeoning" }),
  ],
  forest: [
    T({ id: "tree", name: "Thick oak", kind: "cover", cover: 5 }),
    T({ id: "deadfall", name: "Dead tree, ready to fall", kind: "interactable", check: { skill: "athletics", dc: 14 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "thorns", name: "Thorn thicket", kind: "push_hazard", damage: "1d8", damageType: "piercing" }),
  ],
  swamp: [
    T({ id: "stump", name: "Rotten stump", kind: "cover", cover: 2 }),
    T({ id: "sinkhole", name: "Sucking mire", kind: "push_hazard", damage: "1d6", damageType: "bludgeoning" }),
    T({ id: "swamp_gas", name: "Pocket of swamp gas", kind: "interactable", check: { skill: "sleight_of_hand", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "fire" }),
  ],
  coast: [
    T({ id: "crates", name: "Stacked crates", kind: "cover", cover: 2 }),
    T({ id: "rigging", name: "Cargo net on a rope", kind: "interactable", check: { skill: "athletics", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "water", name: "The water's edge", kind: "push_hazard", damage: "1d6", damageType: "bludgeoning" }),
  ],
  desert: [
    T({ id: "dune", name: "Dune ridge", kind: "cover", cover: 2 }),
    T({ id: "rockpile", name: "Balanced rocks", kind: "interactable", check: { skill: "athletics", dc: 13 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "sand_pit", name: "Sinking sand", kind: "push_hazard", damage: "1d6", damageType: "bludgeoning" }),
  ],
  mountain: [
    T({ id: "outcrop", name: "Rock outcrop", kind: "cover", cover: 5 }),
    T({ id: "scree", name: "Loose scree above", kind: "interactable", check: { skill: "athletics", dc: 13 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "ledge", name: "Ledge over a drop", kind: "push_hazard", damage: "2d6", damageType: "bludgeoning" }),
  ],
  snow: [
    T({ id: "drift", name: "Snowdrift wall", kind: "cover", cover: 2 }),
    T({ id: "icicles", name: "Hanging icicles", kind: "interactable", check: { skill: "athletics", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "piercing" }),
    T({ id: "thin_ice", name: "Thin ice", kind: "push_hazard", damage: "1d10", damageType: "cold" }),
  ],
  town: [
    T({ id: "table", name: "Overturned table", kind: "cover", cover: 2 }),
    T({ id: "chandelier", name: "Chandelier on a rope", kind: "interactable", check: { skill: "sleight_of_hand", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "hearth", name: "Roaring hearth", kind: "push_hazard", damage: "1d10", damageType: "fire" }),
    T({ id: "lamp_oil", name: "Lamp oil and a lantern", kind: "interactable", check: { skill: "sleight_of_hand", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "fire" }),
  ],
  ruin: [
    T({ id: "wall", name: "Broken wall", kind: "cover", cover: 5 }),
    T({ id: "arch", name: "Cracked archway", kind: "interactable", check: { skill: "athletics", dc: 14 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "brazier", name: "Burning brazier", kind: "push_hazard", damage: "1d10", damageType: "fire" }),
  ],
  road: [
    T({ id: "wagon", name: "Wagon", kind: "cover", cover: 5 }),
    T({ id: "barrels", name: "Barrels on a slope", kind: "interactable", check: { skill: "athletics", dc: 12 }, save: { ability: "dexterity", dc: 13 }, damage: "2d10", damageType: "bludgeoning" }),
    T({ id: "campfire", name: "Campfire", kind: "push_hazard", damage: "1d10", damageType: "fire" }),
  ],
};

function describe(f: BattlefieldFeature): string {
  if (f.kind === "cover") return `Fight from behind it: +${f.cover} AC against attacks this round (${f.cover === 5 ? "three-quarters" : "half"} cover).`;
  if (f.kind === "push_hazard") return `Shove an enemy into it (Athletics vs their Athletics or Acrobatics): ${f.damage} ${f.damageType} damage.`;
  return `Use an Object: ${f.check!.skill.replace(/_/g, " ")} DC ${f.check!.dc} to set it off; up to two enemies take ${f.damage} ${f.damageType} (Dexterity save DC ${f.save!.dc} for half).`;
}

/** Scale DMG improvised damage by level tier (1-4, 5-10, 11+). */
function scaleDamage(expr: string, level: number): string {
  const m = expr.match(/^(\d+)d(\d+)$/);
  if (!m) return expr;
  const mult = level >= 11 ? 4 : level >= 5 ? 2 : 1;
  return `${Number(m[1]) * mult}d${m[2]}`;
}

/** One cover, plus one or two others, for a fight in this terrain. */
export function pickBattlefield(terrain: string, level: number, rng: () => number = Math.random): BattlefieldFeature[] {
  const table = TABLE[(terrain as Terrainish)] ?? TABLE.road;
  const cover = table.filter((f) => f.kind === "cover");
  const others = table.filter((f) => f.kind !== "cover");
  const out: BattlefieldFeature[] = [];
  if (cover.length) out.push(cover[Math.floor(rng() * cover.length)] as BattlefieldFeature);
  const shuffled = [...others].sort(() => rng() - 0.5);
  out.push(...(shuffled.slice(0, rng() < 0.5 ? 1 : 2) as BattlefieldFeature[]));
  return out.map((f) => {
    const g: BattlefieldFeature = { ...f, damage: f.damage ? scaleDamage(f.damage, level) : undefined };
    return { ...g, detail: describe(g) };
  });
}

export function battlefieldPromptLine(features: BattlefieldFeature[]): string {
  const live = features.filter((f) => !f.spent);
  if (!live.length) return "";
  return `BATTLEFIELD (the game resolves these; mention them so the player knows they're there): ${live.map((f) => f.name).join("; ")}.`;
}

interface Dice { d: (n: number) => number }

function rollExpr(expr: string, dice: Dice): { total: number; text: string } {
  const m = expr.match(/^(\d+)d(\d+)$/);
  if (!m) return { total: 0, text: expr };
  const rolls = Array.from({ length: Number(m[1]) }, () => dice.d(Number(m[2])));
  const total = rolls.reduce((a, b) => a + b, 0);
  return { total, text: `${expr} (${rolls.join("+")}) = ${total}` };
}

export interface FeatureUseResult {
  ok: boolean;
  error?: string;
  summary: string;
  breakdown: string[];
  /** Damage dealt to enemies by name. */
  damage: { name: string; amount: number; damageType: string }[];
  /** Cover bonus to the player's AC for the enemies' attacks this round. */
  cover: 0 | 2 | 5;
  /** The feature is used up. */
  spent: boolean;
  usesAction: boolean;
}

export interface FeatureEnemy { name: string; dexMod?: number; strMod?: number; status?: string; currentHp?: number }

/**
 * Resolve using a feature. `checkTotal(skill)` rolls the player's check and
 * returns { roll, total, text }; enemies' saves use their Dex modifier.
 */
export function useFeature(
  f: BattlefieldFeature | undefined,
  opts: {
    targetName?: string | null;
    enemies: FeatureEnemy[];
    check: (skill: string) => { roll: number; total: number; text: string };
    dice: Dice;
  },
): FeatureUseResult {
  const none = (error: string): FeatureUseResult => ({ ok: false, error, summary: "", breakdown: [], damage: [], cover: 0, spent: false, usesAction: false });
  if (!f) return none("That isn't here.");
  if (f.spent) return none(`The ${f.name.toLowerCase()} has already been used.`);
  const live = opts.enemies.filter((e) => !["defeated", "fled", "surrendered", "evaded"].includes(String(e.status)) && (e.currentHp ?? 1) > 0);

  if (f.kind === "cover") {
    return {
      ok: true, summary: `You fight from behind the ${f.name.toLowerCase()}.`,
      breakdown: [`Cover: +${f.cover} AC against the enemies' attacks this round (${f.cover === 5 ? "three-quarters" : "half"} cover). Moving into cover is part of your movement, so you still have your action.`],
      damage: [], cover: f.cover ?? 2, spent: false, usesAction: false,
    };
  }

  if (f.kind === "push_hazard") {
    const target = live.find((e) => e.name === opts.targetName) ?? live[0];
    if (!target) return none("There's no one to shove.");
    const mine = opts.check("athletics");
    const theirMod = Math.max(target.strMod ?? 0, target.dexMod ?? 0);
    const theirRoll = opts.dice.d(20);
    const won = mine.total >= theirRoll + theirMod;
    const breakdown = [`Shove (your action): ${mine.text} vs ${target.name}'s ${(target.dexMod ?? 0) >= (target.strMod ?? 0) ? "Acrobatics" : "Athletics"} d20 (${theirRoll}) ${theirMod >= 0 ? "+" : "−"} ${Math.abs(theirMod)} = ${theirRoll + theirMod}: ${won ? "you win the contest" : "they hold their ground"}.`];
    if (!won) return { ok: true, summary: `${target.name} braces and won't be moved.`, breakdown, damage: [], cover: 0, spent: false, usesAction: true };
    const dmg = rollExpr(f.damage ?? "1d6", opts.dice);
    breakdown.push(`Into the ${f.name.toLowerCase()}: ${dmg.text} ${f.damageType} damage.`);
    return { ok: true, summary: `You drive ${target.name} into the ${f.name.toLowerCase()}!`, breakdown, damage: [{ name: target.name, amount: dmg.total, damageType: f.damageType ?? "bludgeoning" }], cover: 0, spent: false, usesAction: true };
  }

  // Interactable
  const mine = opts.check(f.check!.skill);
  const breakdown = [`Use an Object (your action): ${mine.text} vs DC ${f.check!.dc}: ${mine.total >= f.check!.dc ? "success" : "failure"}.`];
  if (mine.total < f.check!.dc) {
    return { ok: true, summary: `You go for the ${f.name.toLowerCase()}, but it doesn't give.`, breakdown, damage: [], cover: 0, spent: false, usesAction: true };
  }
  const first = live.find((e) => e.name === opts.targetName) ?? live[0];
  const caught = [first, ...live.filter((e) => e !== first)].filter(Boolean).slice(0, 2) as FeatureEnemy[];
  const dmg = rollExpr(f.damage ?? "2d10", opts.dice);
  breakdown.push(`${f.name}: ${dmg.text} ${f.damageType} damage; Dexterity save DC ${f.save!.dc} for half.`);
  const damage: FeatureUseResult["damage"] = [];
  for (const e of caught) {
    const r = opts.dice.d(20);
    const total = r + (e.dexMod ?? 0);
    const saved = total >= f.save!.dc;
    const amount = saved ? Math.floor(dmg.total / 2) : dmg.total;
    breakdown.push(`${e.name}: Dexterity save d20 (${r}) ${(e.dexMod ?? 0) >= 0 ? "+" : "−"} ${Math.abs(e.dexMod ?? 0)} = ${total}: ${saved ? "half" : "full"}, ${amount} damage.`);
    damage.push({ name: e.name, amount, damageType: f.damageType ?? "bludgeoning" });
  }
  return { ok: true, summary: `The ${f.name.toLowerCase()} comes down on ${caught.map((e) => e.name).join(" and ")}!`, breakdown, damage, cover: 0, spent: true, usesAction: true };
}
