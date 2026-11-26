# Everdice Realm: More Danger, More Variety, Better Combat

**For:** Claude Code, working in `dkoepsell/EverdiceRealm1` (reviewed at `Merge remote-tracking branch 'origin/reading-modes'`, 2026-11-25).
**Follows:** `everdice-engagement-spec.md`. The guiding priority still holds: teach real 5e through play, with code resolving every rule and the AI only narrating.
**Read first:** `CLAUDE.md`. Pass `npm run check:gate` before every commit. New logic goes in `server/play/` or `shared/rules/` with thin wiring in `routes.ts`, and every new module gets a test in `/tests`.

---

## 1. Diagnosis: why play became mostly talk

Players report "not enough danger or battle, just a lot of talking." The code confirms it. The engagement spec removed the old combat timer and the current code overcorrects:

1. **Combat is never dealt by the director.** `server/play/director/beats.ts` says so explicitly (`combat is never dealt from the deck`). The deck weights are conversation 3, open question 3, momentum 2, discovery 2, quiet 1.5, pressure 0.75. That makes about 70% of scenes talk, exploration or rest. The model also tends to write "open question" scenes as conversations.
2. **The clocks rarely fill.** In `server/play/clocks.ts`:
   - **Alarm (6 segments)** ticks only on a failed Stealth check, a choice containing words like "shout", "smash" or "attack", or words like "wait" or "linger". Most chosen actions are dialogue, so it almost never moves.
   - **Wilderness danger (6)** ticks only when `sceneType` contains "travel".
   - **Villain plan (8)** ticks every 3 scenes, and when full it fires a `pressure` beat, not a fight.

   In a typical campaign no clock fills, so the only route to combat is the player declaring an attack.
3. **Even `pressure` is talk-shaped.** It offers "3 choices with visible cost", with no requirement that the danger be physical or immediate.
4. **There is no non-combat danger.** No traps, hazards, falls, poison, collapsing floors or chases with saving throws. Dexterity, Constitution and Strength saves almost never come up, which is also a teaching gap.

**Campaign combat is the weaker of the two combat engines:**

5. **Campaign enemies are generic.** `processEnemyAttacks` in `server/combatManager.ts` gives each enemy one basic attack (`attackBonus`, `damageRoll`) against a **random** party member. There's no multiattack, no traits, no tactics and no spells. Every monster plays the same.
6. **The better engine is only used in Wander and Delve.** `server/play/skirmish/engine.ts` has initiative, surprise, SRD stat blocks from `shared/rules/monsters.ts` (multiattack, Pack Tactics, knock-prone, poison, Undead Fortitude), morale with a Wisdom save, DMG-style chases, and caster spells.
7. **The roster is small.** `shared/rules/monsters.ts` has 24 monsters, so players see the same few enemies.
8. **Every combat round is a full AI story turn.** It's slow, it reads like more prose, and the fight loses tempo.
9. **The battlefield is flat.** No terrain, cover, hazards, reinforcements or boss phases. "Attack the nearest enemy" is always the right answer.

---

## Phase 0: Measure it first (small)

Add to `scripts/engagement-report.sql`:

```sql
-- Beat mix actually played (director history lives in story_state)
SELECT b AS beat, COUNT(*) FROM campaign_sessions s,
  jsonb_array_elements_text(COALESCE(s.story_state::jsonb->'director'->'recent','[]'::jsonb)) b
GROUP BY 1 ORDER BY 2 DESC;

-- Fights per campaign and scenes between fights
WITH t AS (
  SELECT campaign_id, COUNT(*) FILTER (WHERE scene_type ILIKE '%combat%') fights, COUNT(*) scenes
  FROM campaign_sessions GROUP BY 1)
SELECT fights, COUNT(*) campaigns, ROUND(AVG(scenes)) avg_scenes FROM t GROUP BY 1 ORDER BY 1;

-- How combat starts: clock vs player attack vs other (requires the event below)
SELECT data->>'source' AS source, COUNT(*) FROM user_activity_events
WHERE event_type = 'combat_started' GROUP BY 1;
```

Log a `combat_started` event with `{ source: "clock" | "player_attack" | "director" | "ambush" | "dm", campaignId, chapter, sceneIndex }`, and a `combat_ended` event with `{ rounds, outcome, objective, partyDowned, durationMs }`.

**Targets after this spec (Balanced pacing):** a fight in every chapter (1.25 or more on average; each combat round is a turn, so a chapter of 6 to 10 turns can't hold two long fights and still tell a story), two or more dangerous scenes per chapter, the longest streak without danger at 4 scenes or fewer, and median fight length of 3 to 5 rounds.

---

## Phase 1: A pacing dial and a danger floor

### 1.1 Campaign pacing setting
Add `pacing: "story" | "balanced" | "action"` to the campaign engagement flags (same place as the other per-campaign switches). Default to `balanced`. Expose it in campaign Settings and at creation as "How much danger?" with three plain choices.

| Setting | Danger floor (max scenes without danger) | Fights per chapter target |
|---|---|---|
| story | 6 | at least 1 |
| balanced | 4 | 2 |
| action | 2 | 3 or more |

### 1.2 New beats in `beats.ts`
Add two dealt beats:

- **`skirmish`**: a fight that fits the fiction, foreshadowed in the previous scene when possible. The director deals it. It doesn't wait for a clock. Directive: start combat with enemies drawn from the encounter builder (Phase 3), not invented stats.
- **`hazard`**: physical danger without a fight: a trap, collapsing floor, rockslide, flood, fire, poison gas, a fall, a storm crossing, a chase. It resolves with **saving throws** (Dex, Con, Str), checks (Athletics, Acrobatics, Survival) and real damage, all computed in `shared/rules/` from SRD trap and hazard guidance. Expose the save math the same way checks are shown now.

New base weights for `balanced`, scaled by pacing:
`momentum 2, open_question 2.5, conversation 2, discovery 1.5, quiet 1, pressure 1.25, skirmish 1.75, hazard 1.5`.
- `story`: multiply skirmish and hazard by 0.5 and conversation by 1.5.
- `action`: multiply skirmish and hazard by 2 and conversation and quiet by 0.6.

### 1.3 Danger floor (in code)
Track `scenesSinceDanger` in `DirectorState`. Danger beats are skirmish, hazard, pressure with a physical threat, and combat. When `scenesSinceDanger >= floor(pacing) - 1`, restrict the pool to `skirmish | hazard | pressure` for the next beat. This is not the old timer: the director picks a threat that fits the current place and open threads (ledger), and the prompt for the scene before should foreshadow it ("you hear boots on the stairs").

Keep the existing rules: no beat three times running, and an aftermath (quiet or discovery) is favoured after a fight. Remove `weights.pressure = 0` after combat and use `0.5` instead.

### 1.4 Clocks that actually move
In `clocks.ts`:
- **Location danger.** Add `locationDanger: "safe" | "uneasy" | "hostile"` to the scene's structured output (validated, default `uneasy`). Every scene in a `hostile` place ticks `alarm` by 1, and every scene in an `uneasy` place ticks it by 1 every other scene. Safe places never tick.
- **Travel.** Any scene where the party moves between places ticks `wilderness_danger` by 1. Detect it from the scene's structured `location` changing, not just `sceneType`.
- **Villain plan fills.** Alternate consequences: the first fill is a `pressure` world change; the second fill sends **the villain's agents after the party** (a `skirmish` with a named lieutenant from the ledger cast).
- **Shrink the clocks for faster pacing:** alarm 4 (action), 6 (balanced), 8 (story).

**Acceptance:** `tests/directorDanger.test.ts` simulates 200 campaigns of 30 scenes with a seeded RNG and mostly-dialogue play. At `balanced`: a fight in every chapter, 1.25+ on average, a median of 2+ dangerous scenes per chapter, no danger-free run over 4 scenes, and no three identical beats in a row. At `story`: a fight in 95% of chapters. At `action`: a median of 2+ fights per chapter and no danger-free run over 2. (Measured: the old deck dealt 0.8 fights per 30 scenes; Balanced now deals about 4.8.)

---

## Phase 2: One combat engine for everything

Make campaign combat use the skirmish engine (`server/play/skirmish/engine.ts`) instead of `processEnemyAttacks`.

1. Extract the engine's state type into a shared `CombatState` stored on `storyState.combat`: initiative order, combatants with SRD stat blocks or companion and ally stats, round, surprise, zones (Phase 4), objective (`encounters.ts`), and morale.
2. Support a **party**: multiple player characters plus companions in initiative order. The current engine assumes one character, and the campaign has allies and companions. Companions act on their own initiative with simple tactics from Phase 3.3.
3. The player's turn keeps using `resolveClassTurn` (`classTurn.ts`). Add casters' spells from `skirmish/spells.ts` into the campaign `CombatTurnPanel`, alongside the existing spell panel, so a Wizard's turn isn't just "attack".
4. Delete `processEnemyAttacks` once nothing calls it. Keep `computeConditionModifiers`, moving it into `shared/rules/conditions.ts` if it isn't there already.
5. **0 HP in campaign play:** use real **death saving throws** for player characters at `balanced` and `action` (SRD rules: 10+ succeeds, a natural 1 counts as two failures, a natural 20 restores 1 HP, three of either ends it), with companions able to stabilize (Medicine DC 10) or use healing. At `story` pacing, keep "knocked out, the fight is lost, not the character." Teaching death saves is part of teaching 5e.

**Acceptance:** `tests/combat-unified.test.ts`: a party of 2 PCs plus 1 companion against 3 goblins runs to completion with correct initiative order; Pack Tactics grants advantage only with an ally adjacent; Nimble Escape lets a goblin Disengage or Hide as a bonus action; death saves follow the SRD.

---

## Phase 3: Enemies worth fighting

### 3.1 Bigger roster
Grow `shared/rules/monsters.ts` from 24 to about **80 SRD 5.1 monsters** covering CR 0 to 8, with every common environment (forest, hills, swamp, underdark, urban, coast, ruins, undead, fey, fiendish). Include signature traits and actions: Multiattack, Pack Tactics, Nimble Escape, Sunlight Sensitivity, Keen Senses, Charge or Pounce, breath weapons with Recharge 5-6, web, frightful presence, regeneration, spellcasting with saves, grapple and restrain, poison, and incorporeal movement. SRD content only.

### 3.2 Roles
Tag each monster with one or two roles: `brute`, `skirmisher`, `artillery`, `controller`, `leader`, `minion`, `solo`. The encounter builder mixes roles (for example 1 brute + 2 skirmishers, or 1 leader + 3 minions) so fights differ in shape, not just names.

### 3.3 Tactics, not random targets
In `server/play/skirmish/tactics.ts`, pick a target and action per monster based on its role and intelligence:

- **Brutes** engage the nearest foe and stick to it.
- **Skirmishers** hit and run, flank for Pack Tactics or Sneak-style bonuses, and focus the most wounded or softest target.
- **Artillery** stays in the far zone, targets low-AC foes, and moves away when engaged.
- **Controllers** open with their control ability (web, grapple, frighten) on the biggest threat.
- **Leaders** give orders, and their minions gain a small bonus while the leader stands.
- **Mindless creatures** (Int 3 or lower) attack the nearest creature, never retreat, and never parley.

Intelligent foes also use the morale already in `encounters.ts` and the skirmish engine, offering surrender or terms.

### 3.4 Telegraphed big moves
Recharge abilities and big attacks are announced **one round ahead**: "The wyvern rears back, venom beading on its stinger." The player then gets a real choice: Dodge, move out of the zone, Ready an action, or interrupt. This is how tables make fights tense, and it teaches reading the battlefield.

### 3.5 Encounter building
`server/play/skirmish/builder.ts` builds encounters from party level and size, pacing and difficulty, location, and the ledger's villain or faction. Use the SRD encounter difficulty budget if the repo's SRD source includes one; otherwise use a CR-sum heuristic tuned by the simulation in 3.6. Encounter mix at `balanced`: 20% easy, 50% medium, 25% hard, 5% deadly (deadly only at chapter climaxes or with an escape objective).

### 3.6 Balance simulation
`tests/combat-balance.test.ts` runs 1,000 seeded fights for each class at levels 1, 3 and 5 against builder output. Targets for medium encounters: median 3 to 5 rounds, PC dropped to 0 HP in 10 to 25% of fights, total party loss under 3%. Fail the test if outside the bands.

---

## Phase 4: A battlefield with choices

### 4.1 Zones, not a grid
Combatants are in one of three zones relative to each other: **engaged**, **near** (within 30 ft) or **far**. Moving one zone uses your movement; Dash moves two. Leaving engaged without Disengage provokes opportunity attacks (the skirmish engine already models this). Ranged attacks while engaged have disadvantage (SRD). Show zones as three simple rows in the combat UI.

### 4.2 Battlefield features
Each encounter gets **one to three features** from a table keyed to location, and each one is a real mechanic:

- **Cover:** a pillar, barrel or wagon gives half cover (+2 AC) or three-quarters cover (+5 AC).
- **Elevation:** a ledge or balcony gives advantage on ranged attacks from above.
- **Hazards:** a fire pit, deep water or a collapsing floor. A Shove into it causes a save or damage.
- **Interactables:** a chandelier, lamp oil or a gate winch, usable with an action and a check or save. These are the most fun for players.
- **Difficult terrain:** rubble or mud costs extra movement.

Features appear as buttons in `CombatTurnPanel` under "Use the scene", with the check or save and its effect shown before choosing.

### 4.3 Mid-fight twists
At most one per fight, picked by the director and resolved in code:
- reinforcements arrive in round 3,
- the environment changes (fire spreads, the bridge starts to give),
- the boss reaches half HP and switches phase,
- a fleeing enemy runs for the alarm (an objective changes mid-fight).

### 4.4 Boss fights
A solo-tagged boss gets: a phase change at half HP (new action or summon), one **lair action** on initiative 20 that uses the battlefield features, and its signature move telegraphed (3.4). Chapter climaxes use a boss or a leader with minions.

---

## Phase 5: Faster rounds, sharper narration

1. **Resolve rounds without a full AI scene.** Enemy and companion turns resolve in code and show as a short combat log with the math (already in the log entries), plus a one-line flavour template per action type ("The gnoll's spear finds a gap in your guard: 7 piercing").
2. **Call the model only on three occasions:** to set the scene when combat starts, to narrate a twist or telegraph, and to write the aftermath when it ends. A model call is not allowed to change any number.
3. **Target:** a full round (player turn plus enemy turns) shows within 1 second of the player's action, with no model call. Log `combat_round_ms`.
4. **Aftermath scene:** loot from the encounter's treasure table, milestone progress, ledger updates (who fled, who surrendered and what they'll say), and the director's aftermath beat.

---

## Phase 6: Variety outside combat

Add `discovery` and `hazard` content generators so non-fight scenes aren't only talk:
- **Traps:** pressure plates, needle locks, pit traps, glyphs. Spot them with passive Perception or Investigation, disarm with Thieves' Tools, and resist with a save. Use SRD trap rules and damage-by-level guidance.
- **Chases:** reuse the DMG-style chase from the skirmish engine for fleeing NPCs and pursuits, with complications each round.
- **Environmental challenges:** climbing, swimming, extreme cold or heat, starvation and exhaustion levels, using SRD rules.
- **Puzzles:** the parameterized generators already in `server/play/content/puzzleGenerators.ts`, dealt as `discovery` beats inside dungeons.

Each records its rules in "Rules learned" (saving throws, traps, exhaustion, chases, cover, death saves) and adds a learning-path one-shot where one is missing: **"Saving throws and traps"** and **"Cover, terrain and tactics."**

---

## Order and sizing

| Order | Phase | Size | Why |
|---|---|---|---|
| 1 | 0 Measure | S | Confirms the talk-to-danger ratio before and after |
| 2 | 1 Pacing dial, danger floor, new beats, clocks | M | Fixes "not enough danger" directly; ship this first |
| 3 | 5 Fast rounds | M | Makes the extra fights fun instead of slow |
| 4 | 2 One combat engine | L | Every campaign fight gets the better engine |
| 5 | 3 Enemies, roles, tactics, telegraphs | L | Fights feel different from each other |
| 6 | 4 Battlefield and twists | M | Real tactical choices |
| 7 | 6 Hazards, traps, chases | M | Danger beyond fighting; teaches saves |

Ship each phase behind the existing per-campaign engagement flags so it can be compared against Phase 0.

## Constraints for Claude Code
- Pass `npm run check:gate` before every commit; don't re-record the baseline to hide errors.
- SRD 5.1 content only for monsters, traps and rules. If you use the SRD 5.2 encounter budget, cite the section in a code comment.
- Code decides hits, damage, saves, HP, conditions, morale, objectives and phase changes. The model never returns numbers for these.
- Keep every current test passing, and add the tests named above.
- Commit per phase in the repo's existing style ("Make X do Y").

---

## Implementation status (branch `danger-and-combat`, 2026-11-26)

Behind two new per-campaign flags, both default on: `dangerPacing` and `fastCombatRounds`.

| Phase | Status | Where |
|---|---|---|
| 0 Measure | Done: beat and pacing on `turn_submitted`; `combat_started`, `combat_ended`, `hazard_resolved` events; report sections J to N | `scripts/engagement-report.sql`, `server/routes.ts` |
| 1 Pacing, danger floor, skirmish and hazard beats, moving clocks | Done | `server/play/director/{beats,danger,dangerTurn}.ts`, `server/play/clocks.ts`, `client/src/components/campaign/DangerPacingSetting.tsx` |
| 2 One combat engine | Partly: campaign monsters now use the SRD stat blocks and the skirmish engine's rules (multiattack, Pack Tactics, poison, knock-prone) through `monsterRound.ts`. Not done: one shared initiative-ordered `CombatState` for the party, and real death saves at Balanced/Action (today's death-save handling is unchanged). | `server/play/combat/monsterRound.ts` |
| 3 Enemies, roles, tactics, telegraphs | Done with 54 monsters (spec asked for about 80). Role tactics, telegraphed recharge breath weapons, Dodge advantage on Dex saves. | `shared/rules/monsters.ts`, `server/play/combat/monsterRound.ts` |
| 4 Battlefield and twists | Done: cover, push hazards, Use an Object, reinforcements. Not done: boss phase changes and lair actions; zones are still labels only. | `shared/rules/battlefield.ts`, `CombatTurnPanel.tsx` |
| 5 Fast rounds | Done: routine combat-panel rounds make no model call. | `server/play/combat/fastRound.ts` |
| 6 Hazards, traps, chases | Partly: hazards and traps with saving throws (16 types) and the 'Saving throws' and 'Traps and hazards' explainers. Not done: chases in campaigns, exhaustion challenges, and the two new learning-path lessons. | `server/play/director/danger.ts` |

Tests: `tests/directorDanger.test.ts`, `tests/monsterRound.test.ts`, `tests/battlefield.test.ts`, `tests/fastRound.test.ts`.
