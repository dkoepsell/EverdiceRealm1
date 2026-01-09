import * as yaml from 'js-yaml';
import type {
  CAML2Document,
  CAMLMeta,
  CAMLWorld,
  CAMLState,
  CAMLRoles,
  CAMLProcesses,
  CAMLTransitions,
  CAMLSnapshots,
  CAMLCharacter,
  CAMLLocation,
  CAMLItem,
  CAMLFaction,
  CAMLConnection,
  CAMLStateFact,
  CAMLRoleAssignment,
  CAMLProcessInstance,
  CAMLTransition,
  CAMLTransitionOp,
  CAMLSnapshot,
  CAMLTimebox,
  CAMLId,
  CAMLRef,
  CAMLStatblock,
  CAMLAbilities,
  CAML1xAdventureModule,
  CAML1xAdventurePack,
  CAML1xLocation,
  CAML1xNPC,
  CAML1xItem,
  CAML1xEncounter,
  CAML1xQuest,
  CAML1xBaseEntity
} from '../shared/caml';
import {
  CAML_VERSION,
  createEmptyCAML2Document,
  generateCAMLId,
  validateCAMLId
} from '../shared/caml';

// ============================================================================
// Parse CAML 2.0 Documents
// ============================================================================

export function parseCAML2Yaml(content: string): CAML2Document | null {
  try {
    const parsed = yaml.load(content) as any;
    if (!parsed) return null;
    
    if (parsed.caml_version === "2.0") {
      return validateCAML2Document(parsed);
    }
    
    // Try to migrate from 1.x format
    const legacy = parseLegacyCAML(parsed);
    if (legacy) {
      return migrateCAML1xTo2(legacy);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse CAML 2.0 YAML:', error);
    return null;
  }
}

export function parseCAML2Json(content: string): CAML2Document | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed) return null;
    
    if (parsed.caml_version === "2.0") {
      return validateCAML2Document(parsed);
    }
    
    // Try to migrate from 1.x format
    const legacy = parseLegacyCAML(parsed);
    if (legacy) {
      return migrateCAML1xTo2(legacy);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse CAML 2.0 JSON:', error);
    return null;
  }
}

function validateCAML2Document(doc: any): CAML2Document | null {
  if (!doc.meta?.id || !doc.meta?.title) return null;
  if (!doc.world?.entities) return null;
  if (!doc.state?.facts) return null;
  if (!doc.roles?.assignments) return null;
  if (!doc.processes?.catalog) return null;
  if (!doc.transitions?.changes) return null;
  if (!doc.snapshots?.timeline || doc.snapshots.timeline.length === 0) return null;
  
  return doc as CAML2Document;
}

// ============================================================================
// Legacy CAML 1.x Parsing (for backwards compatibility)
// ============================================================================

function parseLegacyCAML(parsed: any): CAML1xAdventurePack | null {
  // Check for 1.x AdventureModule format
  if (parsed.type === 'AdventureModule' || parsed.id?.startsWith('adventure.')) {
    const adventure = { ...parsed, type: 'AdventureModule' } as CAML1xAdventureModule;
    return {
      adventure,
      entities: buildLegacyEntityIndex(adventure)
    };
  }
  
  // Check wrapped format
  if (parsed.adventure) {
    return {
      adventure: parsed.adventure as CAML1xAdventureModule,
      entities: parsed.entities || buildLegacyEntityIndex(parsed.adventure)
    };
  }
  
  // Fallback
  if (parsed.title && (parsed.locations || parsed.npcs || parsed.encounters)) {
    const adventure = { 
      ...parsed, 
      type: 'AdventureModule', 
      id: parsed.id || `adventure.${Date.now()}` 
    } as CAML1xAdventureModule;
    return {
      adventure,
      entities: buildLegacyEntityIndex(adventure)
    };
  }
  
  return null;
}

function buildLegacyEntityIndex(adventure: CAML1xAdventureModule): Record<string, CAML1xBaseEntity> {
  const index: Record<string, CAML1xBaseEntity> = {};
  
  index[adventure.id] = adventure;
  
  for (const loc of adventure.locations || []) index[loc.id] = loc;
  for (const npc of adventure.npcs || []) index[npc.id] = npc;
  for (const item of adventure.items || []) index[item.id] = item;
  for (const enc of adventure.encounters || []) index[enc.id] = enc;
  for (const quest of adventure.quests || []) index[quest.id] = quest;
  for (const faction of adventure.factions || []) index[faction.id] = faction;
  
  return index;
}

// ============================================================================
// Migration from CAML 1.x to CAML 2.0
// ============================================================================

export function migrateCAML1xTo2(pack: CAML1xAdventurePack): CAML2Document {
  const adventure = pack.adventure;
  const now = new Date().toISOString();
  
  // Create meta
  const meta: CAMLMeta = {
    id: sanitizeId(adventure.id) || `ADV_${Date.now()}`,
    title: adventure.title || adventure.name || 'Imported Adventure',
    created_utc: now,
    authors: [adventure.author || 'Everdice Import'],
    tags: adventure.tags || [],
    system: {
      name: 'dnd5e',
      version: adventure.version || '1.0',
      license: 'CC BY 4.0'
    }
  };
  
  // Convert world entities
  const characters: CAMLCharacter[] = (adventure.npcs || []).map((npc, i) => ({
    id: sanitizeId(npc.id) || `NPC_${i}`,
    kind: 'character' as const,
    name: npc.name || `NPC ${i + 1}`,
    description: npc.description,
    tags: npc.tags,
    pc: false,
    species: npc.race,
    class: npc.class,
    level: npc.level,
    alignment: npc.alignment,
    statblock: npc.statblock,
    abilities: npc.abilities
  }));
  
  const locations: CAMLLocation[] = (adventure.locations || []).map((loc, i) => ({
    id: sanitizeId(loc.id) || `LOC_${i}`,
    kind: 'location' as const,
    name: loc.name || `Location ${i + 1}`,
    description: loc.description,
    tags: loc.tags,
    features: loc.features
  }));
  
  const items: CAMLItem[] = (adventure.items || []).map((item, i) => ({
    id: sanitizeId(item.id) || `ITEM_${i}`,
    kind: 'item' as const,
    name: item.name || `Item ${i + 1}`,
    description: item.description,
    tags: item.tags,
    rarity: item.rarity as any,
    itemType: item.itemType as any,
    properties: item.properties
  }));
  
  const factions: CAMLFaction[] = (adventure.factions || []).map((fac, i) => ({
    id: sanitizeId(fac.id) || `FAC_${i}`,
    kind: 'faction' as const,
    name: fac.name || `Faction ${i + 1}`,
    description: fac.description,
    tags: fac.tags
  }));
  
  // Build connections from location data
  const connections: CAMLConnection[] = [];
  for (const loc of adventure.locations || []) {
    if (loc.connections) {
      for (const conn of loc.connections) {
        connections.push({
          id: `CONN_${connections.length}`,
          from: sanitizeId(loc.id),
          to: sanitizeId(conn.target),
          mode: 'road',
          bidirectional: true
        });
      }
    }
  }
  
  const world: CAMLWorld = {
    entities: { characters, locations, items, factions },
    connections
  };
  
  // Convert state from initialState
  const facts: CAMLStateFact[] = [];
  if (adventure.initialState) {
    for (const [key, value] of Object.entries(adventure.initialState)) {
      facts.push({
        id: `STATE_${key}`,
        bearer: meta.id,
        type: 'initialState',
        value
      });
    }
  }
  
  // Add NPC attitudes as state facts
  for (const npc of adventure.npcs || []) {
    if (npc.attitude) {
      facts.push({
        id: `STATE_${sanitizeId(npc.id)}_attitude`,
        bearer: sanitizeId(npc.id),
        type: 'attitude',
        value: npc.attitude
      });
    }
  }
  
  const state: CAMLState = { facts };
  
  // Convert quest givers to role assignments
  const assignments: CAMLRoleAssignment[] = [];
  for (const quest of adventure.quests || []) {
    if (quest.questGiver) {
      assignments.push({
        id: `ROLE_questgiver_${sanitizeId(quest.id)}`,
        role: 'QuestGiver',
        holder: sanitizeId(quest.questGiver),
        notes: `Gives quest: ${quest.name}`
      });
    }
  }
  
  const roles: CAMLRoles = { assignments };
  
  // Create placeholder processes from encounters
  const catalog: CAMLProcessInstance[] = [];
  for (const enc of adventure.encounters || []) {
    catalog.push({
      id: `PROC_${sanitizeId(enc.id)}`,
      type: enc.encounterType || 'encounter',
      timebox: {
        id: `TB_${sanitizeId(enc.id)}`,
        start_utc: now,
        end_utc: now,
        label: enc.name || 'Encounter'
      },
      participants: [],
      location: enc.occursAt ? sanitizeId(enc.occursAt) : undefined,
      notes: enc.description
    });
  }
  
  const processes: CAMLProcesses = { catalog };
  
  // Empty transitions (no changes yet)
  const transitions: CAMLTransitions = { changes: [] };
  
  // Initial snapshot
  const snapshots: CAMLSnapshots = {
    timeline: [{
      id: 'SNAP_0',
      time_utc: now,
      world_hash: 'migrated',
      state_hash: 'migrated',
      roles_hash: 'migrated',
      narration: adventure.synopsis || 'Adventure begins.'
    }]
  };
  
  return {
    caml_version: '2.0',
    meta,
    world,
    state,
    roles,
    processes,
    transitions,
    snapshots
  };
}

function sanitizeId(id: string | undefined): CAMLId {
  if (!id) return `ID_${Date.now()}`;
  // Convert 1.x dot notation to 2.0 underscore notation
  return id.replace(/\./g, '_').replace(/[^A-Za-z0-9_\-:]/g, '_');
}

// ============================================================================
// Convert Campaign Data to CAML 2.0
// ============================================================================

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

export function convertCAML2ToCampaign(doc: CAML2Document): ConvertedCampaignData {
  const { meta, world, state } = doc;
  
  const npcs = world.entities.characters
    .filter(c => !c.pc)
    .map(c => {
      const attitudeFact = state.facts.find(
        f => f.bearer === c.id && f.type === 'attitude'
      );
      return {
        name: c.name,
        description: c.description || '',
        race: c.species,
        class: c.class,
        level: c.level,
        alignment: c.alignment,
        attitude: attitudeFact?.value as string,
        statblock: c.statblock
      };
    });
  
  const locations = world.entities.locations.map(l => ({
    name: l.name,
    description: l.description || '',
    features: l.features,
    connections: world.connections
      ?.filter(c => c.from === l.id)
      .map(c => ({
        direction: c.mode,
        target: c.to
      }))
  }));
  
  const items = world.entities.items.map(i => ({
    name: i.name,
    description: i.description || '',
    type: i.itemType,
    rarity: i.rarity,
    properties: i.properties
  }));
  
  // Extract encounters from processes
  const encounters = doc.processes.catalog
    .filter(p => p.type.includes('encounter') || p.type.includes('combat'))
    .map(p => ({
      name: p.timebox.label || p.id,
      description: p.notes || '',
      type: p.type,
      difficulty: undefined,
      enemies: undefined,
      rewards: undefined
    }));
  
  // No direct quest mapping in 2.0 - would need to parse roles/processes
  const quests: ConvertedCampaignData['quests'] = [];
  
  return {
    title: meta.title,
    description: doc.snapshots.timeline[0]?.narration || '',
    setting: meta.system?.name || 'Fantasy',
    minLevel: 1,
    maxLevel: 20,
    npcs,
    locations,
    encounters,
    quests,
    items,
    initialStoryState: {
      camlVersion: '2.0',
      metaId: meta.id,
      snapshotCount: doc.snapshots.timeline.length,
      processCount: doc.processes.catalog.length
    }
  };
}

export function convertCampaignToCAML2(
  campaign: any,
  sessions: any[],
  participants: any[],
  npcs: any[],
  quests: any[],
  dungeonMap?: any,
  items?: any[]
): CAML2Document {
  const now = new Date().toISOString();
  
  // Create document with proper CAML 2.0 meta
  const doc = createEmptyCAML2Document(
    `ADV_everdice_${campaign.id}`,
    campaign.title,
    'Everdice'
  );
  
  // Set meta created_utc
  doc.meta.created_utc = campaign.createdAt || now;
  doc.meta.tags = ['fantasy', 'rpg', campaign.difficulty || 'normal'];
  doc.meta.system = {
    name: 'D&D 5e SRD',
    version: '5.1'
  };
  
  const latestSession = sessions[sessions.length - 1];
  const storyState = latestSession?.storyState || {};
  
  // ============================================================================
  // WORLD LAYER: Independent continuants only (timeless entities)
  // In CAML 2.0, world entities are stripped of mutable/dynamic attributes
  // ============================================================================
  
  const characters: CAMLCharacter[] = [];
  
  // Add player characters (timeless representation)
  // Note: statblock and abilities ARE intrinsic (base stats), but current HP/conditions are state
  for (const participant of participants) {
    if (participant.character) {
      const char = participant.character;
      characters.push({
        id: generateCAMLId('PC', char.name || `Player${participant.id}`),
        kind: 'character',
        name: char.name || 'Unknown Hero',
        description: char.background || char.description,
        pc: true,
        species: char.race,
        class: char.class,
        level: char.level || 1,
        alignment: char.alignment,
        abilities: char.abilities,
        statblock: char.statblock
      });
    }
  }
  
  // Add NPCs (timeless - attitude is NOT here, it's in state layer)
  // Note: statblock and abilities ARE intrinsic properties
  for (const npc of npcs) {
    characters.push({
      id: generateCAMLId('NPC', npc.name),
      kind: 'character',
      name: npc.name,
      description: npc.description,
      pc: false,
      species: npc.race,
      class: npc.class,
      level: npc.level,
      alignment: npc.alignment,
      abilities: npc.abilities,
      statblock: npc.statblock
      // Note: attitude is a state fact, not an intrinsic property
    });
  }
  
  doc.world.entities.characters = characters;
  
  // Build locations
  const locations: CAMLLocation[] = [];
  const locationIdMap = new Map<string, CAMLId>();
  
  // Current location
  const currentLocation = storyState.currentLocation || campaign.setting || 'Starting Area';
  const startLocId = generateCAMLId('LOC', currentLocation);
  locations.push({
    id: startLocId,
    kind: 'location',
    name: currentLocation,
    description: storyState.currentNarrative?.slice(0, 200) || `Starting point of ${campaign.title}`,
    tags: ['starting', 'explored']
  });
  locationIdMap.set(currentLocation, startLocId);
  
  // Extract from journey log
  if (storyState.journeyLog) {
    const uniqueLocations = new Set([currentLocation]);
    for (const entry of storyState.journeyLog) {
      const locName = entry.location || entry.description?.slice(0, 40);
      if (locName && !uniqueLocations.has(locName)) {
        uniqueLocations.add(locName);
        const locId = generateCAMLId('LOC', locName);
        locations.push({
          id: locId,
          kind: 'location',
          name: locName,
          description: entry.description || `A location in ${campaign.title}`,
          tags: [entry.type || 'explored']
        });
        locationIdMap.set(locName, locId);
      }
    }
  }
  
  // Extract from dungeon map
  if (dungeonMap?.mapData?.rooms) {
    for (const room of dungeonMap.mapData.rooms) {
      const roomName = room.name || `Room ${room.id}`;
      if (!locationIdMap.has(roomName)) {
        const roomId = generateCAMLId('LOC', `dungeon_${room.id || locations.length}`);
        locations.push({
          id: roomId,
          kind: 'location',
          name: roomName,
          description: room.description || 'A dungeon room',
          tags: ['dungeon', room.type || 'room']
        });
        locationIdMap.set(roomName, roomId);
      }
    }
  }
  
  doc.world.entities.locations = locations;
  
  // Build connections
  const connections: CAMLConnection[] = [];
  for (let i = 0; i < locations.length - 1; i++) {
    connections.push({
      id: `CONN_${i}`,
      from: locations[i].id,
      to: locations[i + 1].id,
      mode: 'road',
      bidirectional: true
    });
  }
  doc.world.connections = connections;
  
  // Build items
  const itemList: CAMLItem[] = (items || []).map((item, i) => ({
    id: generateCAMLId('ITEM', item.name || `item_${i}`),
    kind: 'item' as const,
    name: item.name || `Item ${i + 1}`,
    description: item.description || 'A mysterious item',
    itemType: item.type as any,
    rarity: item.rarity as any,
    properties: item.properties
  }));
  
  // Add items from inventories
  for (const participant of participants) {
    if (participant.character?.inventory) {
      for (const invItem of participant.character.inventory) {
        if (!itemList.find(i => i.name === invItem.name)) {
          itemList.push({
            id: generateCAMLId('ITEM', invItem.name),
            kind: 'item',
            name: invItem.name,
            description: invItem.description || `Carried by ${participant.character.name}`,
            itemType: invItem.type as any,
            rarity: invItem.rarity as any
          });
        }
      }
    }
  }
  doc.world.entities.items = itemList;
  
  // ============================================================================
  // STATE LAYER: Dependent continuants (facts that depend on bearers)
  // In CAML 2.0, all mutable attributes become state facts
  // ============================================================================
  
  const facts: CAMLStateFact[] = [];
  
  // Character HP/XP states (mutable character stats)
  for (const participant of participants) {
    if (participant.character) {
      const charId = generateCAMLId('PC', participant.character.name);
      facts.push({
        id: `STATE_${charId}_hp`,
        bearer: charId,
        type: 'hp',
        value: participant.character.currentHp || participant.character.maxHp || 10,
        units: 'hp'
      });
      facts.push({
        id: `STATE_${charId}_max_hp`,
        bearer: charId,
        type: 'max_hp',
        value: participant.character.maxHp || 10,
        units: 'hp'
      });
      facts.push({
        id: `STATE_${charId}_xp`,
        bearer: charId,
        type: 'xp',
        value: participant.character.xp || 0,
        units: 'xp'
      });
      // Character abilities as state (mutable through magic items, etc.)
      if (participant.character.abilities) {
        facts.push({
          id: `STATE_${charId}_abilities`,
          bearer: charId,
          type: 'abilities',
          value: participant.character.abilities
        });
      }
    }
  }
  
  // NPC attitude states - THIS IS THE KEY CAML 2.0 CHANGE
  // Attitude is NOT an intrinsic property but a state fact that can change
  for (const npc of npcs) {
    const npcId = generateCAMLId('NPC', npc.name);
    facts.push({
      id: `STATE_${npcId}_attitude`,
      bearer: npcId,
      type: 'attitude',
      value: npc.attitude || 'neutral'
    });
    // NPC active/alive status
    facts.push({
      id: `STATE_${npcId}_active`,
      bearer: npcId,
      type: 'active',
      value: true
    });
  }
  
  // Quest states - quests in CAML 2.0 are state facts, not objects
  for (const quest of quests) {
    const questId = generateCAMLId('QUEST', quest.title || `quest_${quest.id}`);
    facts.push({
      id: `STATE_${questId}_status`,
      bearer: doc.meta.id,
      type: 'quest_status',
      value: quest.status || 'active'
    });
    // Quest objectives as individual state facts
    if (quest.objectives && Array.isArray(quest.objectives)) {
      quest.objectives.forEach((obj: any, i: number) => {
        facts.push({
          id: `STATE_${questId}_obj_${i}`,
          bearer: doc.meta.id,
          type: 'objective_complete',
          value: obj.completed || false
        });
      });
    }
  }
  
  // Location states (doors sealed, traps active, etc.)
  if (dungeonMap?.mapData?.rooms) {
    for (const room of dungeonMap.mapData.rooms) {
      const roomId = locationIdMap.get(room.name || `Room ${room.id}`) || 
                     generateCAMLId('LOC', `dungeon_${room.id}`);
      if (room.locked || room.sealed) {
        facts.push({
          id: `STATE_${roomId}_sealed`,
          bearer: roomId,
          type: 'sealed',
          value: true
        });
      }
      if (room.explored !== undefined) {
        facts.push({
          id: `STATE_${roomId}_explored`,
          bearer: roomId,
          type: 'explored',
          value: room.explored || false
        });
      }
    }
  }
  
  // Adventure progress states
  if (storyState.adventureProgress) {
    facts.push({
      id: 'STATE_adventure_progress',
      bearer: doc.meta.id,
      type: 'progress',
      value: storyState.adventureProgress
    });
  }
  
  doc.state.facts = facts;
  
  // ============================================================================
  // ROLES LAYER: Revocable role assignments
  // In CAML 2.0, roles can be granted and revoked via transitions
  // ============================================================================
  
  const assignments: CAMLRoleAssignment[] = [];
  
  // Quest givers
  for (const quest of quests) {
    if (quest.givenBy || quest.questGiver) {
      const npc = npcs.find(n => n.name === quest.givenBy || n.id === quest.questGiver);
      if (npc) {
        const npcId = generateCAMLId('NPC', npc.name);
        assignments.push({
          id: generateCAMLId('ROLE', `questgiver_${quest.title}`),
          role: 'QuestGiver',
          holder: npcId,
          notes: `Gives quest: ${quest.title}`,
          revocation: {
            any: [
              { lhs: `state[STATE_${npcId}_active].value`, op: '==', rhs: false }
            ]
          }
        });
      }
    }
  }
  
  // Guardian roles (NPCs that guard locations)
  for (const npc of npcs) {
    if (npc.role === 'guardian' || npc.type === 'guardian' || 
        (npc.description && npc.description.toLowerCase().includes('guard'))) {
      const npcId = generateCAMLId('NPC', npc.name);
      assignments.push({
        id: generateCAMLId('ROLE', `guardian_${npc.name}`),
        role: 'Guardian',
        holder: npcId,
        revocation: {
          any: [
            { lhs: `state[STATE_${npcId}_active].value`, op: '==', rhs: false }
          ]
        }
      });
    }
  }
  
  doc.roles.assignments = assignments;
  
  // ============================================================================
  // PROCESSES LAYER: Occurrents (things that happen in time)
  // In CAML 2.0, encounters/combats/puzzles are processes, not static objects
  // ============================================================================
  
  const catalog: CAMLProcessInstance[] = [];
  let processIndex = 0;
  
  // Session processes (gameplay sessions as processes)
  for (const session of sessions) {
    const timebox: CAMLTimebox = {
      id: `TB_session_${session.id}`,
      start_utc: session.createdAt || now,
      end_utc: session.endedAt || now,
      label: session.title || `Chapter ${session.sessionNumber}`
    };
    
    const participants_refs = participants.map(p => 
      generateCAMLId('PC', p.character?.name || `Player${p.id}`)
    );
    
    catalog.push({
      id: `PROC_session_${session.id}`,
      type: 'gameplay_session',
      timebox,
      participants: participants_refs,
      location: startLocId,
      outcomes: session.storyState?.currentNarrative 
        ? [session.storyState.currentNarrative.slice(0, 200)]
        : undefined,
      notes: `Chapter ${session.sessionNumber}: ${session.title || 'Untitled'}`
    });
    processIndex++;
  }
  
  // Convert encounters to processes (KEY CAML 2.0 CHANGE)
  // In CAML 1.x, encounters were listed as static objects under locations
  // In CAML 2.0, encounters are processes with timeboxes
  if (storyState.encounters) {
    for (const enc of storyState.encounters) {
      const encId = generateCAMLId('PROC', `encounter_${processIndex}`);
      catalog.push({
        id: encId,
        type: enc.type || 'combat',
        timebox: {
          id: `TB_enc_${processIndex}`,
          start_utc: enc.startedAt || now,
          end_utc: enc.endedAt || now,
          label: enc.name || `Encounter ${processIndex}`
        },
        participants: [
          ...participants.map(p => generateCAMLId('PC', p.character?.name || `Player${p.id}`)),
          ...(enc.enemies || []).map((e: any, i: number) => generateCAMLId('NPC', e.name || `Enemy${i}`))
        ],
        location: enc.location ? locationIdMap.get(enc.location) || startLocId : startLocId,
        notes: enc.description || 'An encounter'
      });
      processIndex++;
    }
  }
  
  // Current combat as a process
  if (storyState.combatants && storyState.combatants.length > 0) {
    catalog.push({
      id: 'PROC_current_combat',
      type: 'combat',
      timebox: {
        id: 'TB_combat',
        start_utc: now,
        end_utc: now,
        label: 'Current Combat'
      },
      participants: [
        ...participants.map(p => generateCAMLId('PC', p.character?.name || `Player${p.id}`)),
        ...storyState.combatants.map((c: any, i: number) => 
          generateCAMLId('NPC', c.name || `Enemy${i}`)
        )
      ],
      location: startLocId,
      notes: 'Ongoing combat encounter'
    });
    processIndex++;
  }
  
  // Quest objectives as processes (completing objectives is a process)
  for (const quest of quests) {
    if (quest.status === 'completed') {
      const questId = generateCAMLId('QUEST', quest.title || `quest_${quest.id}`);
      catalog.push({
        id: `PROC_quest_complete_${questId}`,
        type: 'quest_completion',
        timebox: {
          id: `TB_quest_${questId}`,
          start_utc: quest.completedAt || now,
          end_utc: quest.completedAt || now,
          label: `Quest Completed: ${quest.title}`
        },
        participants: participants.map(p => 
          generateCAMLId('PC', p.character?.name || `Player${p.id}`)
        ),
        outcomes: [
          `XP: ${quest.xpReward || 100}`,
          `Gold: ${quest.goldReward || 0}`
        ],
        notes: `Completed quest: ${quest.title}`
      });
      processIndex++;
    }
  }
  
  // Trap/puzzle processes from dungeon map
  if (dungeonMap?.mapData?.rooms) {
    for (const room of dungeonMap.mapData.rooms) {
      if (room.trap) {
        catalog.push({
          id: `PROC_trap_${room.id}`,
          type: 'trap',
          timebox: {
            id: `TB_trap_${room.id}`,
            start_utc: now,
            end_utc: now,
            label: `Trap: ${room.trap.name || 'Hidden Trap'}`
          },
          participants: [],
          location: locationIdMap.get(room.name || `Room ${room.id}`) || 
                    generateCAMLId('LOC', `dungeon_${room.id}`),
          notes: room.trap.description || 'A dangerous trap'
        });
        processIndex++;
      }
      if (room.puzzle) {
        catalog.push({
          id: `PROC_puzzle_${room.id}`,
          type: 'puzzle',
          timebox: {
            id: `TB_puzzle_${room.id}`,
            start_utc: now,
            end_utc: now,
            label: `Puzzle: ${room.puzzle.name || 'Ancient Puzzle'}`
          },
          participants: [],
          location: locationIdMap.get(room.name || `Room ${room.id}`) || 
                    generateCAMLId('LOC', `dungeon_${room.id}`),
          notes: room.puzzle.description || 'A challenging puzzle'
        });
        processIndex++;
      }
    }
  }
  
  doc.processes.catalog = catalog;
  
  // ============================================================================
  // TRANSITIONS LAYER: State changes caused by processes
  // In CAML 2.0, all state changes must occur through explicit transitions
  // ============================================================================
  
  const changes: CAMLTransition[] = [];
  let transitionIndex = 0;
  
  // Session transitions (state changes between sessions)
  for (let i = 1; i < sessions.length; i++) {
    const currSession = sessions[i];
    const ops: CAMLTransitionOp[] = [];
    
    // Adventure progress change
    if (currSession.storyState?.adventureProgress) {
      ops.push({
        op: 'update_state',
        state_id: 'STATE_adventure_progress',
        value: currSession.storyState.adventureProgress
      });
    }
    
    // XP changes for characters
    for (const participant of participants) {
      if (participant.character) {
        const charId = generateCAMLId('PC', participant.character.name);
        ops.push({
          op: 'update_state',
          state_id: `STATE_${charId}_xp`,
          value: participant.character.xp || 0
        });
      }
    }
    
    changes.push({
      id: `TR_session_${currSession.id}`,
      caused_by: `PROC_session_${currSession.id}`,
      ops,
      notes: `State changes from Chapter ${i}`
    });
    transitionIndex++;
  }
  
  // Quest completion transitions
  for (const quest of quests) {
    if (quest.status === 'completed') {
      const questId = generateCAMLId('QUEST', quest.title || `quest_${quest.id}`);
      changes.push({
        id: `TR_quest_complete_${questId}`,
        caused_by: `PROC_quest_complete_${questId}`,
        ops: [
          {
            op: 'update_state',
            state_id: `STATE_${questId}_status`,
            value: 'completed'
          }
        ],
        notes: `Quest completed: ${quest.title}`
      });
      transitionIndex++;
    }
  }
  
  // Combat/encounter outcome transitions
  if (storyState.defeatedEnemies) {
    for (const enemy of storyState.defeatedEnemies) {
      const npcId = generateCAMLId('NPC', enemy.name || 'Unknown');
      changes.push({
        id: `TR_defeat_${npcId}`,
        caused_by: 'PROC_current_combat',
        ops: [
          {
            op: 'update_state',
            state_id: `STATE_${npcId}_active`,
            value: false
          }
        ],
        notes: `${enemy.name} was defeated`
      });
      transitionIndex++;
    }
  }
  
  // Location state transitions (doors unsealed, areas explored)
  if (storyState.exploredLocations) {
    for (const locName of storyState.exploredLocations) {
      const locId = locationIdMap.get(locName);
      if (locId) {
        changes.push({
          id: `TR_explore_${locId}`,
          caused_by: catalog[0]?.id || `PROC_session_1`,
          ops: [
            {
              op: 'update_state',
              state_id: `STATE_${locId}_explored`,
              value: true
            }
          ],
          notes: `${locName} was explored`
        });
        transitionIndex++;
      }
    }
  }
  
  doc.transitions.changes = changes;
  
  // ============================================================================
  // SNAPSHOTS LAYER: Timestamped timeline for audit and replay
  // Each snapshot captures the state at a point in time
  // ============================================================================
  
  const timeline: CAMLSnapshot[] = [];
  
  // Initial snapshot
  timeline.push({
    id: 'SNAP_initial',
    time_utc: campaign.createdAt || now,
    world_hash: 'initial',
    state_hash: 'initial',
    roles_hash: 'initial',
    narration: campaign.description || `${campaign.title} begins.`
  });
  
  // Session snapshots with narration
  for (const session of sessions) {
    const transitionRef = session.sessionNumber > 1 ? `TR_session_${session.id}` : undefined;
    timeline.push({
      id: `SNAP_session_${session.id}`,
      time_utc: session.createdAt || now,
      world_hash: 'computed',
      state_hash: 'computed',
      roles_hash: 'computed',
      narration: session.storyState?.currentNarrative?.slice(0, 500) || 
                 session.title || 
                 `Chapter ${session.sessionNumber}`,
      derived_from_transition: transitionRef
    });
  }
  
  // Quest completion snapshots
  for (const quest of quests) {
    if (quest.status === 'completed') {
      const questId = generateCAMLId('QUEST', quest.title || `quest_${quest.id}`);
      timeline.push({
        id: `SNAP_quest_${questId}`,
        time_utc: quest.completedAt || now,
        world_hash: 'computed',
        state_hash: 'computed',
        roles_hash: 'computed',
        narration: `Quest "${quest.title}" has been completed.`,
        derived_from_transition: `TR_quest_complete_${questId}`
      });
    }
  }
  
  doc.snapshots.timeline = timeline;
  
  return doc;
}

// ============================================================================
// Export Functions
// ============================================================================

export function exportToYAML(doc: CAML2Document): string {
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

export function exportToJSON(doc: CAML2Document): string {
  return JSON.stringify(doc, null, 2);
}

// ============================================================================
// Graph Building
// ============================================================================

export function buildAdventureGraph(doc: CAML2Document): {
  nodes: Array<{ id: string; type: string; name: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
} {
  const nodes: Array<{ id: string; type: string; name: string }> = [];
  const edges: Array<{ source: string; target: string; label?: string }> = [];
  
  // Add world entities as nodes
  for (const char of doc.world.entities.characters) {
    nodes.push({ id: char.id, type: char.pc ? 'PC' : 'NPC', name: char.name });
  }
  for (const loc of doc.world.entities.locations) {
    nodes.push({ id: loc.id, type: 'Location', name: loc.name });
  }
  for (const item of doc.world.entities.items) {
    nodes.push({ id: item.id, type: 'Item', name: item.name });
  }
  for (const faction of doc.world.entities.factions) {
    nodes.push({ id: faction.id, type: 'Faction', name: faction.name });
  }
  
  // Add connections as edges
  for (const conn of doc.world.connections || []) {
    edges.push({
      source: conn.from,
      target: conn.to,
      label: conn.mode
    });
    if (conn.bidirectional) {
      edges.push({
        source: conn.to,
        target: conn.from,
        label: conn.mode
      });
    }
  }
  
  // Add state fact relationships
  for (const fact of doc.state.facts) {
    if (typeof fact.value === 'string' && nodes.find(n => n.id === fact.value)) {
      edges.push({
        source: fact.bearer,
        target: fact.value as string,
        label: fact.type
      });
    }
  }
  
  // Add role relationships
  for (const role of doc.roles.assignments) {
    nodes.push({ id: role.id, type: 'Role', name: role.role });
    edges.push({
      source: role.holder,
      target: role.id,
      label: 'holds'
    });
  }
  
  // Add process relationships
  for (const proc of doc.processes.catalog) {
    nodes.push({ id: proc.id, type: 'Process', name: proc.timebox.label || proc.type });
    for (const participant of proc.participants) {
      edges.push({
        source: participant,
        target: proc.id,
        label: 'participates'
      });
    }
    if (proc.location) {
      edges.push({
        source: proc.id,
        target: proc.location,
        label: 'occurs_at'
      });
    }
  }
  
  return { nodes, edges };
}

// ============================================================================
// AI Generation Prompt
// ============================================================================

export const CAML_AI_PROMPT = `You are generating a CAML 2.0 (Canonical Adventure Markup Language) D&D 5e adventure document.

CAML 2.0 uses ONTOLOGICAL LAYERS (BFO-aligned) to separate:
- WORLD: Independent continuants (characters, locations, items, factions, connections) - ONLY intrinsic properties
- STATE: Dependent continuants (mutable facts with bearer, type, value) - attitude, active, discovered, HP
- ROLES: Revocable role assignments (QuestGiver, Guardian) with revocation conditions
- PROCESSES: Occurrents (combat, social, puzzle, exploration) with timeboxes and participants
- TRANSITIONS: State changes CAUSED BY processes - all mutations happen here
- SNAPSHOTS: Timestamped timeline with narration and derived_from_transition

CRITICAL CAML 2.0 RULES:
1. NPC attitude is a STATE FACT (mutable), NOT a character property
2. Encounters are PROCESSES with participants and timeboxes, NOT static objects
3. Quests are QuestGiver ROLES + quest_status STATE FACTS, NOT quest objects
4. All state changes happen through TRANSITIONS caused by PROCESSES
5. Characters have intrinsic properties (species, class, statblock) but NOT mutable ones (attitude, HP)
6. Hidden locations have discovered state facts
7. Guardians have active state facts that get set to false when defeated
8. Defeating a guardian should unlock access (via transition updating discovered/accessible state)

ID patterns:
- Characters: PC_Name or NPC_Name
- Locations: LOC_Name  
- Items: ITEM_Name
- State facts: STATE_bearer_type
- Roles: ROLE_type_holder
- Processes: PROC_type_location
- Transitions: TR_description
- Snapshots: SNAP_description

Ensure all IDs match: ^[A-Za-z][A-Za-z0-9_\\-:.]{0,127}$
The document must be valid JSON with caml_version: "2.0".
Use only SRD 5.1 content (no proprietary D&D content).

Reference examples:
- caml-2.0/examples/the-lost-temple-history.caml2.json (minimal, clean)
- caml-2.0/examples/the-lost-temple-whispers.caml2.json (dungeon gating)
- caml-2.0/examples/whispers-in-the-shadows.caml2.json (multi-quest)`;

// ============================================================================
// Legacy Compatibility Exports
// ============================================================================

// These functions provide backward compatibility with existing code
// that expects CAML 1.x format

export function parseCAMLYaml(content: string): CAML1xAdventurePack | null {
  try {
    const parsed = yaml.load(content) as any;
    if (!parsed) return null;
    
    // Try 2.0 first, convert back to 1.x format for compatibility
    if (parsed.caml_version === '2.0') {
      const doc = validateCAML2Document(parsed);
      if (doc) {
        return convertCAML2ToLegacyPack(doc);
      }
    }
    
    return parseLegacyCAML(parsed);
  } catch (error) {
    console.error('Failed to parse CAML YAML:', error);
    return null;
  }
}

export function parseCAMLJson(content: string): CAML1xAdventurePack | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed) return null;
    
    // Try 2.0 first, convert back to 1.x format for compatibility
    if (parsed.caml_version === '2.0') {
      const doc = validateCAML2Document(parsed);
      if (doc) {
        return convertCAML2ToLegacyPack(doc);
      }
    }
    
    return parseLegacyCAML(parsed);
  } catch (error) {
    console.error('Failed to parse CAML JSON:', error);
    return null;
  }
}

function convertCAML2ToLegacyPack(doc: CAML2Document): CAML1xAdventurePack {
  // Build attitude lookup from state facts (CAML 2.0 stores attitude as state)
  const attitudeLookup = new Map<string, string>();
  for (const fact of doc.state.facts) {
    if (fact.type === 'attitude') {
      attitudeLookup.set(fact.bearer, String(fact.value));
    }
  }
  
  // Extract quests from state facts and roles (CAML 2.0 expresses quests via state/roles)
  const questFacts = doc.state.facts.filter(f => f.type === 'quest_status');
  const questGivers = doc.roles.assignments.filter(r => r.role === 'QuestGiver');
  
  const adventure: CAML1xAdventureModule = {
    id: doc.meta.id,
    type: 'AdventureModule',
    title: doc.meta.title,
    name: doc.meta.title,
    author: doc.meta.authors[0],
    version: doc.meta.system?.version,
    description: doc.snapshots.timeline[0]?.narration,
    synopsis: doc.snapshots.timeline[0]?.narration,
    tags: doc.meta.tags,
    ruleset: doc.meta.system?.name,
    locations: doc.world.entities.locations.map(l => ({
      id: l.id,
      type: 'Location' as const,
      name: l.name,
      description: l.description,
      tags: l.tags,
      features: l.features,
      connections: doc.world.connections
        ?.filter(c => c.from === l.id)
        .map(c => ({
          direction: c.mode,
          target: c.to
        }))
    })),
    // NPCs with attitude extracted from state facts
    npcs: doc.world.entities.characters.filter(c => !c.pc).map(c => ({
      id: c.id,
      type: 'NPC' as const,
      name: c.name,
      description: c.description,
      tags: c.tags,
      race: c.species,
      class: c.class,
      level: c.level,
      alignment: c.alignment,
      abilities: c.abilities,
      statblock: c.statblock,
      attitude: (attitudeLookup.get(c.id) || 'neutral') as 'friendly' | 'neutral' | 'hostile'
    })),
    items: doc.world.entities.items.map(i => ({
      id: i.id,
      type: 'Item' as const,
      name: i.name,
      description: i.description,
      tags: i.tags,
      itemType: i.itemType,
      rarity: i.rarity,
      properties: i.properties
    })),
    // Encounters from combat/encounter processes
    encounters: doc.processes.catalog
      .filter(p => p.type === 'combat' || p.type === 'encounter' || 
                   p.type === 'trap' || p.type === 'puzzle')
      .map(p => ({
        id: p.id,
        type: 'Encounter' as const,
        name: p.timebox.label || p.id,
        description: p.notes,
        encounterType: p.type as any,
        occursAt: p.location,
        enemies: p.participants
          .filter(part => part.startsWith('NPC_'))
          .map(npcId => ({ id: npcId, count: 1 })),
        difficulty: undefined,
        rewards: undefined
      })),
    // Quests reconstructed from state facts, roles, AND quest_completion processes
    quests: [
      // Active quests from state facts
      ...questFacts.map(qf => {
        const questIdParts = qf.id.split('_');
        const questId = questIdParts.slice(1, -1).join('_');
        const giver = questGivers.find(g => g.notes?.includes(questId));
        const objectiveFacts = doc.state.facts.filter(f => 
          f.id.startsWith(`STATE_${questId}_obj_`)
        );
        return {
          id: questId,
          type: 'Quest' as const,
          name: questId.replace(/_/g, ' '),
          description: giver?.notes || '',
          objectives: objectiveFacts.map((of, i) => ({
            id: of.id,
            description: `Objective ${i + 1}`,
            completed: of.value === true
          })),
          rewards: { xp: 100, gold: 0 },
          status: String(qf.value)
        };
      }),
      // Completed quests from quest_completion processes
      ...doc.processes.catalog
        .filter(p => p.type === 'quest_completion')
        .map(p => ({
          id: p.id,
          type: 'Quest' as const,
          name: p.timebox.label || p.id,
          description: p.notes,
          objectives: [],
          rewards: { xp: 100 },
          status: 'completed'
        }))
    ],
    factions: doc.world.entities.factions.map(f => ({
      id: f.id,
      type: 'Faction' as const,
      name: f.name,
      description: f.description,
      tags: f.tags
    })),
    initialState: Object.fromEntries(
      doc.state.facts
        .filter(f => f.bearer === doc.meta.id && !f.type.startsWith('quest'))
        .map(f => [f.type, f.value])
    )
  };
  
  const entities = buildLegacyEntityIndex(adventure);
  
  return { adventure, entities };
}

export function convertCAMLToCampaign(pack: CAML1xAdventurePack): ConvertedCampaignData {
  const adventure = pack.adventure;
  
  const npcs = (adventure.npcs || []).map(npc => ({
    name: npc.name || npc.id,
    description: npc.description || '',
    race: npc.race,
    class: npc.class,
    level: npc.level,
    alignment: npc.alignment,
    attitude: npc.attitude,
    statblock: npc.statblock
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
