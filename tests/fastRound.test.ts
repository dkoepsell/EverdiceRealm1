/**
 * Fast combat rounds (danger spec Phase 5): when a round skips the model.
 *
 * Run with: npx tsx tests/fastRound.test.ts
 */
import { fastRoundAdvancement, fastRoundNarrative, isFastRound } from "../server/play/combat/fastRound";
import { ENGAGEMENT_FLAGS } from "../shared/engagementFlags";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) { failures++; console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); } else console.log(`  ✓ ${name}`);
}

const flags = { ...ENGAGEMENT_FLAGS };
const fight = { inCombat: true, combatants: [{ name: "Goblin 1", type: "enemy", currentHp: 5, maxHp: 7 }] };
const turn = { type: "class_turn", serverResolved: true, targetName: "Goblin 1", hit: true, damage: { total: 6 }, summary: "Thessaly hits Goblin 1 for 6 slashing damage in total." };

check("a panel turn in a fight is fast", isFastRound(flags, fight, turn));
check("not outside a fight", !isFastRound(flags, { inCombat: false }, turn));
check("not for a typed free action", !isFastRound(flags, fight, { type: "skill_check", total: 12 }));
check("not for an unsigned client roll", !isFastRound(flags, fight, { ...turn, serverResolved: false }));
check("not when a planned threat arrives (the model narrates it)", !isFastRound(flags, fight, turn, { plannedThreat: true }));
check("not when a clock fires", !isFastRound(flags, fight, turn, { clockFired: true }));
check("switchable per campaign", !isFastRound({ ...flags, fastCombatRounds: false }, fight, turn));

const line = fastRoundNarrative(turn, fight.combatants);
check("the line says what happened and that the target fell", /hits Goblin 1/.test(line) && /Goblin 1/.test(line.split(".").slice(1).join(".")), line);
const missLine = fastRoundNarrative({ ...turn, hit: false, damage: undefined, summary: "Thessaly attacks Goblin 1 but misses." }, fight.combatants);
check("a miss reads as a miss", /misses/.test(missLine), missLine);
const adv = fastRoundAdvancement({ ...fight, turnNotes: { beat: "combat" } }, line);
check("the round keeps the fight's state and drops last turn's notes", adv.storyState.inCombat === true && !adv.storyState.turnNotes && adv.sceneType === "Combat");
check("the state is a copy, not the session's object", adv.storyState.combatants !== fight.combatants);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
