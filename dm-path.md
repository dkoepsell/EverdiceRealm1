# The DM path: from player to Dungeon Master

November 2026, branch `dm-path`. Migration: `scripts/migrations/007-dm-path.sql`. Tests: `tests/dmPath.test.ts` (47 checks). Played end to end against a local Postgres through the API and in a browser.

The mission is to graduate players from solo play to human tables, including running games themselves. This adds three things.

## 1. Become a DM (`/dm-path`, in the Explore menu)

Seven steps. Each one makes something real, saved on the server, and the last is running a game for someone else.

| Step | You make | Completes when |
|---|---|---|
| What a DM actually does | (reading) | you mark it read |
| Build a fair fight | an encounter, rated live with the DMG math | it's Medium for four level 2 characters |
| Make an NPC people remember | a name, want, secret, voice, attitude; optionally added to the Ledger of a campaign you run | all filled in (with feedback, e.g. "\"To help\" isn't much of a want") |
| Clues that can't be missed | a conclusion and three clues (the three clue rule) | three clues in three different places |
| Design a five-room dungeon | guardian, puzzle, setback, climax, reward, built as a **real Delve dungeon** | you playtest it in Delve |
| Session zero and table safety | a session-zero checklist (lines and veils, a pause tool, schedule, bonds) | every item checked |
| Run your first game | a session in a campaign you run, with another player | detected automatically |

The five-room builder gives feedback in DMG terms (encounter ratings, the DC ladder, trap damage by level, "add a twist"), and its monsters come from the SRD roster and the DMG budget. Your dungeons show up in your own Delve list and start from their saved layout; no one else can open them. From the last step you can post a dungeon as a one-shot on Find a Game.

The DM Toolkit's existing Training Center (about 30 reading lessons with quizzes) and the DM path link to each other: one is the reading, the other is the practice.

## 2. Behind the screen (learning in normal play)

Short notes on the DM craft behind what just happened, shown in Wander, at camp, and in fights. Examples: how this fight was built (encounter math), why the goblin fled (morale), why there's always another clue (three clue rule), why rumors lie, why the world moved on (doom clocks), why they remember you (NPCs with wants), why this trail is personal (session-zero bonds), why you're not dead (knocking out). Each links to the DM-path step that teaches it. Players can hide them; the setting is on the DM path page. Defined in `shared/dm/path.ts` (`SCREEN_NOTES`).

## 3. Toward live play

- **Milestone nudges** (`nudgesFor` in `shared/dm/path.ts`), one at a time and dismissible, on Wander and the DM path page:
  - level 3: "You're ready for a real table" (Find a Game, guilds, open to play)
  - three lessons learned, two trails finished or level 4: "Ever thought of running a game?"
  - built a dungeon but not yet run a game: "Run your dungeon for someone"
  - level 5: "Tier two"

  Nudges only link to pages. Nothing contacts anyone on the player's behalf.
- **Play together** (on the DM path page): an opt-in "open to live play" profile (play / run games / either, time zone, time slots, style). Only players who opt in can see each other, matched by shared time slots and complementary roles, active in the last 60 days. Only usernames, roles, times, styles and character level are shown, with a link to their Find a Game post if they have one. Contact happens through Find a Game, as before. There is no new private messaging.

## Also fixed

The DMG encounter builder (used by Wander fights and the DM path) now builds both ways, a leader with followers or a pack of rank and file, and keeps whichever lands closest to the budget. Before, a leader alone could leave an "easy" fight trivial.

## Not done

- Publishing player-made dungeons for other players to play. That needs moderation of user-written text first.
- Scheduling tools (proposing a time, calendar invites). Find a Game posts carry preferred times for now.
- The Training Center's reading progress is still kept only in the browser tab.
