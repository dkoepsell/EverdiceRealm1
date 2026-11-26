/**
 * Table night (table-night spec): alignment as a compass, background
 * features, ready-made heroes, and companions played by friends.
 *
 * Run with: npx tsx tests/tableNight.test.ts
 */
import { alignmentLabel, alignmentPromptLine, driftFromDeeds, hasDrifted, parseAlignment } from "../shared/rules/alignment";
import { BACKGROUND_FEATURES, backgroundFeatureFor, backgroundPromptLine } from "../shared/rules/backgrounds";
import { PREGENS, isGuestUsername, pregenByKey, pregenCards } from "../shared/rules/pregens";
import { pregenCharacterRow } from "../server/play/table/pregenRow";
import { type CompanionView, intentsPromptLine, parseIntents, pickMoment } from "../server/play/companions/companions";
import type { DeedTag } from "../shared/ledger";
import { WHATS_NEW, seenTipId, shouldShowWhatsNew } from "../shared/whatsNew";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) { failures++; console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); } else console.log(`  ✓ ${name}`);
}
const deeds = (...tags: DeedTag[]) => tags.map((tag) => ({ tag }));

console.log("\nAlignment");
check("'Chaotic Good' parses", JSON.stringify(parseAlignment("Chaotic Good")) === JSON.stringify({ law: -1, good: 1 }));
check("'LE' parses", JSON.stringify(parseAlignment("LE")) === JSON.stringify({ law: 1, good: -1 }));
check("'True Neutral' parses as Neutral", alignmentLabel(parseAlignment("True Neutral")!) === "Neutral");
check("nonsense is null", parseAlignment("purple") === null && parseAlignment("") === null && parseAlignment(5) === null);
check("fewer than 4 deeds says nothing", driftFromDeeds(deeds("mercy", "mercy", "mercy")).label === null);
const kind = driftFromDeeds(deeds("mercy", "generosity", "mercy", "curiosity"));
check("mercy and generosity read Neutral Good", kind.label === "Neutral Good", String(kind.label));
check("and say why", kind.because[0] === "mercy", kind.because.join(","));
const villain = driftFromDeeds(deeds("betrayal", "cruelty", "deceit", "betrayal"));
check("betrayal, cruelty and deceit read Chaotic Evil", villain.label === "Chaotic Evil", String(villain.label));
check("only the last 10 deeds count", driftFromDeeds([...deeds(...Array(10).fill("cruelty")), ...deeds(...Array(10).fill("mercy"))]).label === "Neutral Good");
check("a paladin who turned cruel has drifted", hasDrifted(parseAlignment("Lawful Good"), villain));
check("a kind character who stays kind has not", !hasDrifted(parseAlignment("Neutral Good"), kind));
check("no chosen alignment never drifts", !hasDrifted(null, villain));
const line = alignmentPromptLine("Lawful Neutral", "Order above all");
check("prompt line names it and forbids refusing", line.includes("Lawful Neutral") && line.includes("NEVER refuse") && line.includes("Order above all"));
check("no alignment, no line", alignmentPromptLine(null) === "");

console.log("\nBackground features");
check("13 backgrounds have features", BACKGROUND_FEATURES.length === 13, String(BACKGROUND_FEATURES.length));
check("'Acolyte' finds Shelter of the Faithful", backgroundFeatureFor("Acolyte")?.feature === "Shelter of the Faithful");
check("'Former Soldier' finds the Soldier feature", backgroundFeatureFor("Former Soldier")?.background === "Soldier");
check("unknown background is null", backgroundFeatureFor("Space Pirate") === null);
const temple = backgroundPromptLine("Acolyte", "The Temple of the Dawn, a quiet shrine");
check("in a temple, the acolyte gets an offer with no roll", temple.includes('"backgroundFeature": "Shelter of the Faithful"') && temple.includes("NO roll"));
const wild = backgroundPromptLine("Acolyte", "A rainy forest road");
check("in the woods, only a reminder", !wild.includes('"backgroundFeature"') && wild.includes("Shelter of the Faithful"));

console.log("\nReady-made heroes");
const HIT_DIE: Record<string, number> = { Fighter: 10, Rogue: 8, Cleric: 8, Wizard: 6, Ranger: 10 };
const mod = (n: number) => Math.floor((n - 10) / 2);
check("five heroes", PREGENS.length === 5 && pregenCards().length === 5);
for (const p of PREGENS) {
  const d = HIT_DIE[p.className];
  const expected = d + 2 * (d / 2 + 1) + 3 * mod(p.abilities.constitution) + (p.race === "Dwarf" ? 3 : 0);
  check(`${p.name}: ${p.hitPoints} HP is level 3 average`, p.hitPoints === expected, `expected ${expected}`);
  const row = pregenCharacterRow(p, 7);
  check(`${p.name}: row is level 3 with features`, row.level === 3 && row.experience === 900 && row.features.length > 0 && row.userId === 7);
}
const rogue = pregenCharacterRow(pregenByKey("rogue")!, 1);
const exp = rogue.features.find((f: any) => f.id === "expertise") as any;
check("the rogue's expertise is filled in", !!exp && exp.choices?.includes("stealth"), JSON.stringify(exp));
check("fighter AC 18 with chain mail and shield", pregenByKey("fighter")!.armorClass === 18 && pregenCharacterRow(pregenByKey("fighter")!, 1).equippedShield === "Shield");
check("a custom name is used and trimmed", pregenCharacterRow(pregenByKey("wizard")!, 1, "  Moss  ").name === "Moss");
check("unknown key is null", pregenByKey("bard") === null && pregenByKey(undefined) === null);
check("guest usernames are recognised", isGuestUsername("guest-ab12") && isGuestUsername("Guest-x") && !isGuestUsername("guestimate"));

console.log("\nCompanions played by friends");
const comp = (name: string, over: Partial<CompanionView> = {}): CompanionView => ({
  campaignNpcId: name.length, name, race: "Human", className: "Cleric", level: 1,
  personality: "", motivation: "", voice: "", hp: 10, maxHp: 10, status: "conscious",
  abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 15, charisma: 12 },
  skills: ["insight"], likes: [], dislikes: [], ...over,
});
const intents = parseIntents({
  Mira: { text: "  I light the lantern and keep watch.  ", by: "Sam", at: "x" },
  Tor: { order: { action: "dodge" }, by: "Ana" },
  Bad: { order: { action: "fireball" } },
  Junk: 5,
});
check("intents keep text and orders", intents.Mira?.text === "I light the lantern and keep watch." && intents.Tor?.order?.action === "dodge");
check("invalid orders and junk are dropped", !intents.Bad && !intents.Junk);
check("long text is capped", (parseIntents({ X: { text: "a".repeat(900) } }).X.text ?? "").length === 400);
const mira = comp("Mira", { controlledBy: 3, controllerName: "Sam" });
const tor = comp("Tor", { controlledBy: 4, controllerName: "Ana" });
const lio = comp("Lio");
const pl = intentsPromptLine([mira, tor, lio], intents);
check("the narrator is told what Sam says Mira does", pl.includes("played by Sam") && pl.includes("I light the lantern"));
check("and not to write Ana's lines for Tor", pl.includes("Tor is played by Ana") && pl.includes("Don't write new dialogue"));
check("game-played companions aren't in that line", !pl.includes("Lio"));
check("no friends, no line", intentsPromptLine([lio], intents) === "");
let alwaysLio = true;
for (let i = 0; i < 20; i++) {
  const m = pickMoment([mira, tor, lio], {}, { beat: "companion", sceneIndex: i, inCombat: false, rng: () => (i * 0.37) % 1 });
  if (m && m.name !== "Lio") alwaysLio = false;
}
check("the game never gives a friend's companion a moment", alwaysLio);
check("with only friend-played companions, no moment", pickMoment([mira, tor], {}, { beat: "companion", sceneIndex: 1, inCombat: false, rng: () => 0.5 }) === null);

console.log("\nWhat's new");
const old = "2025-01-01T00:00:00.000Z";
check("eight cards, each with a try-it and a link", WHATS_NEW.length === 8 && WHATS_NEW.every((c) => c.tryIt && c.href.startsWith("/")));
check("no em-dashes in the copy", WHATS_NEW.every((c) => !/\u2014/.test(c.title + c.body + c.tryIt)));
check("a returning player sees it", shouldShowWhatsNew({ createdAt: old, onboardingState: {} }));
check("once seen, not again", !shouldShowWhatsNew({ createdAt: old, onboardingState: { seenTips: [seenTipId()] } }));
check("guests don't see it", !shouldShowWhatsNew({ createdAt: old, onboardingState: { guest: true } }));
check("brand-new players don't see it", !shouldShowWhatsNew({ createdAt: new Date().toISOString(), onboardingState: {} }));
check("signed out, no modal", !shouldShowWhatsNew(null));

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
