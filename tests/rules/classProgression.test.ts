/**
 * SRD 5.1 class progression data: every class's level 1–5 features, hit dice,
 * subclass levels, ASI levels and limited-use maths.
 *
 * Run with: npx tsx tests/rules/classProgression.test.ts
 */
import { CLASS_DEFS } from '../../shared/rules/classes';
import { allFeaturesThrough, featuresAtLevel, getClassDef } from '../../shared/rules/classProgression';
import { resolveUsesMax } from '../../shared/rules/leveling';

let failures = 0;
let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}
const ids = (cls: string, level: number, sub = false) =>
  featuresAtLevel(getClassDef(cls)!, level, sub).map((f) => f.id);
const has = (cls: string, level: number, id: string, sub = false) => ids(cls, level, sub).includes(id);

console.log('all twelve classes, levels 1–10');
check('12 classes', Object.keys(CLASS_DEFS).sort(), ['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard']);
for (const def of Object.values(CLASS_DEFS)) {
  check(`${def.name} encodes to 10`, def.maxEncodedLevel >= 10, true);
  check(`${def.name} ASI 4 and 8`, def.asiLevels.includes(4) && def.asiLevels.includes(8), true);
  check(`${def.name} lists no ASI feature`, allFeaturesThrough(def, 10, true).some((f) => f.id === 'ability_score_improvement'), false);
  for (const f of allFeaturesThrough(def, 10, true)) {
    if (!/^[a-z0-9_]+$/.test(f.id)) check(`${def.name} id ${f.id} is snake_case`, false, true);
    if (!f.summary || f.summary.length < 20) check(`${def.name} ${f.id} has a summary`, false, true);
  }
}

console.log('hit dice (SRD)');
const hd: Record<string, number> = { barbarian: 12, fighter: 10, paladin: 10, ranger: 10, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8, sorcerer: 6, wizard: 6 };
for (const [c, d] of Object.entries(hd)) check(`${c} d${d}`, getClassDef(c)!.hitDie, d);

console.log('subclass levels and SRD subclasses');
const sub: Record<string, [number, string]> = {
  barbarian: [3, 'berserker'], bard: [3, 'lore'], cleric: [1, 'life'], druid: [2, 'land'],
  fighter: [3, 'champion'], monk: [3, 'open_hand'], paladin: [3, 'devotion'], ranger: [3, 'hunter'],
  rogue: [3, 'thief'], sorcerer: [1, 'draconic'], warlock: [1, 'fiend'], wizard: [2, 'evocation'],
};
for (const [c, [lvl, name]] of Object.entries(sub)) {
  const def = getClassDef(c)!;
  check(`${c} subclass at ${lvl}`, def.subclassLevel, lvl);
  check(`${c} subclass is ${name}`, def.subclass.id.includes(name) || def.subclass.name.toLowerCase().replace(/ /g, '_').includes(name), true);
}
check('fighter ASI at 6', getClassDef('fighter')!.asiLevels.includes(6), true);
check('rogue ASI at 10', getClassDef('rogue')!.asiLevels.includes(10), true);
check('wizard no ASI at 6', getClassDef('wizard')!.asiLevels.includes(6), false);

console.log('L1–5 signature features');
const expect: [string, number, string, boolean?][] = [
  ['barbarian', 1, 'rage'], ['barbarian', 1, 'unarmored_defense'], ['barbarian', 2, 'reckless_attack'], ['barbarian', 2, 'danger_sense'],
  ['barbarian', 3, 'frenzy', true], ['barbarian', 5, 'extra_attack'], ['barbarian', 5, 'fast_movement'],
  ['bard', 1, 'bardic_inspiration'], ['bard', 2, 'jack_of_all_trades'], ['bard', 2, 'song_of_rest'], ['bard', 3, 'expertise'], ['bard', 3, 'cutting_words', true],
  ['cleric', 1, 'disciple_of_life', true], ['cleric', 2, 'channel_divinity'], ['cleric', 2, 'preserve_life', true], ['cleric', 5, 'destroy_undead'],
  ['druid', 2, 'wild_shape'], ['druid', 2, 'natural_recovery', true],
  ['fighter', 1, 'fighting_style'], ['fighter', 1, 'second_wind'], ['fighter', 2, 'action_surge'], ['fighter', 3, 'improved_critical', true], ['fighter', 5, 'extra_attack'],
  ['monk', 1, 'martial_arts'], ['monk', 1, 'unarmored_defense'], ['monk', 2, 'ki'], ['monk', 2, 'flurry_of_blows'], ['monk', 3, 'deflect_missiles'], ['monk', 3, 'open_hand_technique', true], ['monk', 5, 'stunning_strike'], ['monk', 5, 'extra_attack'],
  ['paladin', 1, 'divine_sense'], ['paladin', 1, 'lay_on_hands'], ['paladin', 2, 'divine_smite'], ['paladin', 2, 'fighting_style'], ['paladin', 3, 'divine_health'], ['paladin', 5, 'extra_attack'],
  ['ranger', 1, 'favored_enemy'], ['ranger', 1, 'natural_explorer'], ['ranger', 2, 'fighting_style'], ['ranger', 3, 'hunters_prey', true], ['ranger', 5, 'extra_attack'],
  ['rogue', 1, 'expertise'], ['rogue', 1, 'sneak_attack'], ['rogue', 1, 'thieves_cant'], ['rogue', 2, 'cunning_action'], ['rogue', 3, 'fast_hands', true], ['rogue', 3, 'second_story_work', true], ['rogue', 5, 'uncanny_dodge'],
  ['sorcerer', 1, 'draconic_resilience', true], ['sorcerer', 2, 'font_of_magic'], ['sorcerer', 3, 'metamagic'],
  ['warlock', 1, 'pact_magic'], ['warlock', 1, 'dark_ones_blessing', true], ['warlock', 2, 'eldritch_invocations'], ['warlock', 3, 'pact_boon'],
  ['wizard', 1, 'arcane_recovery'], ['wizard', 2, 'sculpt_spells', true],
];
for (const [c, l, id, s] of expect) check(`${c} ${l}: ${id}`, has(c, l, id, !!s), true);
check('no Extra Attack for rogue', allFeaturesThrough(getClassDef('rogue')!, 10, true).some((f) => f.id === 'extra_attack'), false);
check('no Extra Attack for wizard', allFeaturesThrough(getClassDef('wizard')!, 10, true).some((f) => f.id === 'extra_attack'), false);

console.log('limited uses');
const ctx = (classLevel: number, cha = 10, wis = 10) => ({ classLevel, abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: wis, charisma: cha } });
const feat = (c: string, id: string, lvl: number) => allFeaturesThrough(getClassDef(c)!, lvl, true).find((f) => f.id === id)!;
check('rage 2 uses at 1', resolveUsesMax(feat('barbarian', 'rage', 1).uses!.max, ctx(1)), 2);
check('rage 3 uses at 3', resolveUsesMax(feat('barbarian', 'rage', 3).uses!.max, ctx(3)), 3);
check('rage 4 uses at 6', resolveUsesMax(feat('barbarian', 'rage', 6).uses!.max, ctx(6)), 4);
check('rage recharges on long rest', feat('barbarian', 'rage', 1).uses!.recharge, 'long');
check('second wind short rest', feat('fighter', 'second_wind', 1).uses!.recharge, 'short');
check('action surge 1 use', resolveUsesMax(feat('fighter', 'action_surge', 2).uses!.max, ctx(2)), 1);
check('ki = monk level', resolveUsesMax(feat('monk', 'ki', 5).uses!.max, ctx(5)), 5);
check('lay on hands = 5 x level', resolveUsesMax(feat('paladin', 'lay_on_hands', 3).uses!.max, ctx(3)), 15);
check('divine sense = 1 + CHA mod', resolveUsesMax(feat('paladin', 'divine_sense', 1).uses!.max, ctx(1, 16)), 4);
check('bardic inspiration = CHA mod', resolveUsesMax(feat('bard', 'bardic_inspiration', 1).uses!.max, ctx(1, 16)), 3);
check('bardic inspiration min 1', resolveUsesMax(feat('bard', 'bardic_inspiration', 1).uses!.max, ctx(1, 8)), 1);
check('bardic inspiration long rest at 4', feat('bard', 'bardic_inspiration', 4).uses!.recharge, 'long');
check('bardic inspiration short rest at 5 (Font)', feat('bard', 'bardic_inspiration', 5).uses!.recharge, 'short');
check('cleric channel divinity 1 at 2', resolveUsesMax(feat('cleric', 'channel_divinity', 2).uses!.max, ctx(2)), 1);
check('cleric channel divinity 2 at 6', resolveUsesMax(feat('cleric', 'channel_divinity', 6).uses!.max, ctx(6)), 2);
check('sneak attack 1d6 at 1', feat('rogue', 'sneak_attack', 1).scaling?.[1], '1d6');
check('sneak attack 3d6 at 5', feat('rogue', 'sneak_attack', 5).scaling?.[5], '3d6');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
