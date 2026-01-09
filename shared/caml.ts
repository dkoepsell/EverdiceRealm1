// CAML 2.0 - Canonical Adventure Markup Language
// Based on https://github.com/dkoepsell/CAML5e/tree/main/caml-2.0

export const CAML_VERSION = "2.0";

// ============================================================================
// Shared Definitions
// ============================================================================

export type CAMLId = string; // Pattern: ^[A-Za-z][A-Za-z0-9_\-:.]{0,127}$
export type CAMLRef = string; // Same pattern as CAMLId

export type CAMLOperator = 
  | "==" | "!=" | "<" | "<=" | ">" | ">=" 
  | "in" | "contains" | "exists" | "not_exists";

export interface CAMLCondition {
  lhs: string;
  op: CAMLOperator;
  rhs?: unknown;
}

export interface CAMLConditionSet {
  all?: CAMLCondition[];
  any?: CAMLCondition[];
  none?: CAMLCondition[];
}

export interface CAMLTimebox {
  id: CAMLId;
  start_utc: string; // ISO date-time
  end_utc: string; // ISO date-time
  label?: string;
}

// ============================================================================
// Meta Layer
// ============================================================================

export interface CAMLMeta {
  id: CAMLId;
  title: string;
  created_utc: string;
  updated_utc?: string;
  authors: string[];
  tags?: string[];
  system?: {
    name?: string;
    version?: string;
    license?: string;
  };
}

// ============================================================================
// World Layer - Independent Continuants
// ============================================================================

export interface CAMLBaseEntity {
  id: CAMLId;
  kind: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface CAMLCharacter extends CAMLBaseEntity {
  kind: "character";
  pc: boolean;
  species?: string;
  class?: string;
  level?: number;
  alignment?: string;
  background?: string;
  abilities?: CAMLAbilities;
  proficiencyBonus?: number;
  statblock?: CAMLStatblock;
}

export interface CAMLLocation extends CAMLBaseEntity {
  kind: "location";
  region?: string;
  features?: string[];
  terrain?: string;
}

export interface CAMLItem extends CAMLBaseEntity {
  kind: "item";
  rarity?: "common" | "uncommon" | "rare" | "very rare" | "legendary" | "artifact";
  itemType?: "weapon" | "armor" | "wondrous" | "consumable" | "treasure" | "tool" | "misc";
  attunement?: boolean;
  properties?: string;
  value?: string;
  weight?: number;
}

export interface CAMLFaction extends CAMLBaseEntity {
  kind: "faction";
  alignment?: string;
  goals?: string[];
  leader?: CAMLRef;
}

export type CAMLWorldConnectionMode = 
  | "road" | "door" | "portal" | "sea" | "air" | "tunnel" | "other";

export interface CAMLConnection {
  id: CAMLId;
  from: CAMLRef;
  to: CAMLRef;
  mode: CAMLWorldConnectionMode;
  bidirectional?: boolean;
  conditions?: CAMLConditionSet;
}

export interface CAMLWorldEntities {
  characters: CAMLCharacter[];
  locations: CAMLLocation[];
  items: CAMLItem[];
  factions: CAMLFaction[];
}

export interface CAMLWorld {
  entities: CAMLWorldEntities;
  connections?: CAMLConnection[];
}

// ============================================================================
// State Layer - Dependent Continuants
// ============================================================================

export interface CAMLStateFactProvenance {
  asserted_by?: string;
  source_process?: CAMLRef;
}

export interface CAMLStateFactValidity {
  since_snapshot?: CAMLRef;
  until_snapshot?: CAMLRef;
}

export interface CAMLStateFact {
  id: CAMLId;
  bearer: CAMLRef;
  type: string;
  value: unknown;
  units?: string;
  validity?: CAMLStateFactValidity;
  provenance?: CAMLStateFactProvenance;
}

export interface CAMLState {
  facts: CAMLStateFact[];
}

// ============================================================================
// Roles Layer
// ============================================================================

export interface CAMLRoleAssignment {
  id: CAMLId;
  role: string;
  holder: CAMLRef;
  conditions?: CAMLConditionSet;
  revocation?: CAMLConditionSet;
  granted_by_process?: CAMLRef;
  notes?: string;
}

export interface CAMLRoles {
  assignments: CAMLRoleAssignment[];
}

// ============================================================================
// Processes Layer - Occurrents
// ============================================================================

export interface CAMLProcessInput {
  actor: CAMLRef;
  declared_action: string;
  target?: CAMLRef | string;
  method?: string;
  dice_expression?: string;
  roll_result?: number;
}

export interface CAMLProcessInstance {
  id: CAMLId;
  type: string;
  timebox: CAMLTimebox;
  participants: CAMLRef[];
  location?: CAMLRef;
  inputs?: CAMLProcessInput[];
  outcomes?: string[];
  notes?: string;
}

export interface CAMLProcesses {
  catalog: CAMLProcessInstance[];
}

// ============================================================================
// Transitions Layer - State Changes
// ============================================================================

export interface CAMLAddStateOp {
  op: "add_state";
  fact: CAMLStateFact;
}

export interface CAMLUpdateStateOp {
  op: "update_state";
  state_id: CAMLRef;
  value: unknown;
}

export interface CAMLRemoveStateOp {
  op: "remove_state";
  state_id: CAMLRef;
}

export interface CAMLGrantRoleOp {
  op: "grant_role";
  assignment: CAMLRoleAssignment;
}

export interface CAMLRevokeRoleOp {
  op: "revoke_role";
  role_assignment_id: CAMLRef;
}

export interface CAMLMoveEntityOp {
  op: "move_entity";
  entity: CAMLRef;
  to_location: CAMLRef;
}

export interface CAMLCreateEntityOp {
  op: "create_entity";
  entity: CAMLCharacter | CAMLLocation | CAMLItem | CAMLFaction;
}

export interface CAMLRetireEntityOp {
  op: "retire_entity";
  entity_id: CAMLRef;
  reason: string;
}

export type CAMLTransitionOp = 
  | CAMLAddStateOp
  | CAMLUpdateStateOp
  | CAMLRemoveStateOp
  | CAMLGrantRoleOp
  | CAMLRevokeRoleOp
  | CAMLMoveEntityOp
  | CAMLCreateEntityOp
  | CAMLRetireEntityOp;

export interface CAMLTransition {
  id: CAMLId;
  caused_by: CAMLRef;
  ops: CAMLTransitionOp[];
  notes?: string;
}

export interface CAMLTransitions {
  changes: CAMLTransition[];
}

// ============================================================================
// Snapshots Layer - Timeline
// ============================================================================

export interface CAMLSnapshot {
  id: CAMLId;
  time_utc: string;
  world_hash: string;
  state_hash: string;
  roles_hash: string;
  narration?: string;
  derived_from_transition?: CAMLRef;
}

export interface CAMLSnapshots {
  timeline: CAMLSnapshot[];
}

// ============================================================================
// Correspondence Layer (Optional)
// ============================================================================

export interface CAMLTurnSubmission {
  actor: CAMLRef;
  declared_action: string;
  target?: CAMLRef | string;
  method?: string;
}

export interface CAMLTurn {
  id: CAMLId;
  timebox: CAMLTimebox;
  submissions: CAMLTurnSubmission[];
}

export interface CAMLCorrespondence {
  cadence?: "ad_hoc" | "fixed" | "daily" | "weekly";
  default_timebox_hours?: number;
  turns: CAMLTurn[];
}

// ============================================================================
// Root Document
// ============================================================================

export interface CAML2Document {
  caml_version: "2.0";
  meta: CAMLMeta;
  world: CAMLWorld;
  state: CAMLState;
  roles: CAMLRoles;
  processes: CAMLProcesses;
  transitions: CAMLTransitions;
  snapshots: CAMLSnapshots;
  correspondence?: CAMLCorrespondence;
}

// ============================================================================
// D&D 5e Extensions (CAML-5e Layer)
// ============================================================================

export interface CAMLAbilities {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}

export interface CAMLAction {
  name: string;
  description?: string;
  attackBonus?: number;
  damage?: string;
  damageType?: string;
  reach?: string;
  range?: string;
  save?: {
    ability: string;
    dc: number;
  };
}

export interface CAMLSpellcasting {
  ability: string;
  spellSaveDC?: number;
  spellAttackBonus?: number;
  spells?: {
    level: number;
    slots?: number;
    known: string[];
  }[];
}

export interface CAMLDefenses {
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  conditionImmunities?: string[];
}

export interface CAMLStatblock {
  ac?: number;
  hp?: number;
  hitDice?: string;
  speed?: string;
  abilities?: CAMLAbilities;
  saves?: Partial<CAMLAbilities>;
  skills?: Record<string, number>;
  senses?: string;
  languages?: string;
  cr?: string;
  proficiencyBonus?: number;
  actions?: CAMLAction[];
  bonusActions?: CAMLAction[];
  reactions?: CAMLAction[];
  legendaryActions?: CAMLAction[];
  spellcasting?: CAMLSpellcasting;
  defenses?: CAMLDefenses;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function validateCAMLId(id: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_\-:.]{0,127}$/.test(id);
}

export function generateCAMLId(prefix: string, name: string): CAMLId {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
  return `${prefix}_${slug}`;
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function calculateCR(statblock: CAMLStatblock): string {
  if (statblock.cr) return statblock.cr;
  const hp = statblock.hp || 10;
  if (hp <= 6) return "0";
  if (hp <= 35) return "1/4";
  if (hp <= 49) return "1/2";
  if (hp <= 70) return "1";
  if (hp <= 85) return "2";
  if (hp <= 100) return "3";
  if (hp <= 115) return "4";
  if (hp <= 130) return "5";
  return Math.min(30, Math.floor(hp / 15)).toString();
}

export function createEmptyCAML2Document(
  id: string,
  title: string,
  author: string
): CAML2Document {
  const now = new Date().toISOString();
  return {
    caml_version: "2.0",
    meta: {
      id,
      title,
      created_utc: now,
      authors: [author],
      system: {
        name: "dnd5e",
        version: "SRD 5.1",
        license: "CC BY 4.0"
      }
    },
    world: {
      entities: {
        characters: [],
        locations: [],
        items: [],
        factions: []
      },
      connections: []
    },
    state: {
      facts: []
    },
    roles: {
      assignments: []
    },
    processes: {
      catalog: []
    },
    transitions: {
      changes: []
    },
    snapshots: {
      timeline: [{
        id: "SNAP_0",
        time_utc: now,
        world_hash: "placeholder",
        state_hash: "placeholder",
        roles_hash: "placeholder",
        narration: "Campaign begins."
      }]
    }
  };
}

export function findEntityById(
  doc: CAML2Document,
  id: CAMLRef
): CAMLCharacter | CAMLLocation | CAMLItem | CAMLFaction | undefined {
  const { characters, locations, items, factions } = doc.world.entities;
  return (
    characters.find(c => c.id === id) ||
    locations.find(l => l.id === id) ||
    items.find(i => i.id === id) ||
    factions.find(f => f.id === id)
  );
}

export function getStateFactsByBearer(
  doc: CAML2Document,
  bearerId: CAMLRef
): CAMLStateFact[] {
  return doc.state.facts.filter(f => f.bearer === bearerId);
}

export function getRolesByHolder(
  doc: CAML2Document,
  holderId: CAMLRef
): CAMLRoleAssignment[] {
  return doc.roles.assignments.filter(r => r.holder === holderId);
}

export function getLatestSnapshot(doc: CAML2Document): CAMLSnapshot | undefined {
  const timeline = doc.snapshots.timeline;
  return timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
}

// ============================================================================
// Legacy CAML 1.x Compatibility Types (for import/migration)
// ============================================================================

export interface CAML1xGateExpr {
  fact?: string;
  op?: "==" | "!=" | "<" | ">" | "<=" | ">=" | "in" | "contains";
  value?: unknown;
}

export interface CAML1xGate {
  all?: (string | CAML1xGateExpr)[];
  any?: (string | CAML1xGateExpr)[];
  not?: string | CAML1xGateExpr;
}

export interface CAML1xOutcomeStep {
  set?: string;
  inc?: string;
  dec?: string;
  by?: number;
  addTag?: string;
  removeTag?: string;
  transfer?: Record<string, unknown>;
}

export interface CAML1xBaseEntity {
  id: string;
  type: string;
  name?: string;
  description?: string;
  tags?: string[];
  links?: string[];
  ruleset?: string;
  gates?: CAML1xGate;
  outcomes?: Record<string, CAML1xOutcomeStep[]>;
}

export interface CAML1xLocation extends CAML1xBaseEntity {
  type: "Location";
  parentLocation?: string;
  connections?: {
    direction: string;
    target: string;
    description?: string;
  }[];
  features?: string[];
  encounters?: string[];
  items?: string[];
  npcs?: string[];
}

export interface CAML1xNPC extends CAML1xBaseEntity {
  type: "NPC";
  race?: string;
  class?: string;
  level?: number;
  alignment?: string;
  statblock?: CAMLStatblock;
  abilities?: CAMLAbilities;
  attitude?: "friendly" | "neutral" | "hostile";
  startsAt?: string;
  faction?: string;
}

export interface CAML1xItem extends CAML1xBaseEntity {
  type: "Item";
  itemType?: string;
  rarity?: string;
  attunement?: boolean;
  properties?: string;
  value?: string;
  weight?: number;
}

export interface CAML1xEncounter extends CAML1xBaseEntity {
  type: "Encounter";
  encounterType?: string;
  difficulty?: string;
  occursAt?: string;
  enemies?: { id: string; count: number }[];
  rewards?: { xp?: number; gold?: number; items?: string[] };
}

export interface CAML1xQuest extends CAML1xBaseEntity {
  type: "Quest";
  questGiver?: string;
  objectives?: { id: string; description: string; optional?: boolean }[];
  rewards?: { xp?: number; gold?: number; items?: string[] };
  stages?: { id: string; name: string; description: string }[];
}

export interface CAML1xAdventureModule extends CAML1xBaseEntity {
  type: "AdventureModule";
  title: string;
  author?: string;
  version?: string;
  minLevel?: number;
  maxLevel?: number;
  setting?: string;
  synopsis?: string;
  hooks?: string[];
  startingLocation?: string;
  locations?: CAML1xLocation[];
  npcs?: CAML1xNPC[];
  items?: CAML1xItem[];
  encounters?: CAML1xEncounter[];
  quests?: CAML1xQuest[];
  factions?: CAML1xBaseEntity[];
  handouts?: CAML1xBaseEntity[];
  initialState?: Record<string, unknown>;
}

export interface CAML1xAdventurePack {
  adventure: CAML1xAdventureModule;
  entities: Record<string, CAML1xBaseEntity>;
}
