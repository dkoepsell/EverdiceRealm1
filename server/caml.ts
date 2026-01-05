import * as yaml from 'js-yaml';
import type {
  CAMLAdventureModule,
  CAMLAdventurePack,
  CAMLLocation,
  CAMLNPC,
  CAMLItem,
  CAMLEncounter,
  CAMLQuest,
  CAMLEntity,
  CAMLStatblock,
  CAMLAbilities
} from '../shared/caml';

export function parseCAMLYaml(content: string): CAMLAdventurePack | null {
  try {
    const parsed = yaml.load(content) as any;
    console.log('YAML parsed:', parsed ? 'success' : 'null', parsed?.type, parsed?.id);
    if (!parsed) return null;
    
    // Check if it's a direct adventure module by type or id pattern
    if (parsed.type === 'AdventureModule' || parsed.id?.startsWith('adventure.')) {
      return {
        adventure: { ...parsed, type: 'AdventureModule' } as CAMLAdventureModule,
        entities: buildEntityIndex({ ...parsed, type: 'AdventureModule' })
      };
    }
    
    // Check if it's wrapped in an adventure key
    if (parsed.adventure) {
      return {
        adventure: parsed.adventure as CAMLAdventureModule,
        entities: parsed.entities || buildEntityIndex(parsed.adventure)
      };
    }
    
    // Fallback: treat as adventure if it has title and some content
    if (parsed.title && (parsed.locations || parsed.npcs || parsed.encounters || parsed.quests)) {
      const adventure = { ...parsed, type: 'AdventureModule', id: parsed.id || `adventure.${Date.now()}` };
      return {
        adventure: adventure as CAMLAdventureModule,
        entities: buildEntityIndex(adventure)
      };
    }
    
    console.log('YAML parsing failed - no matching structure, keys:', Object.keys(parsed));
    return null;
  } catch (error) {
    console.error('Failed to parse CAML YAML:', error);
    return null;
  }
}

export function parseCAMLJson(content: string): CAMLAdventurePack | null {
  try {
    const parsed = JSON.parse(content);
    console.log('JSON parsed:', parsed ? 'success' : 'null', parsed?.type, parsed?.id);
    if (!parsed) return null;
    
    // Check if it's a direct adventure module by type or id pattern
    if (parsed.type === 'AdventureModule' || parsed.id?.startsWith('adventure.')) {
      return {
        adventure: { ...parsed, type: 'AdventureModule' } as CAMLAdventureModule,
        entities: buildEntityIndex({ ...parsed, type: 'AdventureModule' })
      };
    }
    
    // Check if it's wrapped in an adventure key
    if (parsed.adventure) {
      return {
        adventure: parsed.adventure as CAMLAdventureModule,
        entities: parsed.entities || buildEntityIndex(parsed.adventure)
      };
    }
    
    // Fallback: treat as adventure if it has title and some content
    if (parsed.title && (parsed.locations || parsed.npcs || parsed.encounters || parsed.quests)) {
      const adventure = { ...parsed, type: 'AdventureModule', id: parsed.id || `adventure.${Date.now()}` };
      return {
        adventure: adventure as CAMLAdventureModule,
        entities: buildEntityIndex(adventure)
      };
    }
    
    console.log('JSON parsing failed - no matching structure, keys:', Object.keys(parsed));
    return null;
  } catch (error) {
    console.error('Failed to parse CAML JSON:', error);
    return null;
  }
}

function buildEntityIndex(adventure: CAMLAdventureModule): Record<string, CAMLEntity> {
  const index: Record<string, CAMLEntity> = {};
  
  index[adventure.id] = adventure;
  
  if (adventure.locations) {
    for (const loc of adventure.locations) {
      index[loc.id] = loc;
    }
  }
  
  if (adventure.npcs) {
    for (const npc of adventure.npcs) {
      index[npc.id] = npc;
    }
  }
  
  if (adventure.items) {
    for (const item of adventure.items) {
      index[item.id] = item;
    }
  }
  
  if (adventure.encounters) {
    for (const enc of adventure.encounters) {
      index[enc.id] = enc;
    }
  }
  
  if (adventure.quests) {
    for (const quest of adventure.quests) {
      index[quest.id] = quest;
    }
  }
  
  if (adventure.factions) {
    for (const faction of adventure.factions) {
      index[faction.id] = faction;
    }
  }
  
  return index;
}

export interface ConvertedCampaignData {
  title: string;
  description: string;
  setting: string;
  minLevel: number;
  maxLevel: number;
  npcs: Array<{
    name: string;
    description: string;
    race?: string;
    class?: string;
    level?: number;
    alignment?: string;
    attitude?: string;
    statblock?: any;
  }>;
  locations: Array<{
    name: string;
    description: string;
    connections?: any[];
    features?: string[];
  }>;
  encounters: Array<{
    name: string;
    description: string;
    type: string;
    difficulty?: string;
    enemies?: any[];
    rewards?: any;
  }>;
  quests: Array<{
    name: string;
    description: string;
    objectives?: any[];
    rewards?: any;
    status: string;
  }>;
  items: Array<{
    name: string;
    description: string;
    type?: string;
    rarity?: string;
    properties?: string;
  }>;
  initialStoryState: any;
}

export function convertCAMLToCampaign(pack: CAMLAdventurePack): ConvertedCampaignData {
  const adventure = pack.adventure;
  
  const npcs = (adventure.npcs || []).map(npc => ({
    name: npc.name || npc.id,
    description: npc.description || '',
    race: npc.race,
    class: npc.class,
    level: npc.level,
    alignment: npc.alignment,
    attitude: npc.attitude,
    statblock: npc.statblock ? {
      ac: npc.statblock.ac,
      hp: npc.statblock.hp,
      hitDice: npc.statblock.hitDice,
      speed: npc.statblock.speed,
      abilities: npc.abilities || npc.statblock.abilities,
      cr: npc.statblock.cr
    } : undefined
  }));
  
  const locations = (adventure.locations || []).map(loc => ({
    name: loc.name || loc.id,
    description: loc.description || '',
    connections: loc.connections,
    features: loc.features
  }));
  
  const encounters = (adventure.encounters || []).map(enc => ({
    name: enc.name || enc.id,
    description: enc.description || '',
    type: enc.encounterType || 'combat',
    difficulty: enc.difficulty,
    enemies: enc.enemies,
    rewards: enc.rewards
  }));
  
  const quests = (adventure.quests || []).map(quest => ({
    name: quest.name || quest.id,
    description: quest.description || '',
    objectives: quest.objectives,
    rewards: quest.rewards,
    status: 'active'
  }));
  
  const items = (adventure.items || []).map(item => ({
    name: item.name || item.id,
    description: item.description || '',
    type: item.itemType,
    rarity: item.rarity,
    properties: item.properties
  }));
  
  return {
    title: adventure.title || adventure.name || 'Imported Adventure',
    description: adventure.synopsis || adventure.description || '',
    setting: adventure.setting || 'Fantasy',
    minLevel: adventure.minLevel || 1,
    maxLevel: adventure.maxLevel || 5,
    npcs,
    locations,
    encounters,
    quests,
    items,
    initialStoryState: {
      camlAdventureId: adventure.id,
      camlVersion: adventure.version,
      startingLocation: adventure.startingLocation,
      hooks: adventure.hooks,
      state: adventure.initialState || {},
      entityIndex: Object.keys(pack.entities)
    }
  };
}

export function convertCampaignToCAML(
  campaign: any,
  sessions: any[],
  participants: any[],
  npcs: any[],
  quests: any[]
): CAMLAdventureModule {
  const latestSession = sessions[sessions.length - 1];
  const storyState = latestSession?.storyState || {};
  
  const camlLocations: CAMLLocation[] = [];
  if (storyState.journeyLog) {
    const uniqueLocations = new Set<string>();
    for (const entry of storyState.journeyLog) {
      if (entry.description && !uniqueLocations.has(entry.description.slice(0, 50))) {
        uniqueLocations.add(entry.description.slice(0, 50));
        camlLocations.push({
          id: `location.${camlLocations.length + 1}`,
          type: 'Location',
          name: `Location ${camlLocations.length + 1}`,
          description: entry.description,
          tags: [entry.type || 'explored']
        });
      }
    }
  }
  
  const camlNpcs: CAMLNPC[] = npcs.map((npc, i) => ({
    id: `npc.${npc.name?.toLowerCase().replace(/\s+/g, '_') || i}`,
    type: 'NPC' as const,
    name: npc.name,
    description: npc.description,
    race: npc.race,
    class: npc.class,
    alignment: npc.alignment,
    attitude: npc.attitude as any,
    ruleset: 'dnd5e',
    statblock: npc.statblock ? {
      ac: npc.statblock.ac,
      hp: npc.statblock.hp,
      cr: npc.statblock.cr
    } : undefined
  }));
  
  const camlQuests: CAMLQuest[] = quests.map((quest, i) => ({
    id: `quest.${quest.title?.toLowerCase().replace(/\s+/g, '_') || i}`,
    type: 'Quest' as const,
    name: quest.title,
    description: quest.description,
    tags: [quest.status || 'active'],
    objectives: quest.objectives?.map((obj: any, j: number) => ({
      id: `objective.${j}`,
      description: obj.description || obj,
      completed: obj.completed || false
    })),
    rewards: {
      xp: quest.xpReward,
      gold: quest.goldReward,
      items: quest.itemRewards
    }
  }));
  
  const camlEncounters: CAMLEncounter[] = [];
  if (storyState.combatants && storyState.combatants.length > 0) {
    camlEncounters.push({
      id: 'encounter.current_combat',
      type: 'Encounter',
      name: 'Current Combat',
      encounterType: 'combat',
      enemies: storyState.combatants.map((c: any, i: number) => ({
        id: `enemy.${i}`,
        count: 1
      }))
    });
  }
  
  return {
    id: `adventure.${campaign.id}`,
    type: 'AdventureModule',
    title: campaign.title,
    name: campaign.title,
    description: campaign.description,
    synopsis: campaign.description,
    author: 'Everdice Export',
    version: '1.0.0',
    ruleset: 'dnd5e',
    minLevel: 1,
    maxLevel: 20,
    setting: storyState.setting || 'Fantasy Realm',
    startingLocation: camlLocations[0]?.id,
    locations: camlLocations,
    npcs: camlNpcs,
    items: [],
    encounters: camlEncounters,
    quests: camlQuests,
    factions: [],
    handouts: [],
    initialState: {
      adventureProgress: storyState.adventureProgress,
      exploredTiles: storyState.exploredTiles,
      playerPosition: storyState.playerPosition
    }
  };
}

export function exportToYAML(adventure: CAMLAdventureModule): string {
  return yaml.dump(adventure, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

export function exportToJSON(adventure: CAMLAdventureModule): string {
  return JSON.stringify(adventure, null, 2);
}

export function buildAdventureGraph(pack: CAMLAdventurePack): {
  nodes: Array<{ id: string; type: string; name: string; }>;
  edges: Array<{ source: string; target: string; label?: string; }>;
} {
  const nodes: Array<{ id: string; type: string; name: string; }> = [];
  const edges: Array<{ source: string; target: string; label?: string; }> = [];
  
  for (const [id, entity] of Object.entries(pack.entities)) {
    nodes.push({
      id,
      type: entity.type,
      name: entity.name || id
    });
    
    if (entity.links) {
      for (const link of entity.links) {
        edges.push({ source: id, target: link });
      }
    }
    
    if (entity.type === 'Location' && (entity as CAMLLocation).connections) {
      for (const conn of (entity as CAMLLocation).connections!) {
        edges.push({
          source: id,
          target: conn.target,
          label: conn.direction
        });
      }
    }
    
    if (entity.type === 'Location' && (entity as CAMLLocation).encounters) {
      for (const enc of (entity as CAMLLocation).encounters!) {
        edges.push({ source: id, target: enc, label: 'triggers' });
      }
    }
    
    if (entity.type === 'Location' && (entity as CAMLLocation).npcs) {
      for (const npc of (entity as CAMLLocation).npcs!) {
        edges.push({ source: id, target: npc, label: 'contains' });
      }
    }
    
    if (entity.type === 'Quest' && (entity as CAMLQuest).questGiver) {
      edges.push({
        source: (entity as CAMLQuest).questGiver!,
        target: id,
        label: 'gives'
      });
    }
    
    if (entity.gates) {
      const gateRefs = extractGateReferences(entity.gates);
      for (const ref of gateRefs) {
        edges.push({ source: ref, target: id, label: 'unlocks' });
      }
    }
  }
  
  return { nodes, edges };
}

function extractGateReferences(gates: any): string[] {
  const refs: string[] = [];
  
  if (gates.all) {
    for (const g of gates.all) {
      if (typeof g === 'string' && g.includes('.')) refs.push(g);
      else if (g.fact && g.fact.includes('.')) refs.push(g.fact);
    }
  }
  
  if (gates.any) {
    for (const g of gates.any) {
      if (typeof g === 'string' && g.includes('.')) refs.push(g);
      else if (g.fact && g.fact.includes('.')) refs.push(g.fact);
    }
  }
  
  if (gates.not) {
    if (typeof gates.not === 'string' && gates.not.includes('.')) refs.push(gates.not);
    else if (gates.not.fact && gates.not.fact.includes('.')) refs.push(gates.not.fact);
  }
  
  return refs;
}

export const CAML_AI_PROMPT = `You are generating a structured D&D 5e adventure in CAML (Canonical Adventure Markup Language) format.

Generate a complete adventure module with the following structure:

{
  "id": "adventure.unique_id",
  "type": "AdventureModule",
  "title": "Adventure Title",
  "synopsis": "Brief adventure summary",
  "minLevel": 1,
  "maxLevel": 5,
  "setting": "Setting description",
  "startingLocation": "location.start",
  "hooks": ["Adventure hook 1", "Adventure hook 2"],
  "locations": [
    {
      "id": "location.unique_id",
      "type": "Location",
      "name": "Location Name",
      "description": "Detailed description",
      "connections": [{"direction": "north", "target": "location.other"}],
      "encounters": ["encounter.id"],
      "npcs": ["npc.id"]
    }
  ],
  "npcs": [
    {
      "id": "npc.unique_id",
      "type": "NPC",
      "name": "NPC Name",
      "description": "NPC description",
      "race": "Human",
      "class": "Warrior",
      "alignment": "Neutral",
      "attitude": "friendly",
      "statblock": {"ac": 15, "hp": 45, "cr": "2"}
    }
  ],
  "encounters": [
    {
      "id": "encounter.unique_id",
      "type": "Encounter",
      "name": "Encounter Name",
      "description": "What happens",
      "encounterType": "combat|social|exploration|puzzle|trap|treasure",
      "difficulty": "easy|medium|hard|deadly",
      "enemies": [{"id": "npc.enemy_id", "count": 2}],
      "rewards": {"xp": 100, "gold": 50, "items": ["item.id"]}
    }
  ],
  "quests": [
    {
      "id": "quest.unique_id",
      "type": "Quest",
      "name": "Quest Name",
      "description": "Quest description",
      "objectives": [{"id": "obj1", "description": "Complete objective"}],
      "rewards": {"xp": 200, "gold": 100}
    }
  ],
  "items": [
    {
      "id": "item.unique_id",
      "type": "Item",
      "name": "Item Name",
      "description": "Item description",
      "itemType": "weapon|armor|wondrous|consumable",
      "rarity": "common|uncommon|rare",
      "properties": "Mechanical properties"
    }
  ]
}

Use stable IDs like "location.ruined_tower", "npc.bandit_captain", "encounter.night_ambush".
Include gates for conditional content and outcomes for state changes when appropriate.`;
