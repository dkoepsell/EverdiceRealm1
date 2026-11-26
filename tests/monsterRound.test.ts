/**
 * Campaign monster rounds (danger spec Phases 2-3): SRD stat blocks,
 * multiattack, Pack Tactics, poison, knock-prone, role-based targeting and
 * telegraphed recharge actions.
 *
 * Run with: npx tsx tests/monsterRound.test.ts
 */
import { processMonsterRound, roleOf, statBlockFor, type MonsterInput } from "../server/play/combat/monsterRound";
import type { Combatant } from "../server/combatManager";
import { MONSTERS } from "../shared/rules/monsters";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  } else console.log(`  ✓ ${name}`);
}

/** Dice that return a fixed sequence (then repeat the last value). */
function seq(...vals: number[]) {
  let i = 0;
  return { d: (n: number) => Math.min(n, vals[Math.min(i++, vals.length - 1)]) };
}
const always = (v: number) => ({ d: (n: number) => Math.min(n, v) });

const enemy = (name: string, extra: Partial<MonsterInput> = {}): MonsterInput => {
  const m = statBlockFor({ name });
  return {
    id: Math.floor(Math.random() * 1e6), name, type: "enemy",
    currentHp: m?.hp ?? 20, maxHp: m?.hp ?? 20, armorClass: m?.ac ?? 12,
    attackBonus: 3, damageRoll: "1d6+1", status: "conscious", ...extra,
  };
};
const pc = (name: string, hp: number, ac: number, type: Combatant["type"] = "player", conditions: string[] = []): Combatant => ({
  id: name.length, name, type, currentHp: hp, maxHp: 30, armorClass: ac, attackBonus: 5, damageRoll: "1d8+3", status: "conscious", conditions,
});

console.log("\nStat blocks and roles");
check("'Wolf 2' is a wolf", statBlockFor({ name: "Wolf 2" })?.key === "wolf");
check("'Goblin B' is a goblin", statBlockFor({ name: "Goblin B" })?.key === "goblin");
check("srdKey wins", statBlockFor({ name: "Grisly Thing", srdKey: "ogre" })?.key === "ogre");
check("'Bandit Captain' is not a bandit", statBlockFor({ name: "Bandit Captain" })?.key === "bandit_captain");
check("an unknown creature has no block", statBlockFor({ name: "Whispering Shade" }) === null);
check("wolves are skirmishers", roleOf(MONSTERS.wolf, "Wolf") === "skirmisher");
check("scouts are artillery", roleOf(MONSTERS.scout, "Scout") === "artillery");
check("ogres are brutes", roleOf(MONSTERS.ogre, "Ogre") === "brute");
check("skeletons are mindless", roleOf(MONSTERS.skeleton, "Skeleton") === "mindless");
check("hell hounds are controllers", roleOf(MONSTERS.hell_hound, "Hell Hound") === "controller");
check("captains lead", roleOf(MONSTERS.bandit_captain, "Bandit Captain") === "leader");
check("54+ monsters in the roster", Object.keys(MONSTERS).length >= 54, String(Object.keys(MONSTERS).length));

console.log("\nMultiattack and targeting");
{
  const party = [pc("Thessaly", 30, 14), pc("Aldric", 8, 18, "companion")];
  const r = processMonsterRound([enemy("Brown Bear")], party, { dice: always(15), leadName: "Thessaly" });
  check("a brown bear attacks twice (bite and claws)", r.logs.length === 2, String(r.logs.length));
  const w = processMonsterRound([enemy("Wolf"), enemy("Wolf 2")], [pc("Thessaly", 30, 14), pc("Aldric", 8, 18, "companion")], { dice: always(10) });
  check("skirmishers go for the most wounded", w.logs.every((l) => l.target === "Aldric"), w.logs.map((l) => l.target).join(","));
  check("Pack Tactics gives advantage with an ally up", /Pack Tactics/.test(w.logs[0].mechanicsBreakdown));
  const s = processMonsterRound([enemy("Scout")], [pc("Thessaly", 30, 14), pc("Brakk", 30, 19)], { dice: always(10) });
  check("artillery picks the lowest AC", s.logs.every((l) => l.target === "Thessaly"));
  const b = processMonsterRound([enemy("Ogre", { tactics: { lastTarget: "Brakk" } })], [pc("Thessaly", 30, 14), pc("Brakk", 30, 19)], { dice: always(10) });
  check("a brute sticks with its last target", b.logs[0].target === "Brakk" && b.tactics["Ogre"].lastTarget === "Brakk");
}

console.log("\nDamage riders");
{
  // d20 15 hits, damage dice 4s, poison save d20 2 fails.
  const r = processMonsterRound([enemy("Giant Spider")], [pc("Thessaly", 40, 14)], { dice: seq(15, 4, 2, 4, 4), saves: () => 0 });
  const p = r.partyDamageDealt.find((x) => x.name === "Thessaly")!;
  check("poison adds damage on a failed Con save", /Poison: Constitution save/.test(r.logs[0].mechanicsBreakdown) && p.damageTaken === 4 + 3 + 8, `${p.damageTaken}: ${r.logs[0].mechanicsBreakdown}`);
  const k = processMonsterRound([enemy("Wolf")], [pc("Thessaly", 40, 14)], { dice: seq(15, 2, 2, 3), saves: () => 0 });
  check("a wolf bite can knock prone (Str save failed)", k.knockedProne.includes("Thessaly"), k.logs[0].mechanicsBreakdown);
  check("prone is cleared from what we hand back", !(k.updatedCombatants[0].conditions ?? []).includes("prone"));
  const multi = processMonsterRound([enemy("Thug"), enemy("Thug 2")], [pc("Thessaly", 60, 10)], { dice: always(12) });
  const entries = multi.partyDamageDealt.filter((x) => x.name === "Thessaly");
  check("damage to one target is totalled in one entry", entries.length === 1 && entries[0].damageTaken > 10, JSON.stringify(entries));
  const unknown = processMonsterRound([enemy("Whispering Shade", { attackBonus: 5, damageRoll: "2d4" })], [pc("Thessaly", 30, 12)], { dice: always(10) });
  check("unknown creatures keep their single attack", unknown.logs.length === 1 && unknown.logs[0].attackRoll.modifier === 5);
}

console.log("\nTelegraphed breath weapon");
{
  const party = [pc("Thessaly", 40, 14), pc("Aldric", 40, 16, "companion", ["dodging"])];
  const r1 = processMonsterRound([enemy("Hell Hound")], party, { dice: always(10), saves: () => 1 });
  check("round 1: the breath is announced, not used", r1.telegraphs.length === 1 && r1.tactics["Hell Hound"].telegraphed === true, r1.telegraphs.join(" "));
  check("the tell teaches Dodge for Dex saves", /Dodge action gives advantage on Dexterity saves/.test(r1.telegraphs[0]));
  check("it still bites in round 1", r1.logs.some((l) => /bite/i.test(l.description)));
  const r2 = processMonsterRound([enemy("Hell Hound", { tactics: r1.tactics["Hell Hound"] })], party, { dice: seq(4, 4, 4, 4, 4, 4, 5, 15, 3), saves: () => 1 });
  check("round 2: Fire Breath hits everyone with a save", r2.logs.length === 2 && r2.logs.every((l) => /Fire Breath/.test(l.description)), r2.logs.map((l) => l.description).join(" | "));
  check("the dodging companion rolls the Dex save with advantage", /advantage, Dodge/.test(r2.logs.find((l) => l.target === "Aldric")!.mechanicsBreakdown));
  check("the breath is spent", r2.tactics["Hell Hound"].specialReady === false && !r2.tactics["Hell Hound"].telegraphed);
  const r3 = processMonsterRound([enemy("Hell Hound", { tactics: { specialReady: false } })], party, { dice: always(6) });
  check("a 6 on the d6 recharges it, and it is announced again", r3.tactics["Hell Hound"].specialReady === true && r3.telegraphs.length === 1);
  const r4 = processMonsterRound([enemy("Hell Hound", { tactics: { specialReady: false } })], party, { dice: always(3) });
  check("a 3 doesn't recharge it", r4.telegraphs.length === 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
