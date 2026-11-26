/**
 * Companions who feel present (companions spec): values, approval, the
 * per-scene companion moment, prompt blocks, combat barks, the companion
 * beat, own-skill rolls and the ledger sync.
 *
 * Run with: npx tsx tests/companions.test.ts
 */
import {
  type CompanionView, START_POINTS, applyDeed, classFromNpc, combatBark, companionCheckCharacter, inferValues,
  parseBonds, partyPromptBlock, partyStreamLine, pickMoment, syncCompanionsToLedger,
} from "../server/play/companions/companions";
import { attitudeFromPoints, moodFromPoints } from "../shared/companionMood";
import { beatForTurn, parseDirectorState, pickNextBeat } from "../server/play/director/beats";
import { seededRng } from "../server/play/director/dangerTurn";
import { checkModifier } from "../shared/rules/checks";
import { EMPTY_LEDGER } from "../shared/ledger";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) { failures++; console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); } else console.log(`  ✓ ${name}`);
}

const comp = (name: string, over: Partial<CompanionView> = {}): CompanionView => {
  const className = over.className ?? "Cleric";
  const v = inferValues(`${over.personality ?? ""} ${over.motivation ?? ""}`, className);
  return {
    campaignNpcId: name.length, name, race: "Human", className, level: 1,
    personality: "", motivation: "", voice: "", hp: 10, maxHp: 10, status: "conscious",
    abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 15, charisma: 12 },
    skills: ["insight", "medicine"], likes: v.likes, dislikes: v.dislikes, ...over,
  };
};

console.log("\nWho they are");
check("'Priestess of Lathander' reads as a Cleric", classFromNpc({ occupation: "Priestess of Lathander" }) === "Cleric");
check("'Rogue' reads as a Rogue", classFromNpc({ occupation: "Rogue for hire" }) === "Rogue");
check("'Ship's cook' falls back to Fighter", classFromNpc({ occupation: "Ship's cook" }) === "Fighter");
const kind = inferValues("A gentle healer who protects the innocent and never lies; honest to a fault.", "Cleric");
check("values read from personality: mercy and honesty", kind.likes.includes("mercy") && kind.likes.includes("honesty"), kind.likes.join(","));
check("and what offends them: cruelty, deceit", kind.dislikes.includes("cruelty") && kind.dislikes.includes("deceit"), kind.dislikes.join(","));
const merc = inferValues("Only in it for the gold.", "Rogue");
check("a mercenary likes greed and dislikes generosity", merc.likes.includes("greed") && merc.dislikes.includes("generosity"), JSON.stringify(merc));
const blank = inferValues("", "Paladin");
check("no text: values come from the class", blank.likes.join(",") === "honesty,bravery", blank.likes.join(","));

console.log("\nApproval");
{
  const mira = comp("Mira", { personality: "gentle healer, protects the innocent" });
  const bonds = parseBonds({});
  const r1 = applyDeed(bonds, [mira], { tag: "mercy", summary: "You spared the bandit." });
  check("mercy pleases a merciful companion (+2)", r1.bonds.Mira.points === START_POINTS + 2 && r1.events[0].delta === 2);
  check("the reaction waits to be voiced next scene", r1.bonds.Mira.pending?.kind === "approve");
  check("and the note reads plainly", /Mira approves: you showed mercy/.test(r1.events[0].note), r1.events[0].note);
  const r2 = applyDeed(r1.bonds, [mira], { tag: "cruelty", summary: "You burned the camp." });
  check("cruelty displeases her (-2)", r2.bonds.Mira.points === START_POINTS && r2.bonds.Mira.pending?.kind === "disapprove");
  const r3 = applyDeed(r1.bonds, [mira], { tag: "curiosity", summary: "You read the scroll." });
  check("a deed she doesn't care about changes nothing", r3.events.length === 0);
  const r4 = applyDeed(parseBonds({ Mira: { points: 4 } }), [mira], { tag: "mercy", summary: "x" });
  check("reaching Trusting opens her personal thread", r4.events[0].milestone === "thread" && r4.bonds.Mira.threadOpened === true);
  const ledger = syncCompanionsToLedger({ ...EMPTY_LEDGER, turn: 5 }, [mira], r4.bonds, r4.events);
  check("the Journal gets her as a Trusting companion", ledger.cast.some((c) => c.name === "Mira" && c.role === "companion" && c.attitude === 2));
  check("and the thread is open", ledger.threads.some((t) => /Help Mira/.test(t.summary) && t.status === "open"));

  let b = parseBonds({ Mira: { points: -3 } });
  const e1 = applyDeed(b, [mira], { tag: "cruelty", summary: "x" });
  check("falling to -5 is a warning", e1.events[0].milestone === "warning" && e1.bonds.Mira.warned === 1, JSON.stringify(e1.events));
  b = e1.bonds;
  b = applyDeed(b, [mira], { tag: "cruelty", summary: "x" }).bonds; // -7
  const e3 = applyDeed(b, [mira], { tag: "cruelty", summary: "x" }); // -9: second warning
  check("crossing -8 is the second, plain warning", e3.events[0].milestone === "warning" && e3.bonds.Mira.warned === 2 && /one more/.test(e3.events[0].note), JSON.stringify(e3.events));
  const e4 = applyDeed(e3.bonds, [mira], { tag: "cruelty", summary: "x" }); // -10 → leaves
  check("at the bottom, after two warnings, she leaves", e4.events[0].milestone === "leaves" && e4.bonds.Mira.left === true, JSON.stringify(e4.events));
  check("someone who left doesn't react any more", applyDeed(e4.bonds, [mira], { tag: "mercy", summary: "x" }).events.length === 0);
  check("points map to 5e attitudes", attitudeFromPoints(3) === 1 && attitudeFromPoints(0) === 0 && attitudeFromPoints(-8) === -3 && moodFromPoints(9) === "Devoted");
}

console.log("\nThe companion moment");
{
  const mira = comp("Mira");
  const brakk = comp("Brakk", { className: "Fighter", skills: ["athletics", "perception"] });
  const rng = () => 0.1;
  const pending = parseBonds({ Brakk: { points: 3, pending: { kind: "disapprove", why: "you lied" } } });
  const m1 = pickMoment([mira, brakk], pending, { beat: "open_question", sceneIndex: 3, inCombat: false, rng });
  check("a waiting reaction always surfaces first", m1?.name === "Brakk" && m1.kind === "react" && /you lied/.test(m1.line));
  check("no moments in a fight", pickMoment([mira], {}, { beat: "combat", sceneIndex: 1, inCombat: true, rng }) === null);
  check("about a third of scenes have none", pickMoment([mira], {}, { beat: "open_question", sceneIndex: 1, inCombat: false, rng: () => 0.9 }) === null);
  const notice = pickMoment([mira], {}, { beat: "discovery", sceneIndex: 1, inCombat: false, rng });
  check("discovery: they notice with their passive Perception", notice?.kind === "notice" && /passive Perception of 12/.test(notice.line), notice?.line);
  const aside = pickMoment([mira], {}, { beat: "conversation", sceneIndex: 1, inCombat: false, rng });
  check("conversation: a quiet aside using Insight", aside?.kind === "aside" && /passive Insight 14/.test(aside.line), aside?.line);
  check("quiet: camp talk", pickMoment([mira], {}, { beat: "quiet", sceneIndex: 1, inCombat: false, rng })?.kind === "camp");
  check("hazard: a warning", pickMoment([mira], {}, { beat: "hazard", sceneIndex: 1, inCombat: false, rng })?.kind === "warn");
  const rotated = pickMoment([mira, brakk], parseBonds({ Mira: { points: 3, lastMoment: 4 }, Brakk: { points: 3, lastMoment: 1 } }), { beat: "open_question", sceneIndex: 5, inCombat: false, rng });
  check("the spotlight goes to whoever has been quiet longest", rotated?.name === "Brakk");
  const spot = pickMoment([mira], {}, { beat: "companion", sceneIndex: 5, inCombat: false, rng: () => 0.99 });
  check("a companion beat always spotlights someone", spot?.kind === "spotlight");
  check("someone at 0 HP gets no moment", pickMoment([comp("Downed", { hp: 0 })], {}, { beat: "quiet", sceneIndex: 1, inCombat: false, rng }) === null);
}

console.log("\nPrompts");
{
  const mira = comp("Mira", { personality: "Warm, stubborn, quick to laugh", motivation: "Find her missing brother", hp: 6 });
  const block = partyPromptBlock([mira], parseBonds({ Mira: { points: 6 } }), { name: "Mira", kind: "camp", line: "Mira talks with the player." });
  check("the party block names them, with HP, values and mood", /Mira: Human Cleric 1, 6\/10 HP/.test(block) && /Values/.test(block) && /trusting/.test(block), block);
  check("it carries the chosen moment", /COMPANION MOMENT/.test(block));
  check("it tells the model how to offer a companion's own roll", /"actor"/.test(block));
  check("nobody travelling: no block", partyPromptBlock([], {}, null) === "");
  check("the stream gets a short version", /COMPANIONS PRESENT: Mira/.test(partyStreamLine([mira], {}, null)));
  const left = partyPromptBlock([mira], parseBonds({ Mira: { points: -10, left: true } }), null);
  check("a companion who left isn't in the party", left === "");
}

console.log("\nCombat barks and own-skill rolls");
{
  const brave = comp("Brakk", { className: "Fighter", personality: "bold and fearless" });
  const bark = combatBark([brave], {}, { hit: true }, 4);
  check("a hit gets an in-character line", /^Brakk: "/.test(bark), bark);
  check("nobody conscious, no bark", combatBark([comp("X", { hp: 0 })], {}, { hit: true }, 1) === "");
  const rogue = comp("Pip", { className: "Rogue", abilities: { strength: 8, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 10, charisma: 10 }, skills: ["sleight_of_hand", "stealth"], level: 3 });
  const m = checkModifier(companionCheckCharacter(rogue), "sleight of hand");
  check("a companion's roll uses their own modifier (+3 Dex +2 proficiency)", m.total === 5 && m.proficient, JSON.stringify(m));
}

console.log("\nThe companion beat");
{
  let dealt = 0;
  let chaptersWithOne = 0;
  for (let i = 0; i < 100; i++) {
    let st = parseDirectorState(undefined, 1);
    const r = seededRng(`cb:${i}`);
    let count = 0;
    for (let t = 0; t < 9; t++) {
      const beat = beatForTurn(st, { inCombat: false, attackIntent: false });
      if (beat === "companion") count++;
      st = pickNextBeat(st, beat, { rng: r, pacing: "balanced", hasCompanions: true });
    }
    dealt += count;
    if (count >= 1) chaptersWithOne++;
    if (count > 1) check(`never twice in a chapter (run ${i})`, false);
  }
  check("a companion scene in nearly every 9-scene chapter", chaptersWithOne >= 90, `${chaptersWithOne}/100`);
  let none = 0;
  for (let i = 0; i < 50; i++) {
    let st = parseDirectorState(undefined, 1);
    const r = seededRng(`nc:${i}`);
    for (let t = 0; t < 12; t++) {
      const beat = beatForTurn(st, { inCombat: false, attackIntent: false });
      if (beat === "companion") none++;
      st = pickNextBeat(st, beat, { rng: r, pacing: "balanced" });
    }
  }
  check("no companions, no companion beat", none === 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
