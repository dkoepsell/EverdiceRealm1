/**
 * Combat block — only included when a fight is live or the player just
 * attacked (engagement spec Phase 7: "combat.ts: only when in combat").
 */
export function combatBlock(enemies: { name: string; type?: string; currentHp?: number; maxHp?: number; ac?: number; status?: string }[]): string {
  const roster = enemies.length
    ? `ENEMIES (use these EXACT names; add new ones only if reinforcements arrive):\n${enemies.map((e) => `- "${e.name}" (${e.type ?? "enemy"}): HP ${e.currentHp ?? "?"}/${e.maxHp ?? "?"}, AC ${e.ac ?? "?"}, ${e.status ?? "healthy"}`).join("\n")}`
    : "";
  return `COMBAT:
${roster}
- Set storyState.inCombat = true while any enemy fights; false when all are defeated, fled or surrendered, or the party escapes.
- Keep storyState.combatants (enemies) and storyState.partyMembers (the player by their real name + companions) filled while in combat.
- Attack and damage results given above are final; narrate them. Report other damage in combatEffects by exact name.
- Conscious companions act each round (combatEffects.companionActions); unconscious ones (0 HP) do nothing.
- An unconscious player character can't act: offer what allies can do, and death saving throws.
- Offer 2–4 tactical choices that differ each round: name the target, use the terrain, defend, retreat, a class feature or spell.
- On victory, narrate finding the spoils; the system decides the actual loot, gold and XP.`;
}
