/**
 * Battlefield features and the mid-fight twist (danger spec 4.2 and 4.3).
 *
 * Run with: npx tsx tests/battlefield.test.ts
 */
import { pickBattlefield, useFeature, battlefieldPromptLine } from "../shared/rules/battlefield";
import { maybeReinforce, planSkirmish, applySkirmishPlan } from "../server/play/director/danger";
import { seededRng } from "../server/play/director/dangerTurn";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  } else console.log(`  ✓ ${name}`);
}
const always = (v: number) => ({ d: (n: number) => Math.min(n, v) });
const fixedCheck = (total: number) => () => ({ roll: 10, total, text: `check = ${total}` });

console.log("\nPicking a battlefield");
for (const terrain of ["crypt", "cave", "forest", "swamp", "coast", "desert", "mountain", "snow", "town", "ruin", "road", "nowhere"]) {
  const f = pickBattlefield(terrain, 1, seededRng(terrain));
  check(`${terrain}: one cover plus one or two others`, f.length >= 2 && f.length <= 3 && f[0].kind === "cover" && f.slice(1).every((x) => x.kind !== "cover"), f.map((x) => x.name).join(", "));
}
const lvl5 = pickBattlefield("town", 5, seededRng("t5")).find((f) => f.damage);
check("damage doubles at level 5 (DMG tiers)", !!lvl5 && /^(2d10|4d10)$/.test(lvl5.damage!), lvl5?.damage);
check("prompt line names the features", /BATTLEFIELD/.test(battlefieldPromptLine(pickBattlefield("road", 1, seededRng("r")))));

console.log("\nUsing features");
const enemies = [{ name: "Goblin 1", dexMod: 2, currentHp: 7 }, { name: "Goblin 2", dexMod: 2, currentHp: 7 }, { name: "Goblin 3", dexMod: 2, currentHp: 7 }];
{
  const cover = { id: "wagon", name: "Wagon", kind: "cover" as const, cover: 5 as const, detail: "" };
  const r = useFeature(cover, { enemies, check: fixedCheck(10), dice: always(10) });
  check("cover gives +5 and doesn't cost the action", r.ok && r.cover === 5 && !r.usesAction);

  const chandelier = { id: "chandelier", name: "Chandelier on a rope", kind: "interactable" as const, check: { skill: "sleight_of_hand", dc: 12 }, save: { ability: "dexterity" as const, dc: 13 }, damage: "2d10", damageType: "bludgeoning", detail: "" };
  const miss = useFeature(chandelier, { enemies, check: fixedCheck(8), dice: always(10) });
  check("a failed check does nothing and keeps the feature", miss.ok && miss.damage.length === 0 && !miss.spent && miss.usesAction);
  const hit = useFeature(chandelier, { targetName: "Goblin 2", enemies, check: fixedCheck(15), dice: always(5) });
  check("success hits two enemies, starting with the target", hit.damage.length === 2 && hit.damage[0].name === "Goblin 2", JSON.stringify(hit.damage));
  check("a save of 5 + 2 = 7 fails: full 10 damage", hit.damage.every((d) => d.amount === 10));
  check("the chandelier is spent", hit.spent);
  const again = useFeature({ ...chandelier, spent: true }, { enemies, check: fixedCheck(20), dice: always(10) });
  check("a spent feature can't be used again", !again.ok);
  const saved = useFeature(chandelier, { enemies, check: fixedCheck(15), dice: always(15) });
  check("a made save halves it (2d10 of 10s = 20, half 10)", saved.damage.every((d) => d.amount === 10), JSON.stringify(saved.damage));

  const fire = { id: "hearth", name: "Roaring hearth", kind: "push_hazard" as const, damage: "1d10", damageType: "fire", detail: "" };
  const won = useFeature(fire, { targetName: "Goblin 3", enemies, check: fixedCheck(15), dice: always(6) });
  check("winning the Shove contest sends them in", won.damage.length === 1 && won.damage[0].name === "Goblin 3" && won.damage[0].amount === 6 && /Shove/.test(won.breakdown[0]));
  const lost = useFeature(fire, { targetName: "Goblin 3", enemies, check: fixedCheck(5), dice: always(10) });
  check("losing it does nothing", lost.ok && lost.damage.length === 0);
}

console.log("\nPlanned fights carry a battlefield");
{
  const plan = planSkirmish({ level: 1, pacing: "balanced", locationText: "village square", rng: seededRng("v") });
  check("the plan has features", plan.battlefield.length >= 2);
  const st = applySkirmishPlan({}, plan);
  check("starting the fight puts them on the story state", Array.isArray(st.battlefield) && st.battlefield.length === plan.battlefield.length && !!st.combatTheme);
}

console.log("\nReinforcements");
{
  const base = () => ({ inCombat: true, combatTheme: "goblinoid", combatants: [{ name: "Goblin", type: "enemy" }] });
  const s1 = base();
  check("never in round 1", maybeReinforce(s1, { round: 1, pacing: "action", rng: () => 0 }) === null);
  const s2 = base();
  const note = maybeReinforce(s2, { round: 2, pacing: "balanced", rng: () => 0.1 });
  check("round 2 with a low roll: the weakest of the roster arrives", !!note && s2.combatants.length === 2 && s2.combatants[1].srdKey === "goblin", note ?? "");
  check("only once per fight", maybeReinforce(s2, { round: 3, pacing: "balanced", rng: () => 0 }) === null);
  check("a high roll: nobody comes", maybeReinforce(base(), { round: 2, pacing: "balanced", rng: () => 0.9 }) === null);
  check("story pacing is stingier", maybeReinforce(base(), { round: 2, pacing: "story", rng: () => 0.2 }) === null);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
