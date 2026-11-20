/**
 * SRD 5.1 class progression (CC-BY 4.0) — the rules data that level-ups,
 * features in play, rests and class combat actions are all computed from.
 * Engagement spec Phase 1.1. Data lives in shared/rules/classes/<class>.ts;
 * this module holds the types and the lookup helpers.
 *
 * Levels 1–10 are encoded first (the spec's scope); `maxEncodedLevel` lets
 * callers refuse a level-up past what the data covers instead of silently
 * granting nothing.
 */
import type { AbilityName } from "./abilities";
import { CLASS_DEFS } from "./classes";

export type FeatureKind = "passive" | "action" | "bonusAction" | "reaction" | "resource";
export type Recharge = "short" | "long";

/**
 * How many uses a limited feature has.
 * - number: fixed
 * - "profBonus": equal to proficiency bonus
 * - "classLevel": equal to class level (e.g. Ki points)
 * - "classLevelX5": 5 × class level (Lay on Hands pool, in HP)
 * - { ability, min, plus? }: ability modifier + `plus`, minimum `min`
 *   (Bardic Inspiration: CHA mod, min 1; Divine Sense: 1 + CHA mod, min 1)
 * - { byLevel }: table keyed by the class level at which the value starts
 *   (e.g. Rage {1:2, 3:3, 6:4}; Channel Divinity {2:1, 6:2})
 */
export type UsesMax =
  | number
  | "profBonus"
  | "classLevel"
  | "classLevelX5"
  | { ability: AbilityName; min: number; plus?: number }
  | { byLevel: Record<number, number> };

export interface ClassFeature {
  /** Stable snake_case id. Combat/rest code keys off these (see FEATURE_IDS). */
  id: string;
  name: string;
  /** One or two plain-language sentences using correct 5e vocabulary. */
  summary: string;
  kind: FeatureKind;
  uses?: { max: UsesMax; recharge: Recharge };
  /**
   * Values that grow with class level, keyed by the level they start at,
   * e.g. Sneak Attack {1:"1d6", 3:"2d6", 5:"3d6"}; Rage damage {1:"+2", 9:"+3"}.
   */
  scaling?: Record<number, string>;
}

export interface SubclassDef {
  id: string;
  name: string;
  /** One-line flavor pitch shown in the Level Up dialog's subclass step. */
  pitch: string;
  /** Features keyed by CLASS level gained. */
  features: Record<number, ClassFeature[]>;
}

export type CasterKind = "full" | "half" | "pact" | "none";

export interface SpellcastingDef {
  ability: AbilityName;
  kind: CasterKind;
  /** "prepared": choose from the whole class list each day (Cleric, Druid, Paladin, Wizard's spellbook prep). "known": fixed list (Bard, Ranger, Sorcerer, Warlock). */
  style: "prepared" | "known";
  /** Cantrips known, keyed by the class level the count starts at. Omit for classes with none. */
  cantripsKnown?: Record<number, number>;
  /** Spells known (known casters only), keyed by class level the count starts at. */
  spellsKnown?: Record<number, number>;
  /** Wizard only: spells added to the spellbook per level after 1st (2). */
  spellbookPerLevel?: number;
}

export interface ClassDef {
  name: string; // "Rogue"
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilities: AbilityName[];
  savingThrows: [AbilityName, AbilityName];
  /** Class level at which the subclass is chosen (1, 2 or 3). */
  subclassLevel: 1 | 2 | 3;
  /** What the class calls its subclass, e.g. "Roguish Archetype", "Divine Domain". */
  subclassLabel: string;
  /** The SRD subclass (the only one we can ship under the SRD license). */
  subclass: SubclassDef;
  /** Ability Score Improvement levels (4, 8, 12, 16, 19 + Fighter 6/14, Rogue 10). */
  asiLevels: number[];
  /** Base class features keyed by class level gained (ASIs are NOT listed here). */
  features: Record<number, ClassFeature[]>;
  spellcasting?: SpellcastingDef;
  /** Highest level the feature tables above are complete for. */
  maxEncodedLevel: number;
}

const norm = (s: string) => s.trim().toLowerCase();

export function getClassDef(className: string | null | undefined): ClassDef | undefined {
  if (!className) return undefined;
  return CLASS_DEFS[norm(className)];
}

/** Value of a level-keyed table at `level` (the entry with the highest key ≤ level). */
export function atLevel<T>(table: Record<number, T> | undefined, level: number): T | undefined {
  if (!table) return undefined;
  let best: T | undefined;
  let bestKey = -Infinity;
  for (const [k, v] of Object.entries(table)) {
    const key = Number(k);
    if (key <= level && key > bestKey) {
      best = v;
      bestKey = key;
    }
  }
  return best;
}

/** Features (base + subclass) gained at exactly `level`. */
export function featuresAtLevel(def: ClassDef, level: number, hasSubclass: boolean): ClassFeature[] {
  const base = def.features[level] ?? [];
  const sub = hasSubclass ? def.subclass.features[level] ?? [] : [];
  return [...base, ...sub];
}

/** Every feature a character of this class/level has (later entries with the same id replace earlier ones). */
export function allFeaturesThrough(def: ClassDef, level: number, hasSubclass: boolean): ClassFeature[] {
  const byId = new Map<string, ClassFeature>();
  for (let l = 1; l <= level; l++) {
    for (const f of featuresAtLevel(def, l, hasSubclass && l >= def.subclassLevel)) byId.set(f.id, f);
  }
  return Array.from(byId.values());
}

export function isAsiLevel(def: ClassDef, level: number): boolean {
  return def.asiLevels.includes(level);
}
