import assert from "node:assert";
import { decideQuestHook, buildQuestInsert, completedSideQuestIds, questRewards } from "../server/lib/questHooks";

// Simulate 200 turns across several campaigns: cadence stays within bounds.
for (const campaignId of [1, 7, 42, 67, 1234]) {
  let state: any = {}; const offers: number[] = [];
  for (let t = 0; t < 200; t++) {
    const d = decideQuestHook({ campaignId, storyState: state, openSideQuests: 0, inCombat: false });
    if (d.offer) offers.push(d.turn);
    state = { questHook: { turn: d.turn, lastOfferTurn: d.offer ? d.turn : (state.questHook?.lastOfferTurn ?? 0) } };
  }
  assert(offers[0] >= 3, "no hooks before turn 3");
  for (let i = 1; i < offers.length; i++) {
    const gap = offers[i] - offers[i - 1];
    assert(gap >= 5 && gap <= 12, `gap ${gap} out of range for campaign ${campaignId}`);
  }
  console.log(`campaign ${campaignId}: ${offers.length} offers in 200 turns, first at ${offers[0]}`);
}
// Deterministic: same state → same answer (stream and bookkeeping agree).
const s = { questHook: { turn: 20, lastOfferTurn: 3 } };
assert.deepStrictEqual(decideQuestHook({ campaignId: 9, storyState: s, openSideQuests: 0, inCombat: false }),
                       decideQuestHook({ campaignId: 9, storyState: s, openSideQuests: 0, inCombat: false }));
// Blocked in combat and at the open-quest cap.
assert(!decideQuestHook({ campaignId: 9, storyState: s, openSideQuests: 0, inCombat: true }).offer);
assert(!decideQuestHook({ campaignId: 9, storyState: s, openSideQuests: 3, inCombat: false }).offer);
// Insert normalization; rewards set by code.
const d = decideQuestHook({ campaignId: 9, storyState: s, openSideQuests: 0, inCombat: false });
const ins = buildQuestInsert({ title: "The Miller's Lost Seal", description: "Find it.", difficulty: "challenging", objectives: ["a", { text: "b" }], specialReward: { name: "Ring of the Mill" }, xpReward: 99999 }, { campaignId: 9, partyLevel: 4, decision: d })!;
assert.equal(ins.xpReward, questRewards(4, "challenging").xpReward);
assert.deepStrictEqual(ins.lootRewards, ["Ring of the Mill"]);
assert.equal(ins.objectives.length, 2);
assert.equal(buildQuestInsert({ title: "" }, { campaignId: 9, partyLevel: 1, decision: d }), null);
assert.deepStrictEqual(completedSideQuestIds([{ questId: "sq_5", newStatus: "completed" }, { questId: "sq_6", newStatus: "completed" }, { questId: "quest_1", newStatus: "completed" }], [{ id: 5 }]), [5]);
console.log("questHooks: all assertions passed");
