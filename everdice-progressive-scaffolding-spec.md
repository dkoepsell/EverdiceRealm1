# Spec: Progressive Scaffolding & Imagination Engine (Everdice / CAML)

**Audience:** Claude Code (implementing agent)
**Target codebase:** `EverdiceRealm1` (TypeScript/Node, PostgreSQL + Drizzle, WebSockets, CAML 2 runtime)
**Status:** Ready to build, phased. Phase 0 is mandatory recon before any code.

---

## 0. How to use this spec

This document proposes module names, types, and a data model. **They are proposals.** Before writing code, do Phase 0: read the real codebase and reconcile.

> **Phase 0 — Recon (no behavior change). Do this first and report findings.**
> 1. Locate the CAML 2 node/edge type definitions and the runtime that ingests them. Document: how a node, its `choices`/transitions, and current world-state are represented.
> 2. Locate the solo/AI play loop: where freeform player input is parsed, where the LLM is called, where state transitions are applied and persisted.
> 3. Identify whether any of these already exist in some form: player-facing suggestions/choices generation, intent/NLU parsing of freeform text, per-player per-campaign state storage, telemetry/event emission.
> 4. Confirm the Drizzle models for session/campaign/player state and where a new table or jsonb field would fit.
> 5. Map every "PROPOSED" name below to either an existing construct or a new one, and note deltas inline before proceeding.

`[CONFIRM]` markers flag decisions that need the answers from Phase 0.

---

## 1. Goal & non-goals

**Goal.** Turn the current "concrete choices + open option" interface into a *fading scaffold*: a system that teaches a brand-new player the grammar of theater-of-the-mind play and then progressively removes the menu until they're declaring intent in free prose — which is both "real D&D" and the creative skill the product exists to build. Experienced players bypass scaffolding entirely and get generative friction (oracle/complications) instead.

**Core principle.** The suggestions are a teaching tool whose job is to make themselves obsolete. Scaffolding fades as a function of *demonstrated player behavior*, not manual configuration.

**Non-goals (this spec).**
- Does **not** apply to human-DM multiplayer tables (the human is the engine; dial is off there — see §11).
- Does **not** change the authored-adventure structure of CAML; all additions are backward-compatible and additive.
- Not a combat-system or rules-engine rewrite. Mechanics transparency (§8) is presentation only.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Rung** | The player's current scaffolding level: `GUIDED`, `HYBRID`, `OPEN`, `PURE`. |
| **Scripted edge** | An authored CAML transition out of the current node. |
| **Affordance / noticing** | A *sensory or situational hint* that implies an action without naming it ("a loose floorboard," not "search the floor"). |
| **Freeform / off-menu** | Player typed prose instead of selecting a presented option. |
| **Intent resolution** | Mapping freeform prose to a scripted edge, an info answer, or an improvised consequence. |
| **Improvisation layer** | Resolves player actions that have no authored edge, without corrupting authored ("canonical") state. |
| **Diegetic rendering** | Presenting suggestions inside the fiction (character impulses / sensory hooks) rather than as a UI button list. |

---

## 3. Data model

### 3.1 Player progression state (new)

Per player **per campaign**. `[CONFIRM]` table vs jsonb-on-existing-session, based on Phase 0.

PROPOSED Drizzle table `player_progression`:

```ts
// PROPOSED — reconcile names/types with existing schema
{
  id: uuid (pk),
  campaignId: uuid (fk),
  playerId: uuid (fk),
  rung: enum('GUIDED','HYBRID','OPEN','PURE')  default 'GUIDED',
  rungPinned: boolean default false,        // manual override; disables auto-advancement
  expertMode: boolean default false,         // see §9
  rulesVerbosity: enum('verbose','terse','off') nullable, // null = derive from rung
  turnSignals: jsonb,   // rolling window, see §3.2 (cap to last WINDOW_SIZE)
  lastRungChangeTurn: integer default 0,
  totalTurns: integer default 0,
  createdAt, updatedAt
}
```

### 3.2 TurnSignal (recorded every solo turn)

```ts
interface TurnSignal {
  turnIndex: number;
  inputMode: 'menu' | 'affordance' | 'freeform';
  inputLength: number;                 // chars (or tokens if cheap)
  elaborationScore: number;            // 0..1, see §6.1
  resolutionType: 'scripted_edge' | 'resolved_intent' | 'improvised' | 'info' | 'invalid';
  usedHintButton: boolean;
  struggleSignal: boolean;             // short+invalid, repeated hint use, confusion
}
```

Persist only the last `WINDOW_SIZE` signals (default 12) in `turnSignals`; older ones can be dropped or aggregated to a telemetry sink (§10).

### 3.3 CAML additive extension — `affordances`

Backward-compatible optional field on a node, parallel to existing `choices`/edges. `[CONFIRM]` exact CAML node shape from Phase 0.

```jsonc
// PROPOSED additive field on a CAML node
{
  "id": "node_cellar",
  "choices": [ /* existing scripted edges, unchanged */ ],
  "affordances": [
    {
      "hint": "a loose floorboard near the far wall",   // diegetic noticing, no imperative verb
      "edgeId": "to_hidden_cache",                       // optional: which scripted edge this points toward
      "tags": ["search","hidden"]
    }
  ]
}
```

- `affordances` is **optional**. When absent, the engine generates affordances from `choices` + node prose at runtime (§5.3) so unauthored adventures still work.
- An affordance MAY map to a scripted `edgeId`, or be pure flavor (no edge) that the improvisation layer resolves.

---

## 4. The progression engine (`progression/`)

A pure state machine: given the rolling `turnSignals` + config, compute the target rung. Side-effect-free core + thin persistence wrapper.

### 4.1 Config constants (tunable; put in one config module)

```ts
const PROGRESSION_CONFIG = {
  WINDOW_SIZE: 12,            // turns in rolling window
  STRUGGLE_WINDOW: 6,
  COOLDOWN_TURNS: 5,         // min turns between rung changes
  CONFIRM_EVALS: 2,          // consecutive evals meeting threshold before promotion

  promote: {
    GUIDED_TO_HYBRID:  { freeformRate: 0.30, consecutiveFreeform: 3 }, // either condition
    HYBRID_TO_OPEN:    { freeformRate: 0.60, avgElaboration: 0.40 },   // both
    OPEN_TO_PURE:      { freeformRate: 0.85, avgElaboration: 0.60 },   // both
  },
  demote: {
    struggleRate: 0.40,      // over STRUGGLE_WINDOW → drop one rung (floor GUIDED)
  },
} as const;
```

### 4.2 Evaluation (runs once per solo turn, after the turn is recorded)

1. If `rungPinned` or `expertMode` → no auto-change. Return current rung (expert is pinned to `PURE`, §9).
2. If `totalTurns - lastRungChangeTurn < COOLDOWN_TURNS` → no change (hysteresis).
3. Compute over window: `freeformRate`, `avgElaboration`, `consecutiveFreeform`, and over `STRUGGLE_WINDOW`: `struggleRate`.
4. **Demotion first:** if `struggleRate ≥ demote.struggleRate` → drop one rung (floor `GUIDED`), reset confirm counter, set `lastRungChangeTurn`.
5. **Promotion:** if the current rung's promote threshold is met for `CONFIRM_EVALS` consecutive evaluations → advance one rung, set `lastRungChangeTurn`.
6. Persist new rung if changed; emit `rung.changed` event (§10).

> Promotion advances **one rung at a time** even if the player blows past thresholds — except expert mode, which jumps to `PURE` immediately.

### 4.3 Manual control

- Player-facing setting "Guidance level": `Auto` (default) or a pinned rung. Pinning sets `rungPinned = true`.
- A clearly-worded explanation in UI: *"Everdice eases off the suggestions as you get comfortable. Want it to back off faster, or stay? Set it here."*

---

## 5. Suggestions (`suggestions/`)

### 5.1 Visibility by rung

| Rung | Open prose input | Suggestions | Form |
|---|---|---|---|
| `GUIDED` | present, secondary | 3–4 shown, persistent | diegetic impulses (§5.2) |
| `HYBRID` | **primary / focused default** | 2–3 shown behind a soft "ideas?" reveal | affordances / noticings |
| `OPEN` | only input | none shown; "Need a nudge?" button reveals 1–2 on demand | affordances |
| `PURE` | only input | none, ever; no button | — |

### 5.2 Diegetic rendering rule (applies at every rung that shows anything)

**Never** render suggestions as a bare list of imperative verbs. Render as the character's own instinct or sensory pull, in prose voice matching the scene.

| ❌ UI/imperative (do not ship) | ✅ Diegetic affordance |
|---|---|
| "Search the desk" | "The desk drawer sits very slightly ajar." |
| "Draw your sword" | "Your hand drifts to the hilt without you deciding it should." |
| "Talk to the guard" | "The guard is bored enough to talk, if you gave him a reason." |
| "Go north / Go east" | "The corridor forks — cold air from the left, torchlight from the right." |

**Rewrite contract:** a suggestion entering the renderer is `{ text, edgeId?, tags }`; the renderer returns prose that (a) contains no second-person imperative verb, (b) names a *noticing* or *impulse*, (c) does not state the outcome. Implement as a deterministic template pass for authored affordances; use an LLM rewrite pass for generated ones (§5.3), with the contract above as the system instruction.

### 5.3 Affordance generation (when node has no authored `affordances`)

Given node prose + scripted `choices`, generate up to N affordances:
1. For each scripted edge, derive a noticing that *hints* at it without naming the action, carrying `edgeId`.
2. Optionally add 1 pure-flavor affordance with no edge (resolved by improvisation layer) to teach that off-menu works.
3. Cache generated affordances on the session node-instance to keep them stable within a turn. `[CONFIRM]` LLM budget/caching strategy.

---

## 6. Creativity loop (`suggestions/` + `improvisation/`)

### 6.1 Elaboration scoring & invitation

`elaborationScore` (0..1), baseline deterministic, optional LLM upgrade:
- Baseline heuristic: presence of (verb) + (object/target) + (manner or instrument). e.g. "I attack" → low; "I feint left then drive the dagger up under his ribs" → high. Normalize on a simple rubric (count of the three components + length bucket).
- **Invitation rule:** at `GUIDED`/`HYBRID`, if `elaborationScore < 0.3` on a state-affecting action, the engine asks one in-fiction follow-up ("With what? How?") **before** resolving. Once the player's trailing-window `avgElaboration ≥ 0.4`, stop inviting — the scaffold has done its job.
- **Mirror richness:** pass the player's detail through to the resolution prompt so richer input demonstrably yields richer narration. This is the feedback loop that teaches "input quality → output quality."

### 6.2 "Yes, and" engine — off-graph resolution (the hard part)

When freeform input does **not** match a scripted edge, never hard-block. Resolve via the improvisation layer (§7) so the attempt *matters*.

### 6.3 Legibility moments

Occasionally (rate-limited, e.g. once per session max, and only when `resolutionType === 'improvised'` led somewhere meaningful), surface a one-line meta-note:
> *"That route only opened because you tried something the game never suggested."*

Gate behind a config flag `LEGIBILITY_MOMENTS_ENABLED` and a per-session cap so it never nags.

---

## 7. Improvisation layer (`improvisation/`) — canonical-state guard

This is the architectural core. CAML is a state machine over an authored graph; players will act outside it. Resolve those actions **without corrupting authored state.**

### 7.1 Resolution pipeline for freeform input

1. **Match to scripted edge.** Semantic match of intent against current node's `choices` + `affordances`. If confident → take that edge. `resolutionType = 'resolved_intent'`.
2. **No match → classify** the intent:
   - `info` — player is asking/looking, not changing the world → answer within fiction, stay on node.
   - `flourish` — narration/roleplay with no mechanical stake → "yes, and" narrate, no state change beyond flavor, stay on node.
   - `state_changing` — a novel action that should affect the world → **improvised transition** (step 3).
   - `invalid/unclear` → ask one clarifying in-fiction question; mark `struggleSignal` if it persists.
3. **Improvised transition.** Generate a consequence, then route back into the authored graph:
   - Apply effects **only** to the improvised state layer (§7.2).
   - Rejoin the graph at the nearest sensible authored node, or generate a short interstitial beat that returns to the current node / an adjacent one. Never strand the player off-graph.
   - `resolutionType = 'improvised'`.

### 7.2 State layering (hard rule)

```jsonc
worldState: {
  canonical: { /* authored flags the adventure logic depends on — WRITE-PROTECTED from improvisation */ },
  improvised: { /* additive narrative deltas from off-graph actions */ }
}
```

- The improvisation layer MAY read `canonical` but MUST NOT overwrite a flag that any authored edge condition reads. Enforce with a guard: improvised writes go to `improvised`; a write targeting a canonical key is rejected and logged.
- Reads for narration merge both layers (improvised shadows canonical for *flavor* only, never for *gating* authored transitions).
- `[CONFIRM]` how current CAML stores world-state flags, to define the protected key set.

### 7.3 Guardrails

- Improvisation cannot grant items/abilities that bypass authored gates (e.g. can't "improvise" the key that a scripted lock requires) — such attempts resolve as effort + complication, not success.
- Hard cap on consecutive improvised turns before steering back toward authored content (default 3), to keep adventures coherent.

---

## 8. Mechanics transparency (`mechanics/`)

Teach *transferable* D&D, not "how to use Everdice." When a check/roll occurs, narrate the rule reasoning at a verbosity derived from rung (overridable via `rulesVerbosity`):

| Verbosity | Default rung | Example before/around a roll |
|---|---|---|
| `verbose` | GUIDED | "Climbing the wet rope is a Strength (Athletics) check — roll a d20 and add your Athletics. Need 12+." |
| `terse` | HYBRID | "Athletics check (DC 12)…" |
| `off` | OPEN, PURE | *(just narrate the outcome)* |

Implement as a single formatter that takes `(checkContext, verbosity)` and returns pre/post-roll narration fragments. Verbosity = `player_progression.rulesVerbosity ?? deriveFromRung(rung)`.

---

## 9. Expert mode & oracle engine

`expertMode = true`:
- Pins rung to `PURE`; auto-advancement disabled; suggestions never auto-shown; "nudge" button hidden.
- Enables the **oracle / generative-friction engine** in place of suggestions:
  - On request (player asks the oracle) or on configured triggers, inject `yes / yes-but / no / no-and` style complications and scene twists.
  - `oracleConfig: { complicationFrequency, twistOnSceneChange: bool, oracleOnDemand: bool }`.
- Entry points: a one-tap "Experienced player" toggle at campaign start, and auto-offer once a player reaches `PURE` organically ("Want to switch to expert mode? Suggestions off, oracle on.").

This satisfies the veteran audience: not *fewer features*, a *different engine flavor* — unpredictability instead of options (the Mythic GME / Ironsworn tradition).

---

## 10. Telemetry / events

Emit (to existing event bus / sink — `[CONFIRM]`):
- `rung.changed { playerId, campaignId, from, to, trigger }`
- `turn.offMenu { resolutionType }`
- `turn.improvised { steeredBack: bool }`
- `elaboration.invited` / `elaboration.satisfied`
- `expert.enabled`

Value: tunes thresholds, and **measures the acquisition funnel** — proves whether scaffolded solo players progress toward unscaffolded (i.e. real-skill) play and onward to multiplayer. Wire a simple aggregate: distribution of players across rungs over time.

---

## 11. Multiplayer scope

- Human-DM tables: scaffolding dial **off** (DM is the engine). Affordance/diegetic rendering and mechanics-transparency formatter MAY still be offered as optional DM aids, but no auto-progression and no improvisation layer.
- AI-run multiplayer (if it exists): treat each human as an independent progression state; suggestions are private to each player. `[CONFIRM]` whether AI-run multiplayer exists today.

---

## 12. Proposed module layout

```
/server/play/
  progression/      # rung state machine, metrics, config, evaluation
  suggestions/      # visibility-by-rung, diegetic renderer, affordance generation
  improvisation/    # intent resolution, off-graph resolver, canonical-state guard
  mechanics/        # rules-verbosity check formatter
  scaffolding.types.ts
```
Reconcile with actual structure in Phase 0.

---

## 13. Phased implementation plan

Each phase is independently shippable.

**Phase 0 — Recon + scaffolding (no behavior change).** §0. Add types, config module, `player_progression` storage, TurnSignal recording, telemetry events. Record signals and evaluate rung **without acting on it** (shadow mode) to validate thresholds against real play.

**Phase 1 — The dial.** Act on rung: visibility-by-rung (§5.1) using *existing* suggestion text, plus manual "Guidance level" control (§4.3). Smallest change that delivers the core value (scaffold that fades).

**Phase 2 — Diegetic suggestions + affordances.** Diegetic renderer (§5.2), CAML `affordances` field (§3.3), runtime affordance generation (§5.3).

**Phase 3 — Improvisation layer.** Intent resolution, off-graph "yes, and," state layering + canonical guard (§7). Highest value, highest risk — isolate and test hard.

**Phase 4 — Creativity & expert polish.** Elaboration invitation + mirroring (§6.1), legibility moments (§6.3), mechanics transparency (§8), expert/oracle mode (§9), and the tutorial sandbox room (below).

**Tutorial sandbox (Phase 4):** a CAML adventure flagged `isTutorial` whose single lesson is *"you can attempt anything and the world responds."* Forces a couple of off-menu attempts and rewards them, seeding the off-menu habit early.

---

## 14. Acceptance criteria

**Progression engine**
1. Given a window where `freeformRate ≥ 0.30`, a `GUIDED` player promotes to `HYBRID` after `CONFIRM_EVALS` evals, never sooner.
2. No rung changes within `COOLDOWN_TURNS` of a prior change.
3. `struggleRate ≥ 0.40` over `STRUGGLE_WINDOW` demotes exactly one rung; never below `GUIDED`.
4. `rungPinned` or `expertMode` ⇒ zero auto-changes.
5. Promotion never skips a rung (except expert → `PURE`).

**Suggestions**
6. Visibility matches §5.1 exactly at each rung; `PURE` shows no suggestions and no nudge button.
7. No rendered suggestion at any rung contains a second-person imperative verb (automated lint on renderer output).
8. Nodes without authored `affordances` still produce suggestions at `GUIDED`/`HYBRID`.

**Improvisation**
9. A freeform action matching a scripted edge takes that edge (`resolved_intent`), not an improvised path.
10. An improvised write targeting a canonical flag is rejected and logged; canonical gating is unaffected.
11. Player is never stranded off-graph; after ≤ `IMPROV_MAX_CONSECUTIVE` improvised turns, play steers back to authored content.
12. An off-graph attempt never grants an item/ability that bypasses an authored gate.

**Creativity & mechanics**
13. At `GUIDED`/`HYBRID`, a state-changing input with `elaborationScore < 0.3` triggers exactly one in-fiction follow-up before resolving; invitations stop once `avgElaboration ≥ 0.4`.
14. Roll narration verbosity matches the rung-derived default unless `rulesVerbosity` is set.

**Scope**
15. Human-DM tables show no auto-progression and run no improvisation layer.

**Backward compatibility**
16. Existing CAML adventures (no `affordances`, no state layering) run unchanged.

---

## 15. Open items for David (`[CONFIRM]`)

- Progression state storage: dedicated table vs jsonb on existing session model (Phase 0 answers).
- Exact CAML node/edge/world-state shapes → defines the protected canonical key set and the `affordances` reconciliation.
- Whether an intent/NLU step already exists in the solo loop to hook into, vs build new.
- LLM cost budget for affordance generation, elaboration scoring, and improvisation (and where to use deterministic baselines vs LLM).
- Whether AI-run multiplayer exists (affects §11).
- Event sink/telemetry destination for §10.
