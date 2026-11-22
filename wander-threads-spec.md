# Wander: Threads, Real Travel Rules, and a Reason to Choose a Direction

Engineering spec, November 2026. Status: draft for review.

## 1. The problem, in the code

Wander is fun for about ten moves and then feels like a slot machine. The reasons are visible in `server/wanderEngine.ts` and `server/wanderRoutes.ts`:

- **Every move is an independent draw.** `rollOutcome` picks discovery / quiet / risk / none from biome tables, shifted only by danger rating and the previous outcome type. Nothing that happened three hexes ago changes what happens now.
- **Direction does not matter.** Any adjacent hex rolls from the same table for that biome. Players have no reason to go one way rather than another.
- **The character is not in the game.** `characterLevel: 3` and `partyLevel: 3` are hard coded; `proximityToLairs: 0` and `isHot: false` are constants. `resolveChoice` never calls `shared/rules/checks.ts`, so "investigate" and "avoid" succeed or fail on flat odds (`combatChance = 0.3 + ...`), not on the character's Perception, Stealth or Survival.
- **Markers are written but never read.** `/api/wander/choose` creates `wander_markers` rows, but no roll consults them. `linkedDungeonId`, `linkedSceneId` and `linkedFactionId` on that table are never set.
- **The pieces for a loop exist but are not connected.** `world_rumors` (the Tavern's rumor pool), the Campaign Ledger (`server/play/ledger`), clocks (`server/play/clocks.ts`) and Delve dungeons are all built; Wander touches none of them.

Given the game's first priority (teach real D&D through play, with accurate mechanics underneath), the biggest missed opportunity is that Wander is where 5e's exploration rules should live, and it currently has none of them.

## 2. Goals

1. A move should be a decision: which direction, at what pace, doing what.
2. Discoveries should build on each other toward a payoff (threads), so a session has a shape.
3. Outcomes should resolve through the character's real modifiers using `shared/rules/checks.ts`, with the roll shown, so players learn what Survival and passive Perception are for.
4. Wander should feed and be fed by the rest of the game: Tavern rumors in, Delve entrances and Ledger NPCs out.

Non goals: no AI narration requirement (everything below works from authored tables, which keeps it Studio-portable); no real-time anything; no change to combat resolution beyond how combat is entered.

## 3. Phase 0: codebase recon (mandatory, before any code)

As with the progressive-scaffolding spec, confirm before building:

- How `client/src/pages/wander.tsx` gets `terrainType` for the target hex, and whether the hex map can return terrain for hexes 2 to 3 away (needed for landmarks and bearings).
- Where the active character's sheet lives at runtime, and the exact `CheckCharacter` shape `checkModifier` / `passiveScore` need.
- Whether `world_rumors` rows can carry a hex target (they have `regionId` but no coordinates), or whether a join table is cleaner.
- How the per-campaign engagement flags are read (`globalFlags(process.env.ENGAGEMENT_FLAGS_ON)` in the move route) so every feature below ships behind its own flag.
- Which rules edition the rest of the engine follows (2014 or 2024). The numbers in section 5 are the 2014 SRD 5.1 values; verify each against the SRD text and switch if the engine has moved to 2024.

## 4. Feature A: Threads (the core fix)

A **thread** is a short authored chain of beats that plays out across several moves, ending in a payoff.

```
sign  ->  trace  ->  approach  ->  climax  ->  payoff
"Fresh   "A camp,    "Smoke,      "The lair   Delve entrance,
 tracks"  still warm" voices"      entrance"  named NPC, cache...
```

### Data

New table `wander_threads` (campaign scoped, so threads survive between runs):

| column | notes |
|---|---|
| `id`, `campaignId`, `userId` | |
| `templateId` | key into the authored thread library |
| `beat` | 0 to 4 |
| `targetHexQ`, `targetHexR` | where the climax is; chosen when the thread starts, 3 to 6 hexes away, on a biome the template allows |
| `status` | `active`, `resolved`, `abandoned`, `expired` |
| `startedAtTick`, `expiresAtTick` | threads go cold if ignored (default 30 ticks) |
| `payload` | jsonb: names rolled for this instance, payoff choice |

Thread templates live in a new `server/play/content/wanderThreads.ts`, authored like the existing `CURATED_OUTCOMES`: per template, the allowed biomes, the text for each beat (with `{bearing}` and `{name}` slots), the check each beat calls for, and the payoff type.

### Rolling

In `rollOutcome`, before the existing table roll:

1. If the player has an active thread, compute whether this move went **toward** the target (hex distance shrank). Moving toward it: next beat fires with probability `0.45 + 0.15 * beat`. Moving away: the thread does not advance, and after 3 moves away the next "quiet" outcome becomes a reminder beat ("the tracks are fading").
2. If no thread is active and the outcome would be `discovery`, there is a 35% chance the discovery is a thread **sign** instead, which starts a thread. Cap: 2 active threads per player per campaign.
3. Every beat text names a **bearing** ("the tracks lead northeast"), computed from the current hex to the target. This is what makes direction a decision.

### Payoffs

- **Delve entrance**: create a `wander_markers` row with `linkedDungeonId` set, themed to the thread (goblin tracks lead to a goblin warren). Entering the marker hex offers "Descend". This is the Wander to Delve bridge.
- **Named NPC**: write a cast entry to the Campaign Ledger, so the campaign DM and future Wander rolls can bring them back (see Feature E).
- **Cache or faction token**: uses the existing `rewards` kinds.

Climax beats may carry a `combatSeed`, entered through the existing combat path.

## 5. Feature B: Real 5e travel rules

Each move becomes a travel step with a **pace** and an **activity**, resolved in code with the roll shown.

### Time

Treat one Wander hex as a 6-mile hex. Travel time per hex: fast 1.5 h (4 mph), normal 2 h (3 mph), slow 3 h (2 mph). Add `hoursTraveledToday` and `dayCount` to `wander_runs` (or `flags`). After 8 hours, each further hour is a **forced march**: Constitution save DC 10 + 1 per extra hour, failure means a level of exhaustion. This replaces the current generic `fatigue` counter with the real rule, which players will meet again at the table.

### Pace effects (SRD 5.1, verify in Phase 0)

| Pace | Effect |
|---|---|
| Fast | -5 to passive Perception for noticing threats; -5 to Survival for navigation |
| Normal | none |
| Slow | can travel stealthily (group Stealth vs passive Perception of threats); +5 to navigation |

### Activity (one per character; solo players pick one)

- **Navigate**: Survival check to avoid getting lost. DC by terrain: 5 for grassland or farmland, 10 for hills, desert or arctic, 15 for forest, swamp or mountains. On failure the move lands on a random adjacent hex instead of the chosen one, and the UI says so. (`mapBiomeFromTerrain` already gives the biome to key on.)
- **Forage**: Survival check, DC 10 (abundant), 15 (limited) or 20 (very little) by biome. Success yields 1d6 + Wisdom modifier pounds of food and gallons of water. Cannot forage at fast pace.
- **Scout**: no check, but uses full passive Perception (no fast-pace penalty applies to the scout) and reveals landmarks one hex further.

### Supplies and weather

- Rations: 1 lb food and 1 gallon water per day (2 gallons in hot weather, which finally gives `isHot` a source). Running short applies the SRD starvation and dehydration rules.
- Weather rolled at dawn from a small per-biome table: clear, overcast, rain, fog, storm. Fog and heavy rain make the area lightly obscured (disadvantage on Perception checks that rely on sight) and raise navigation DC by 5.
- Day and night: night travel without darkvision gives disadvantage on navigation and sight-based Perception. Show a simple sun/moon clock in the run header.

### Checks, not flat odds

Route every check through `shared/rules/checks.ts` (`checkModifier`, `passiveScore`, `resolveCheck`, `describeCheck`) with the real character sheet, replacing the hard-coded level 3:

- `investigate` choices name a skill (Investigation, Nature, Survival, Arcana) and a DC from `DC_BANDS`.
- `avoid` choices are Stealth vs the threat's passive Perception.
- Risk outcomes with a `combatSeed` decide **surprise** by comparing the threats' Stealth against the character's passive Perception (with the pace modifier), instead of `combatChance`. A surprised party starts combat surprised; an alert party can avoid or ambush instead. This one change teaches passive Perception better than any tooltip.

Show every roll the way the campaign play screen already does (`describeCheck`), so players see "Survival 14 vs DC 15: lost".

## 6. Feature C: Landmarks you can see coming

When a player enters a hex, reveal up to 2 landmarks within a sight radius (1 hex normally, 2 from hills, 3 from mountains, +1 for a scout, -1 in fog or at night). Landmarks are rendered on the hex map as glyphs before they are visited ("smoke on the horizon", "a broken tower"). Thread targets always show as a landmark once the thread reaches the `approach` beat. This gives players a visible destination, which is the main thing a hexcrawl needs to stop feeling random.

## 7. Feature D: Rumors in, rumors out

- When the Tavern serves a rumor, attach a target hex (3 to 8 hexes from the party) and optionally a thread template. Store the link (new nullable `targetHexQ`, `targetHexR`, `threadTemplateId` on `world_rumors`, or a join table, per Phase 0).
- Wander moves toward a rumored hex bias the roll toward that rumor's thread **sign**. Reaching the hex either confirms the rumor (start or advance the thread) or debunks it ("just an old charcoal burner's camp"), and both are logged so the Tavern can react.
- Completing a thread can create a new rumor in the pool ("they say someone cleared the warren north of the ford"), which closes the loop between modes.

## 8. Feature E: People who come back

Pull from the Ledger's cast when rolling `npc_echo`-style outcomes: a peddler met two runs ago reappears, remembers whether the player helped them, and offers something different. Keep it to a small table of recurring roles (peddler, rival adventurer, hermit, patrol) so it stays cheap and authorable. Write the meeting back through `mergeLedgerUpdates` so the campaign DM can use it.

## 9. UI changes (`client/src/pages/wander.tsx`)

- Before each move: pace toggle (Fast / Normal / Slow) and activity picker (Navigate / Forage / Scout), remembered between moves.
- Run header: day count, time-of-day clock, weather icon, food and water, exhaustion level.
- A **Journal** panel listing active threads with their latest beat text and bearing, plus confirmed rumors.
- Landmark glyphs on the hex map; the thread target shown with a dashed outline at `approach`.
- Roll results shown inline with the outcome text, in the same style as the main play screen.

## 10. Rollout

Ship behind per-campaign engagement flags, in this order:

1. **Checks and the real character** (Feature B, checks only). Smallest change, immediately makes outcomes feel earned.
2. **Threads** (Feature A) with 6 to 8 templates across forest, hills, swamp and ruins.
3. **Pace, activity, time, supplies** (rest of Feature B).
4. **Landmarks** (C), then **Rumors** (D), then **Recurring NPCs** (E).

## 11. Telemetry

Use the existing "where players stop playing" measurement:

- moves per Wander run, and runs per player per week (does Wander keep people?)
- thread start, beat reached, completion and abandonment rates per template (which threads are boring?)
- share of moves that went toward an active thread target (are bearings working?)
- Wander to Delve conversion from thread payoffs
- check outcomes by skill (are DCs fair?)

## 12. Open questions

1. Is a Wander hex the same scale as the campaign hex map? If the world map is not 6-mile hexes, the time math in 5 needs a different constant.
2. Solo play has one character doing navigate, forage and scout at once in real 5e only with a party. Do we let a solo character pick one per move (more faithful, more decisions), or do all three with penalties (simpler)? This spec assumes one.
3. Should thread payoffs that create a Delve entrance generate a fresh procedural dungeon themed to the thread, or pick from the authored dungeon list?
4. 2014 or 2024 travel rules (see Phase 0)?
