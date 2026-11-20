/**
 * The JSON the turn must return (engagement spec Phase 7). Field names are
 * unchanged — the response handling in routes.ts reads them — but each is
 * described once, briefly, and situational fields only when they apply.
 */
export function responseSchema(opts: { inCombat: boolean; mapped: boolean; extras: string }): string {
  return `Respond with JSON only:
{
  "narrative": "the scene, per LENGTH",
  "sceneType": "Exploration|Social|Discovery|Travel|Puzzle|Downtime|Combat",
  "dmNarrative": "one or two sentences of behind-the-scenes intent (what NPCs plan)",
  "choices": [{
    "text": "the action, specific to this moment",
    "hint": "the same choice as an in-fiction noticing or impulse, no imperative verbs, no outcome",
    "type": "action|dialogue|exploration|magic|stealth|combat",
    "requiresDiceRoll": false,
    "skillType": "only if a roll: perception|investigation|insight|persuasion|deception|intimidation|stealth|athletics|acrobatics|arcana|history|nature|religion|survival|medicine|animal_handling|sleight_of_hand|performance — or \\"attack\\" for striking a creature",
    "rollDC": "only if a roll: 5|10|15|20|25",
    "rollPurpose": "only if a roll, e.g. \\"Charisma (Persuasion)\\"",
    "successText": "only if a roll", "failureText": "only if a roll"
  }],
  "storyState": {"location": "where the party is at the END of the scene", "inCombat": false, "activeNPCs": [], "plotPoints": [], "activeQuests": [{"id": "quest_1", "title": "", "description": "", "status": "active|in_progress|completed", "xpReward": 100}]${opts.inCombat ? `, "combatants": [{"name": "", "type": "enemy|boss", "cr": "1/4", "maxHp": 0, "currentHp": 0, "ac": 0, "attackBonus": 0, "damage": "1d6+2", "status": "healthy|wounded|bloodied|defeated"}], "partyMembers": [{"name": "", "type": "player|companion", "maxHp": 0, "currentHp": 0, "ac": 0, "status": ""}]` : ""}},
  "movement": {"occurred": false, "direction": "north|south|east|west|... or null", "destination": "place name or null", "description": "e.g. entered the eastern chamber"}${opts.inCombat ? `,
  "combatEffects": {"playerDamageTaken": 0, "enemyDamage": [{"name": "", "damage": 0}], "partyDamage": [], "companionActions": [], "combatDescription": ""}` : ""}${opts.mapped ? `,
  "dungeonState": {"currentRoom": {"id": "room_1", "name": "matches storyState.location", "type": "entrance|corridor|chamber|cavern|hall|treasure_room|trap_room|puzzle_room", "description": ""}, "exits": [{"direction": "north|south|east|west", "description": "", "visible": true, "locked": false, "leadsTo": null}], "features": [{"type": "chest|statue|altar|trap|secret_door", "position": "center|corner|along_wall", "description": ""}], "lighting": "bright|dim|dark", "dangerLevel": "safe|low|medium|high|deadly"},
  "mapModifications": [{"type": "update_narrative|add_secret|place_enemy|add_treasure|add_npc", "x": 0, "y": 0, "data": {"description": "", "shortDescription": "", "npcs": [], "items": [], "enemies": [], "dangerLevel": "safe"}}]` : ""}
}
Also include ONLY when they change this turn: "questUpdates", "npcInteractions", "rewardItems", "campaignStakeUpdates", "factionUpdates", "villainUpdate", "complicationUsed", "encounterUsed", "trackingUpdates", "failureAdvancement", "instabilityUpdate", "narrativeLogEntry", "momentousChoiceResolution" (a campaign-defining, irreversible decision: {choice, consequence, worldChange, powersGranted, reputationEffect, isCampaignTerminus}), "sessionBreakpoint": true (only at a genuine pause, never mid-tension), "chapterGateMet": {"gateId": <current chapter number>, "reason": ""} (when this chapter's central conflict reaches a clear turning point).
${opts.extras}Omit fields that don't apply. Never pad with empty arrays or nulls.`;
}
