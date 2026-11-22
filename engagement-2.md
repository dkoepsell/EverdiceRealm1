# Engagement 2: real fights, personal trails, a shared realm, and a world that moves

November 2026. Built on branch `engagement-2`, each feature behind its own engagement flag (all default on). Migration: `scripts/migrations/006-realm-marks.sql`. Tests: `tests/skirmish.test.ts` (99 checks), `tests/wanderThreads.test.ts` (213). Played end to end against a local Postgres through the API and in a browser.

## 1. Real fights in Wander and Delve (`exploreCombat`)

Before this, a fight in Wander was a line of narration and Delve had a "Combat Resolved, Continue" button. Now both run a real 5e fight on the server.

- **Engine:** `server/play/skirmish/engine.ts` (pure), routes in `server/play/skirmish/routes.ts`, UI in `client/src/components/skirmish/SkirmishPanel.tsx`.
- **Your turn** reuses the campaign engine's `resolveClassTurn`, so class features work the same everywhere: Extra Attack, Sneak Attack, Rage, Reckless Attack, Action Surge, Divine Smite, Cunning Action, Second Wind, Flurry of Blows. Casters get signature spells (`spells.ts`): Fire Bolt, Eldritch Blast, Sacred Flame, Vicious Mockery, Produce Flame, Magic Missile, Guiding Bolt, Thunderwave, Dissonant Whispers, Cure Wounds, Healing Word, with real slots, upcasting, save DCs and the bonus-action spell rule. If the character has a known-spells list, levelled spells are filtered by it.
- **Monsters** are SRD 5.1 stat blocks (`shared/rules/monsters.ts`): multiattack, Pack Tactics, knock-prone bites, poison riders, Undead Fortitude, skeletons' bludgeoning vulnerability. Delve keeps its own stat blocks.
- **Encounters** are built with the DMG budget: XP thresholds, the multiplier for numbers of monsters, and the solo-party adjustment. Every fight shows its math ("2 Wolves: 100 XP x2 = 200 adjusted XP. A medium fight...").
- **Dangerous things stay dangerous.** An owlbear is rated Deadly at level 3 and stays an owlbear. Fleeing is real: Disengage (no opportunity attacks) or Dash (double speed, but provokes); anything faster than you means a Stealth check against its passive Perception.
- **Surprise** from Wander's passive-Perception check carries into the fight. **Morale** (DMG optional rule): a monster that isn't fearless checks once when it drops below half HP.
- **Losing** knocks you out rather than killing you (the PHB lets attackers choose that); you wake with 1 HP and the run ends.
- **Winning** awards XP through `storage.awardXPToCharacter`, so level-ups work as in campaigns. A Wander trail climax fight now has to be won for the payoff (the old "fight costs a level of exhaustion" stand-in is gone when this flag is on). A Delve room clears itself on victory, and `combat_won` is refused.
- **Rests are real.** Making camp is a long rest (all HP, half your Hit Dice, features and spell slots back), provided you had some food or water. A new short rest spends Hit Dice and recharges short-rest features.

## 2. Personal trails (`backstoryTrails`)

One trail per character per campaign, chosen by PHB background (Soldier, Acolyte, Criminal/Spy/Charlatan, Folk Hero, Sage, Noble, Outlander/Hermit/Sailor, and a general one for anything else). It starts on the character's first real wander, quotes their bond if they have one, runs on the normal trail engine, and pays off with Inspiration, the PHB's reward for playing your character.

## 3. The shared realm (`sharedRealm`)

Every player wanders the same map, so it's now shared, West Marches style. Players can leave signs on a hex from a fixed list of phrases ("Danger ahead", "Water here", "Try stealth"...), so there's nothing to moderate. Others see them on the map and when they arrive, and can nod at signs that helped. Losing a fight leaves a cairn (🪦 "Wren was beaten here by owlbear"); finishing a trail leaves a flag (🏁 "Found The Rotfang Warren"). Only character names are shown.

## 4. The world moves (`worldClocks`)

Each random trail has a deadline in in-game days, counted each time you make camp. The clock never runs in real time, so being away costs nothing; ignoring a trail while you travel does. When it runs out, the consequence happens ("The Bonegnaw goblins raided the farms east of town"), it's posted to the campaign's rumors, and it's told to you at camp. The journal shows the days left. Personal trails have no clock; Tavern rumors go quietly stale after 8 days.

## Known gaps

- **Co-op Delve and Wander** (2 to 4 characters) are the next big step; the fight engine has one character and many monsters.
- Monsters don't use their special actions yet (webs, breath weapons, boss phases, lair actions); Delve's boss phase and lair-action text is still only flavour.
- Spells are a signature set per class, not the full spell list; warlock slots don't come back on a short rest yet.
- Fleeing a Delve room leaves you in it, still uncleared; you can move on to another room.
