/**
 * Wander sites (shared/wander/sites.ts) and settlement scenes (server/play/wander/settlement.ts):
 * placement, settlement layouts, scene coverage for every district, prices and checks.
 * Run with: npx tsx tests/wanderSites.test.ts
 */
import {
  DISTRICT_INFO, HOME_SITE, SETTLEMENT_RADIUS, gateHex, isSettlement, settlementLayout, siteAt, sitesInView, type Site,
} from '../shared/wander/sites';
import { hexDistance, hexesWithin, WANDER_TERRAINS } from '../shared/wander/terrain';
import { ALL_SCENES, LEAVE_CHOICE, coinText, fromCp, pickScene, toCp } from '../server/play/wander/settlement';
import { SKILL_ABILITY_MAP } from '../shared/rules/skills';

let failures = 0, checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); } else console.log(`  ✓ ${name}`);
}
const ok = (n: string, c: boolean) => check(n, c, true);

console.log('placement');
check('home is a town at 0,0', [siteAt(0, 0)?.kind, siteAt(0, 0)?.home], ['town', true]);
ok('nothing right next to home', hexesWithin(0, 0, 1).every((h) => (h.q === 0 && h.r === 0) || !siteAt(h.q, h.r)));
const big = hexesWithin(0, 0, 20).map((h) => siteAt(h.q, h.r)).filter(Boolean) as Site[];
const count = (k: string) => big.filter((s) => s.kind === k).length;
ok('villages, towns, cities and dungeons all appear', ['village', 'town', 'city', 'dungeon'].every((k) => count(k) > 0));
ok('cities are rarer than towns, towns rarer than villages', count('city') < count('town') && count('town') < count('village'));
ok('no city within 4 hexes of home', big.filter((s) => s.kind === 'city').every((s) => hexDistance(0, 0, s.q, s.r) >= 5));
ok('no town within 2 hexes of home (except home)', big.filter((s) => s.kind === 'town' && !s.home).every((s) => hexDistance(0, 0, s.q, s.r) >= 3));
ok('deterministic: same hex, same site', big.every((s) => JSON.stringify(siteAt(s.q, s.r)) === JSON.stringify(s)));
ok('every site has a name, glyph and arrival text', big.every((s) => s.name && s.glyph && s.arrival.length > 20));
ok('dungeons carry a theme', big.filter((s) => s.kind === 'dungeon').every((s) => !!s.theme));
ok('dungeons are only seen up close; settlements from afar', big.every((s) => (s.kind === 'dungeon' ? s.seenFrom === 1 : s.seenFrom >= 4)));
ok('home is in view from home', sitesInView(0, 0).some((s) => s.home));
ok('every terrain hosts a settlement within 20 hexes', WANDER_TERRAINS.every((t) => big.some((s) => s.flavor === t && isSettlement(s))));

console.log('settlement layouts');
for (const kind of ['village', 'town', 'city'] as const) {
  const site = big.find((s) => s.kind === kind)!;
  const L = settlementLayout(site);
  const cells = hexesWithin(0, 0, SETTLEMENT_RADIUS[kind]).length;
  check(`${kind}: one district per hex (${cells})`, L.length, cells);
  check(`${kind}: no two districts share a hex`, new Set(L.map((d) => `${d.q},${d.r}`)).size, cells);
  check(`${kind}: square in the middle`, L.find((d) => d.q === 0 && d.r === 0)?.kind, 'square');
  check(`${kind}: gate on the south edge`, L.find((d) => d.kind === 'gate') && [L.find((d) => d.kind === 'gate')!.q, L.find((d) => d.kind === 'gate')!.r], [gateHex(kind).q, gateHex(kind).r]);
  ok(`${kind}: same layout every time`, JSON.stringify(settlementLayout(site)) === JSON.stringify(L));
}
const cityL = settlementLayout(big.find((s) => s.kind === 'city')!);
ok('a city has an inn, a temple, a market, slums and a noble quarter', ['inn', 'temple', 'market', 'slums', 'noble'].every((k) => cityL.some((d) => d.kind === k)));
const villageL = settlementLayout(big.find((s) => s.kind === 'village')!);
ok('a village has a tavern and a temple, but no slums', villageL.some((d) => d.kind === 'tavern') && villageL.some((d) => d.kind === 'temple') && !villageL.some((d) => d.kind === 'slums'));
const port = big.find((s) => s.flavor === 'ocean' && s.kind !== 'village' && isSettlement(s));
if (port) ok('a coastal town or city has docks', settlementLayout(port).some((d) => d.kind === 'docks'));
const hold = big.find((s) => s.flavor === 'mountain' && s.kind !== 'village' && isSettlement(s));
if (hold) ok('a mountain town or city has a forge or mine', settlementLayout(hold).some((d) => d.kind === 'forge' || d.kind === 'mine'));

console.log('scenes cover every district');
let rng = 1;
const rand = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };
let allFit = true, allChoices = true, gatesLeave = true;
for (const s of big.filter(isSettlement)) {
  for (const d of settlementLayout(s)) {
    for (let i = 0; i < 4; i++) {
      const sc = pickScene(s, d, [], rand);
      if (!sc.where.includes(d.kind) && sc.id !== 'quiet_street') allFit = false;
      if (!sc.choices.length) allChoices = false;
      if (d.kind === 'gate' && !sc.choices.some((c) => c.id === LEAVE_CHOICE.id)) gatesLeave = false;
    }
  }
}
ok('every district gets a scene that belongs there', allFit);
ok('every scene has at least one choice', allChoices);
ok('every gate scene offers the way out', gatesLeave);
ok('every district kind has a label and glyph', Object.values(DISTRICT_INFO).every((d) => d.label && d.glyph));

console.log('checks and prices');
const effects = ALL_SCENES.flatMap((s) => s.choices.map((c) => ({ scene: s.id, ...c.effect })));
const checksOnly = effects.filter((e: any) => e.do === 'check') as any[];
ok('every check names a real 5e skill', checksOnly.every((e) => !!SKILL_ABILITY_MAP[e.skill]));
ok('check DCs sit in the DMG range (10 to 18)', checksOnly.every((e) => e.dc >= 10 && e.dc <= 18));
ok('every check label shows its DC', ALL_SCENES.every((s) => s.choices.every((c) => c.effect.do !== 'check' || c.label.includes(`DC ${(c.effect as any).dc}`))));
const pays = effects.filter((e: any) => e.do === 'pay') as any[];
ok('every price is positive', pays.every((e) => toCp(e.cost) > 0));
const inn = ALL_SCENES.find((s) => s.id === 'inn_room')!;
check('modest lodging is 5 sp (PHB)', toCp((inn.choices[0].effect as any).cost), 50);
check('five days of rations are 2 gp 5 sp (5 sp a day, PHB)', toCp((inn.choices[1].effect as any).cost), 250);
check('cure wounds at the temple is 10 gp', toCp((ALL_SCENES.find((s) => s.id === 'temple_care')!.choices[0].effect as any).cost), 1000);
ok('no em dashes in any scene or site text', !JSON.stringify(ALL_SCENES).includes('—') && !JSON.stringify(big).includes('—') && !JSON.stringify(HOME_SITE).includes('—'));

console.log('coin');
check('toCp', toCp({ gp: 2, sp: 5, cp: 3 }), 253);
check('fromCp', fromCp(253), { gold: 2, silver: 5, copper: 3 });
check('fromCp never negative', fromCp(-40), { gold: 0, silver: 0, copper: 0 });
check('coinText', coinText({ sp: 25 }), '2 gp 5 sp');
check('coinText of nothing', coinText({}), 'nothing');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
