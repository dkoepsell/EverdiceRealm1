/**
 * Exploration combat (server/play/skirmish) and the DMG encounter math
 * (shared/rules/monsters). Dice are fixed so every number can be checked.
 *
 * Run with: npx tsx tests/skirmish.test.ts
 */
import { MONSTERS, THEME_ROSTERS, xpThresholds, encounterMultiplier, adjustedXp, rateEncounter, buildEncounter, xpForCr } from '../shared/rules/monsters';
import { startSkirmish, playerTurn, rollExpr, type SkirmishCharacter, type SkirmishState } from '../server/play/skirmish/engine';
import { spellsFor, spellAttackBonus, spellSaveDC } from '../server/play/skirmish/spells';
import { buildFeatureState } from '../shared/rules/leveling';
import { getClassDef } from '../shared/rules/classProgression';

let failures = 0;
let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
  else console.log(`  ✓ ${name}`);
}
const ok = (name: string, cond: boolean) => check(name, cond, true);
const seq = (values: number[]) => { let i = 0; return { d: (_n: number) => values[i++ % values.length] }; };

const fighter: SkirmishCharacter = { name: 'Bram', class: 'Fighter', level: 3, race: 'Human', hitPoints: 28, maxHitPoints: 28, armorClass: 16, strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8, skills: ['athletics'], equippedWeapon: 'Longsword' } as any;
const wizard: SkirmishCharacter = { name: 'Ilse', class: 'Wizard', level: 3, race: 'Elf', hitPoints: 17, maxHitPoints: 17, armorClass: 12, strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 12, charisma: 10, skills: ['arcana'], equippedWeapon: 'Quarterstaff' } as any;
const fighterFeatures = buildFeatureState(getClassDef('fighter')!, 3, null, { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 } as any);

console.log('DMG encounter math');
check('level 1 thresholds', xpThresholds(1), { easy: 25, medium: 50, hard: 75, deadly: 100 });
check('level 3 thresholds', xpThresholds(3), { easy: 75, medium: 150, hard: 225, deadly: 400 });
check('party of 4 at level 1', xpThresholds(1, 4).medium, 200);
check('1 monster, party of 4: x1', encounterMultiplier(1, 4), 1);
check('2 monsters, party of 4: x1.5', encounterMultiplier(2, 4), 1.5);
check('4 monsters, party of 4: x2', encounterMultiplier(4, 4), 2);
check('solo vs 1 monster: next multiplier up, x1.5', encounterMultiplier(1, 1), 1.5);
check('solo vs 2 monsters: x2', encounterMultiplier(2, 1), 2);
check('two goblins vs a solo character: 100 x2 = 200', adjustedXp([MONSTERS.goblin, MONSTERS.goblin], 1), 200);
check('that is deadly at level 1', rateEncounter(200, 1, 1), 'deadly');
check('and medium at level 3', rateEncounter(200, 3, 1), 'medium');
check('CR 1/4 is 50 XP', xpForCr(0.25), 50);
check('CR 3 is 700 XP', xpForCr(3), 700);
for (const [theme, keys] of Object.entries(THEME_ROSTERS)) ok(`roster ${theme} uses known monsters`, keys.every((k) => !!MONSTERS[k]));
for (const m of Object.values(MONSTERS)) ok(`${m.name}: XP matches CR ${m.cr}`, xpForCr(m.cr) === m.xp);

const e1 = buildEncounter('goblin', 1, 'medium', () => 0);
check('level 1 solo, medium goblins: one goblin (75 adjusted, budget 50 is too small for two)', e1.monsters.map((m) => m.key), ['goblin']);
ok('the note explains the math', e1.note.includes('x1.5') && e1.note.includes('DMG budget'));
const e3 = buildEncounter('wolf_pack', 3, 'hard', () => 0);
ok(`level 3 solo, hard wolves stays within budget (${e3.adjustedXp} <= 225)`, e3.adjustedXp <= 225);
const wolvesNote = buildEncounter('wolf_pack', 3, 'hard', () => 0).note;
ok(`plural: ${wolvesNote.split(':')[0]}`, !/Wolfs/.test(wolvesNote));
const big = buildEncounter('owlbear', 1, 'easy', () => 0);
check('an owlbear is still an owlbear, and deadly', [big.monsters[0].key, big.rating], ['owlbear', 'deadly']);

console.log('dice');
check('rollExpr 2d4+2 with 3,4', rollExpr('2d4+2', seq([3, 4])).total, 9);
check('crit doubles dice, not the modifier', rollExpr('1d6+2', seq([5, 6]), true).total, 13);

console.log('starting a fight');
// initiative: monster d20s first (goblin A, goblin B), then the character
let s = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin, MONSTERS.goblin], encounterNote: 'test', rating: 'medium', dice: seq([5, 4, 15]) });
check('duplicate monsters get letters', s.enemies.map((e) => e.name), ['Goblin A', 'Goblin B']);
check('character initiative 15 + 1 Dex', s.pc.initiative, 16);
check('character acts first, so nobody has attacked yet', s.pc.hp, 28);
check('round 1', s.round, 1);
s = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin], encounterNote: 'test', rating: 'easy', surprise: 'party_surprised', dice: seq([18, 2, 15, 3]) });
// goblin init 18+2=20 > pc 2+1=3; surprised: goblin attacks in round 1 (15+4=19 hits AC 16, 3+2=5 dmg), pc skips, round 2 goblin attacks again (d20 2... sequence wraps)
ok('surprised: the goblin got its round-1 attack and the round-2 attack before you could act', s.round === 2 && s.log.filter((l) => l.who === 'enemy').length === 2);

console.log('your turn: the class engine');
s = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
// goblin init 1+2=3, pc 20+1=21: pc first
let r = playerTurn(s, fighter, { action: 'attack', targetId: 'e0' }, { features: fighterFeatures, slotFree: () => false, dice: seq([15, 6]) });
// longsword: 15 + 3 Str + 2 prof = 20 vs AC 15 hit, 1d8 (6) + 3 = 9 >= 7 HP
check('attack kills the goblin', r.state.enemies[0].status, 'down');
check('victory, 50 XP', [r.state.status, r.state.xpEarned], ['won', 50]);
ok('the log shows the dice', r.state.log.some((l) => (l.detail ?? []).some((d) => d.includes('vs AC 15'))));

s = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(s, { ...fighter, hitPoints: 10 } as any, { action: 'dodge', bonus: 'second_wind' as any }, { features: fighterFeatures, slotFree: () => false, dice: seq([7, 20, 20, 3]) });
ok('Second Wind spends a use', r.effects.featureUses['second_wind'] === 1);
ok('dodging: the goblin rolls with disadvantage', r.state.log.some((l) => (l.detail ?? []).some((d) => d.includes("you're dodging"))));

console.log('monsters');
const sk = startSkirmish({ mode: 'delve', ref: { source: 'test' }, character: { ...fighter, equippedWeapon: 'Warhammer' } as any, monsters: [MONSTERS.skeleton], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(sk, { ...fighter, equippedWeapon: 'Warhammer' } as any, { action: 'attack' }, { features: fighterFeatures, slotFree: () => false, dice: seq([15, 4]) });
ok('skeletons are vulnerable to bludgeoning: damage doubled', r.state.log.some((l) => (l.detail ?? []).some((d) => d.includes('vulnerable to bludgeoning'))));

const zs = startSkirmish({ mode: 'delve', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.zombie], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
const zHit = { ...zs, enemies: zs.enemies.map((e) => ({ ...e, hp: 5 })) } as SkirmishState;
r = playerTurn(zHit, fighter, { action: 'attack' }, { features: fighterFeatures, slotFree: () => false, dice: seq([15, 2, 19]) });
// 1d8 (2) + 3 = 5 damage, exactly to 0; Undead Fortitude DC 10, rolls 19 + 1 = 20: drops to 1
check('Undead Fortitude keeps the zombie up at 1 HP', r.state.enemies[0].hp, 1);

const wolves = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.wolf, MONSTERS.wolf], encounterNote: 't', rating: 'medium', dice: seq([20, 19, 1, 10, 12, 4, 4, 10]) });
ok('wolves get Pack Tactics while both stand', wolves.log.some((l) => (l.detail ?? []).some((d) => d.includes('Pack Tactics'))));
ok('a wolf bite can knock you prone (Strength save)', wolves.log.some((l) => (l.detail ?? []).some((d) => d.includes('Knockdown'))));

console.log('morale');
const gob = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin, MONSTERS.goblin], encounterNote: 't', rating: 'medium', dice: seq([1, 1, 20]) });
const tough = { ...gob, enemies: gob.enemies.map((e) => ({ ...e, hp: 12, maxHp: 12 })) } as SkirmishState;
r = playerTurn(tough, fighter, { action: 'attack', targetId: 'e0' }, { features: fighterFeatures, slotFree: () => false, dice: seq([15, 4, 3, 1, 1, 1]) });
// 4 + 3 = 7 damage, 12 -> 5 (below half): Wisdom save d20 (3) vs DC 10 fails: flees
check('a badly hurt goblin fails morale and flees', r.state.enemies[0].status, 'fled');

console.log('fleeing');
const pack = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.wolf], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(pack, fighter, { action: 'disengage', flee: true }, { features: fighterFeatures, slotFree: () => false, dice: seq([20]) });
ok('disengaging from a wolf (40 ft vs your 30): you have to lose it with Stealth', r.state.log.some((l) => (l.detail ?? []).some((d) => d.includes('faster than your 30 ft'))));
check('a natural 20 on Stealth loses it', r.state.status, 'fled');
const gobs = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: fighter, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(gobs, fighter, { action: 'dash', flee: true }, { features: fighterFeatures, slotFree: () => false, dice: seq([2, 2]) });
ok('dashing away without disengaging provokes an opportunity attack', r.state.log.some((l) => (l.detail ?? []).some((d) => d.includes('opportunity attack'))));
check('then nothing can keep up with 60 ft', r.state.status, 'fled');
r = playerTurn(gobs, fighter, { action: 'attack', flee: true }, { features: fighterFeatures, slotFree: () => false, dice: seq([2]) });
ok('you can only flee with Dash or Disengage', !!r.error);

console.log('spells');
check('wizard signature spells', spellsFor('Wizard', 3).map((x) => x.id), ['fire_bolt', 'magic_missile', 'thunderwave']);
check('known-spell list filters levelled spells, keeps the cantrip', spellsFor('Wizard', 3, ['Magic Missile']).map((x) => x.id), ['fire_bolt', 'magic_missile']);
check('paladins get Cure Wounds from level 2', [spellsFor('Paladin', 1).length, spellsFor('Paladin', 2).length], [0, 1]);
check('wizard 3, Int 16: spell attack +5, save DC 13', [spellAttackBonus(wizard as any, 'Wizard'), spellSaveDC(wizard as any, 'Wizard')], [5, 13]);
const ws = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: wizard, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(ws, wizard, { action: 'spell', spellId: 'magic_missile', slotLevel: 1 }, { features: [], slotFree: (l) => l === 1, dice: seq([3, 3, 3]) });
check('Magic Missile: three darts of 1d4+1 never miss, 12 damage drops the goblin', r.state.enemies[0].status, 'down');
check('and spends a level 1 slot', r.effects.slotsUsed, [1]);
r = playerTurn(ws, wizard, { action: 'spell', spellId: 'magic_missile', slotLevel: 1 }, { features: [], slotFree: () => false, dice: seq([3]) });
ok('no slots, no Magic Missile', !!r.error);
r = playerTurn(ws, wizard, { action: 'spell', spellId: 'fire_bolt' }, { features: [], slotFree: () => false, dice: seq([12, 9]) });
ok('Fire Bolt is a cantrip, no slot', r.effects.slotsUsed.length === 0 && r.state.enemies[0].status === 'down');
const cleric = { ...wizard, class: 'Cleric', wisdom: 16, hitPoints: 5 } as any;
const cs = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: cleric, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([1, 20]) });
r = playerTurn(cs, cleric, { action: 'spell', spellId: 'sacred_flame', bonusSpellId: 'healing_word' }, { features: [], slotFree: () => true, dice: seq([4, 2, 8, 1, 1]) });
ok('Healing Word as a bonus action, then a cantrip: allowed', !r.error && r.state.pc.hp > 5);
r = playerTurn(cs, cleric, { action: 'spell', spellId: 'guiding_bolt', bonusSpellId: 'healing_word' }, { features: [], slotFree: () => true, dice: seq([4]) });
ok('Healing Word then a levelled spell: not allowed (bonus-action spell rule)', !!r.error);

console.log('losing');
const ogre = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: { ...wizard, hitPoints: 3 } as any, monsters: [MONSTERS.owlbear], encounterNote: 't', rating: 'deadly', dice: seq([20, 1, 15, 8, 8, 8]) });
check('an owlbear knocks you out', [ogre.status, ogre.pc.hp], ['lost', 0]);
ok('knocked out, not killed', ogre.log.some((l) => l.text.includes('You wake later')));
const ko = startSkirmish({ mode: 'wander', ref: { source: 'test' }, character: { ...fighter, hitPoints: 0 } as any, monsters: [MONSTERS.goblin], encounterNote: 't', rating: 'easy', dice: seq([10]) });
check('at 0 HP you can not start a fight', ko.status, 'lost');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
