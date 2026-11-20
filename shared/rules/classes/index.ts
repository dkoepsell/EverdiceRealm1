/** SRD 5.1 class definitions (CC-BY 4.0), keyed by lowercase class name. */
import type { ClassDef } from "../classProgression";
import { BARBARIAN } from "./barbarian";
import { BARD } from "./bard";
import { CLERIC } from "./cleric";
import { DRUID } from "./druid";
import { FIGHTER } from "./fighter";
import { MONK } from "./monk";
import { PALADIN } from "./paladin";
import { RANGER } from "./ranger";
import { ROGUE } from "./rogue";
import { SORCERER } from "./sorcerer";
import { WARLOCK } from "./warlock";
import { WIZARD } from "./wizard";

export const CLASS_DEFS: Record<string, ClassDef> = {
  barbarian: BARBARIAN,
  bard: BARD,
  cleric: CLERIC,
  druid: DRUID,
  fighter: FIGHTER,
  monk: MONK,
  paladin: PALADIN,
  ranger: RANGER,
  rogue: ROGUE,
  sorcerer: SORCERER,
  warlock: WARLOCK,
  wizard: WIZARD,
};
