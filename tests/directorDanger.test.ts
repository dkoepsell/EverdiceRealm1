/**
 * Danger spec Phase 1 acceptance: a pacing dial, a danger floor, skirmish and
 * hazard beats, and clocks that move. Simulates 200 campaigns of 30 scenes
 * with a seeded RNG and mostly-dialogue play, then checks the targets:
 *
 *  - balanced: a fight in every chapter (1.25+ on average; each combat
 *    round is a turn, so two full fights would fill most of a chapter), two or
 *    more dangerous scenes per chapter, no danger-free run over 4 scenes, no
 *    beat three times running;
 *  - action: two or more fights per chapter, no danger-free run over 2;
 *  - story: a fight in at least 95% of chapters;
 *  - without a pacing (dangerPacing off) the old deck never deals a fight.
 *
 * Also: encounter and hazard plans, saving throws, hazard resolution, clocks.
 *
 * Run with: npx tsx tests/directorDanger.test.ts
 */
import { type Beat, type DirectorState, beatForTurn, isDanger, parseDirectorState, pickNextBeat } from "../server/play/director/beats";
import { applySkirmishPlan, ensureHazardChoice, hazardNumbers, planHazard, planSkirmish, resolveHazard, terrainFor } from "../server/play/director/danger";
import { dangerTurn, planFor, seededRng } from "../server/play/director/dangerTurn";
import { fireFullClock, seedClocks, tickClocks } from "../server/play/clocks";
import { saveModifier, savingThrowAbility } from "../shared/rules/checks";
import { ENGAGEMENT_FLAGS, PACING_PROFILES, type Pacing, resolvePacing } from "../shared/engagementFlags";
import { MONSTERS, adjustedXp, xpThresholds } from "../shared/rules/monsters";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

interface ChapterStats { fights: number; hazards: number; dangers: number; maxQuietRun: number; tripleRepeat: boolean; scenes: number }

/**
 * One simulated campaign. Each turn plays the director's beat; a dealt skirmish
 * (or the player attacking, rarely) starts a fight that lasts 2 to 4 combat
 * turns. Chapters are 6 to 10 scenes.
 */
function simulate(pacing: Pacing | undefined, seed: number, scenes = 30): ChapterStats[] {
  const rng = seededRng(`sim:${pacing}:${seed}`);
  let chapter = 1;
  let chapterLen = 6 + Math.floor(rng() * 5);
  let inChapter = 0;
  let state: DirectorState = parseDirectorState(undefined, chapter);
  let combatLeft = 0;
  const out: ChapterStats[] = [];
  let cur: ChapterStats = { fights: 0, hazards: 0, dangers: 0, maxQuietRun: 0, tripleRepeat: false, scenes: 0 };
  let quietRun = 0;
  const playedHistory: Beat[] = [];
  for (let t = 0; t < scenes; t++) {
    const attack = rng() < 0.03; // mostly dialogue play: the player rarely starts a fight
    let beat = beatForTurn(state, { inCombat: combatLeft > 0, attackIntent: attack });
    let played: Beat = beat;
    if (beat === "skirmish" || (beat === "combat" && combatLeft === 0)) {
      cur.fights++;
      combatLeft = 1 + Math.floor(rng() * 3);
      played = "combat";
    } else if (beat === "combat") {
      combatLeft--;
      played = "combat";
    }
    if (beat === "hazard") cur.hazards++;
    if (beat === "hazard" || beat === "pressure") cur.dangers++;
    quietRun = isDanger(played) ? 0 : quietRun + 1;
    cur.maxQuietRun = Math.max(cur.maxQuietRun, quietRun);
    cur.scenes++;
    if (beat === "skirmish" || (beat === "combat" && played === "combat" && playedHistory[playedHistory.length - 1] !== "combat")) cur.dangers++;
    playedHistory.push(played);
    const n = playedHistory.length;
    if (n >= 3 && played !== "combat" && playedHistory[n - 2] === played && playedHistory[n - 3] === played) cur.tripleRepeat = true;
    state = pickNextBeat(state, played, { rng, ...(pacing ? { pacing } : {}) });
    inChapter++;
    if (inChapter >= chapterLen && combatLeft === 0) {
      out.push(cur);
      chapter++;
      inChapter = 0;
      chapterLen = 6 + Math.floor(rng() * 5);
      cur = { fights: 0, hazards: 0, dangers: 0, maxQuietRun: 0, tripleRepeat: false, scenes: 0 };
      // A new chapter: the director keeps recent beats and the quiet run, resets chapter beats.
      state = parseDirectorState({ ...state, chapter: chapter - 1 }, chapter);
    }
  }
  if (cur.scenes >= 6) out.push(cur);
  return out;
}

function run(pacing: Pacing | undefined) {
  const chapters: ChapterStats[] = [];
  for (let i = 0; i < 200; i++) chapters.push(...simulate(pacing, i));
  return chapters;
}

console.log("\nPacing profiles");
check("default pacing is balanced", resolvePacing({ engagementFlags: {} }) === "balanced");
check("pacing read from engagement_flags", resolvePacing({ engagementFlags: { pacing: "action" } }) === "action");
check("bad pacing falls back to balanced", resolvePacing({ engagementFlags: { pacing: "chaos" } }) === "balanced");
check("dangerPacing flag defaults on", ENGAGEMENT_FLAGS.dangerPacing === true);

console.log("\nBalanced: 200 campaigns x 30 scenes");
{
  const ch = run("balanced");
  const noFight = ch.filter((c) => c.fights === 0).length;
  check("a fight in every chapter", noFight === 0, `${noFight}/${ch.length} chapters without a fight`);
  const mean = ch.reduce((a, c) => a + c.fights, 0) / ch.length;
  check("1.25+ fights per chapter on average", mean >= 1.25, `mean ${mean.toFixed(2)}`);
  const medDanger = median(ch.map((c) => c.dangers));
  check("median 2+ dangerous scenes per chapter (fights, hazards, pressure)", medDanger >= 2, `median ${medDanger}`);
  const worst = Math.max(...ch.map((c) => c.maxQuietRun));
  check("no danger-free run over 4 scenes", worst <= PACING_PROFILES.balanced.dangerFloor, `longest quiet run ${worst}`);
  check("no beat three times running", !ch.some((c) => c.tripleRepeat));
  const withHazard = ch.filter((c) => c.hazards > 0).length / ch.length;
  check("hazards show up (at least 4 chapters in 10)", withHazard >= 0.4, `${Math.round(withHazard * 100)}% of chapters`);
}

console.log("\nStory: 200 campaigns x 30 scenes");
{
  const ch = run("story");
  const withFight = ch.filter((c) => c.fights > 0).length / ch.length;
  check("a fight in at least 95% of chapters", withFight >= 0.95, `${Math.round(withFight * 100)}%`);
  const worst = Math.max(...ch.map((c) => c.maxQuietRun));
  check("no danger-free run over 6 scenes", worst <= PACING_PROFILES.story.dangerFloor, `longest quiet run ${worst}`);
  const bal = median(run("balanced").map((c) => c.fights));
  check("story has fewer fights than balanced", median(ch.map((c) => c.fights)) <= bal);
}

console.log("\nAction: 200 campaigns x 30 scenes");
{
  const ch = run("action");
  const worst = Math.max(...ch.map((c) => c.maxQuietRun));
  check("no danger-free run over 2 scenes", worst <= PACING_PROFILES.action.dangerFloor, `longest quiet run ${worst}`);
  check("median 2+ fights per chapter", median(ch.map((c) => c.fights)) >= 2, `median ${median(ch.map((c) => c.fights))}`);
}

console.log("\nLegacy deck (dangerPacing off)");
{
  let dealt = 0;
  for (let i = 0; i < 50; i++) {
    let st = parseDirectorState(undefined, 1);
    const r = seededRng(`legacy:${i}`);
    for (let t = 0; t < 30; t++) {
      st = pickNextBeat(st, beatForTurn(st, { inCombat: false, attackIntent: false }), { rng: r });
      if (st.nextBeat === "skirmish" || st.nextBeat === "hazard") dealt++;
    }
  }
  check("never deals skirmish or hazard", dealt === 0);
}

console.log("\nEncounter plans");
{
  check("crypt reads as crypt", terrainFor("the old crypt beneath the chapel") === "crypt");
  check("unknown place reads as road", terrainFor("somewhere") === "road");
  for (const level of [1, 3, 5]) {
    for (let i = 0; i < 40; i++) {
      const plan = planSkirmish({ level, pacing: "balanced", locationText: ["forest", "crypt", "cave", "town", "mountain pass"][i % 5], rng: seededRng(`enc:${level}:${i}`) });
      const monsters = plan.combatants.map((c) => MONSTERS[c.key]);
      const adj = adjustedXp(monsters, 1);
      const deadly = xpThresholds(level, 1).deadly;
      if (adj > deadly) {
        check(`level ${level} plan stays under deadly`, false, `${plan.note}`);
        break;
      }
    }
    check(`level ${level}: 40 plans never exceed the deadly budget`, true);
  }
  const p = planSkirmish({ level: 2, pacing: "balanced", locationText: "forest road", rng: seededRng("x") });
  check("combatants carry SRD stats", p.combatants.every((c) => c.ac > 0 && c.maxHp > 0 && /d/.test(c.damage)));
  const dup = planSkirmish({ level: 3, pacing: "action", locationText: "forest", rng: seededRng("pack") });
  const names = dup.combatants.map((c) => c.name);
  check("duplicate monsters get distinct names", new Set(names).size === names.length, names.join(", "));
  const state = applySkirmishPlan({ combatants: [{ name: "Thessaly", type: "player" }, { name: "Invented Ogre", type: "enemy" }] }, p);
  check("applying a plan starts combat", state.inCombat === true);
  check("party kept, invented enemy replaced", state.combatants[0].name === "Thessaly" && !state.combatants.some((c: any) => c.name === "Invented Ogre"));
  const a = planFor("skirmish", { campaignId: 7, chapter: 2, sceneIndex: 4, level: 2, partySize: 1, pacing: "balanced", locationText: "cave" });
  const b = planFor("skirmish", { campaignId: 7, chapter: 2, sceneIndex: 4, level: 2, partySize: 1, pacing: "balanced", locationText: "cave" });
  check("plans are seeded (both prompts see the same fight)", JSON.stringify(a) === JSON.stringify(b));
}

console.log("\nHazards and saving throws");
{
  const n1 = hazardNumbers(2, "setback", () => 0.5);
  check("setback at level 2: DC 10-11, 1d10", n1.dc >= 10 && n1.dc <= 11 && n1.damage === "1d10");
  const n2 = hazardNumbers(6, "dangerous", () => 0.99);
  check("dangerous at level 6: DC 12-15, 4d10", n2.dc >= 12 && n2.dc <= 15 && n2.damage === "4d10");
  const hz = planHazard({ level: 1, pacing: "balanced", locationText: "a ruined keep", rng: seededRng("hz") });
  check("hazard plan has a save and a DC", !!hz.ability && hz.dc >= 10);
  const choices = ensureHazardChoice([{ text: "Back away slowly" }], hz);
  check("a missing save choice is added", choices.some((c: any) => /saving throw/i.test(c.skillType ?? "")));
  const fixed = ensureHazardChoice([{ text: "Dodge", skillType: `${hz.ability} saving throw`, rollDC: 25, requiresDiceRoll: true }], hz);
  check("the model's DC is replaced by the game's", (fixed[0] as any).rollDC === hz.dc);

  check("'DEX save' is a Dexterity save", savingThrowAbility("DEX save") === "dexterity");
  check("'Constitution saving throw' parses", savingThrowAbility("Constitution saving throw") === "constitution");
  check("'Athletics' is not a save", savingThrowAbility("Athletics") === null);
  const rogue = { class: "Rogue", level: 3, strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 14 };
  const dex = saveModifier(rogue, "dexterity");
  check("Rogue is proficient in Dexterity saves (+3 +2 = +5)", dex.proficient && dex.total === 5 && dex.label === "Dexterity saving throw");
  const con = saveModifier(rogue, "constitution");
  check("Rogue is not proficient in Constitution saves (+1)", !con.proficient && con.total === 1);

  const plan = { ...planHazard({ level: 1, pacing: "balanced", locationText: "ruin", rng: seededRng("h2") }), halfOnSuccess: true, damage: "2d10" };
  const fail = resolveHazard(plan, { skill: `${plan.ability}_save`, success: false, total: 3 }, () => 0.5);
  check("failed save takes full damage", !!fail && fail.damage === 12 && !fail.saved, JSON.stringify(fail));
  const ok = resolveHazard(plan, { skill: `${plan.ability}_save`, success: true, total: 20 }, () => 0.5);
  check("successful save takes half (rounded down)", !!ok && ok.damage === 6 && ok.saved, JSON.stringify(ok));
  check("a different roll does not resolve the hazard", resolveHazard(plan, { skill: "athletics", success: false }) === null);

  const flags = { ...ENGAGEMENT_FLAGS };
  const director = parseDirectorState({ armedHazard: { ...plan, armedAtTurn: 3 } }, 1);
  const ctx = { campaignId: 1, chapter: 1, sceneIndex: 4, level: 1, partySize: 1, pacing: "balanced" as Pacing };
  const roll = { skill: `${plan.ability}_save`, success: false, total: 5, dice: [4] };
  const t1 = dangerTurn(flags, director, "quiet", { rollResult: roll, ctx });
  const t2 = dangerTurn(flags, director, "quiet", { rollResult: roll, ctx });
  check("hazard damage is the same in both prompts", !!t1.hazardOutcome && t1.hazardOutcome.damage === t2.hazardOutcome!.damage);
  check("the narrator is told the result", /HAZARD RESULT/.test(t1.promptLine));
  const off = dangerTurn({ ...flags, dangerPacing: false }, director, "quiet", { rollResult: roll, ctx });
  check("dangerPacing off: nothing happens", off.hazardOutcome === null && off.promptLine === "");
  const trig = dangerTurn(flags, parseDirectorState(undefined, 1), "combat", { trigger: { beat: "combat", clockName: "Alarm raised" }, ctx });
  check("a fight clock becomes a planned skirmish", trig.beat === "skirmish" && trig.plan?.kind === "skirmish");
}

console.log("\nClocks that move");
{
  let clocks = seedClocks();
  const r1 = tickClocks(clocks, { choice: "\"Tell me about your brother.\"", locationDanger: "hostile", scenesInChapter: 1 });
  check("talking in a hostile place ticks the alarm", r1.ticks.some((t) => t.id === "alarm"));
  const r2 = tickClocks(clocks, { choice: "\"Hello\"", locationDanger: "safe", scenesInChapter: 1 });
  check("a safe place never ticks the alarm", !r2.ticks.some((t) => t.id === "alarm"));
  const r3 = tickClocks(clocks, { choice: "go north", moved: true, locationDanger: "uneasy", scenesInChapter: 2 });
  check("moving through the wild ticks wilderness danger", r3.ticks.some((t) => t.id === "wilderness_danger"));
  const r4 = tickClocks(clocks, { choice: "wait", alarmSegments: 4, scenesInChapter: 2 });
  check("action pacing shrinks the alarm to 4", r4.clocks.find((c) => c.id === "alarm")!.segments === 4);
  clocks = clocks.map((c) => (c.id === "villain_plan" ? { ...c, filled: 8 } : c));
  const f1 = fireFullClock(clocks);
  check("villain plan fills first into pressure", f1.trigger?.beat === "pressure");
  const f2 = fireFullClock(f1.clocks.map((c) => (c.id === "villain_plan" ? { ...c, filled: 8 } : c)));
  check("then sends agents (a fight)", f2.trigger?.beat === "combat");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
