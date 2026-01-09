// CAML 2.0 Trace Format
// Records gameplay events as processes and transitions for audit/replay
// Aligned with CAML 2.0 ontological layers

import type { 
  CAMLId, 
  CAMLRef, 
  CAMLTimebox, 
  CAMLTransitionOp,
  CAMLProcessInput 
} from './caml';

export const CAML_TRACE_VERSION = "2.0";

// ============================================================================
// Trace Event Kinds (aligned with CAML 2.0 layers)
// ============================================================================

export type TraceEventKind =
  // Session events
  | "session.started"
  | "session.ended"
  // Process events (occurrents)
  | "process.started"
  | "process.completed"
  | "process.aborted"
  // Transition events (state changes)
  | "transition.applied"
  // World events
  | "entity.created"
  | "entity.moved"
  | "entity.retired"
  // State events
  | "state.added"
  | "state.updated"
  | "state.removed"
  // Role events
  | "role.granted"
  | "role.revoked"
  // D&D 5e specific events
  | "dnd5e.roll"
  | "dnd5e.damage"
  | "dnd5e.heal"
  | "dnd5e.rest"
  | "dnd5e.levelUp"
  | "dnd5e.death"
  | "dnd5e.stabilized"
  | "dnd5e.initiative"
  // Everdice-specific events
  | "everdice.movement"
  | "everdice.mapGenerated"
  | "everdice.narrativeAdvanced"
  | "everdice.questAccepted"
  | "everdice.questCompleted"
  | "everdice.chapterAdvanced"
  | "everdice.turnEnforced"
  | "everdice.actionValidated"
  | "everdice.encounterTriggered"
  | "everdice.encounterResolved"
  | "everdice.initiativeRolled"
  // Legacy compatibility aliases
  | "state.set"
  | "item.gained"
  | "encounter.triggered";

// ============================================================================
// Event Payloads
// ============================================================================

export interface SessionPayload {
  sessionId: string;
  title?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface ProcessPayload {
  processId: CAMLId;
  processType: string;
  timebox?: CAMLTimebox;
  participants?: CAMLRef[];
  location?: CAMLRef;
  inputs?: CAMLProcessInput[];
  outcomes?: string[];
}

export interface TransitionPayload {
  transitionId: CAMLId;
  causedBy: CAMLRef;
  ops: CAMLTransitionOp[];
}

export interface EntityPayload {
  entityId: CAMLRef;
  entityKind: string;
  name?: string;
  reason?: string;
  toLocation?: CAMLRef;
}

export interface StatePayload {
  stateId: CAMLId;
  bearer: CAMLRef;
  type: string;
  value?: unknown;
  units?: string;
}

export interface RolePayload {
  roleId: CAMLId;
  role: string;
  holder: CAMLRef;
  grantedBy?: CAMLRef;
}

export interface DnD5eRollPayload {
  actorId: CAMLRef;
  rollType: string;
  dice: string;
  result: number;
  modifier?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  critical?: boolean;
  criticalFail?: boolean;
  target?: number;
  success?: boolean;
}

export interface DnD5eDamagePayload {
  targetId: CAMLRef;
  amount: number;
  damageType?: string;
  source?: CAMLRef;
}

export interface DnD5eHealPayload {
  targetId: CAMLRef;
  amount: number;
  source?: CAMLRef;
}

export interface DnD5eRestPayload {
  actorId: CAMLRef;
  restType: "short" | "long";
  hpRestored?: number;
  hitDiceUsed?: number;
  resourcesRecovered?: string[];
}

export interface DnD5eLevelUpPayload {
  actorId: CAMLRef;
  newLevel: number;
  class?: string;
  hpGained?: number;
  featuresGained?: string[];
}

export interface DnD5eDeathPayload {
  actorId: CAMLRef;
  cause?: string;
  savesSucceeded?: number;
  savesFailed?: number;
}

export interface DnD5eStabilizedPayload {
  actorId: CAMLRef;
  method?: string;
  stabilizedBy?: CAMLRef;
}

export interface DnD5eInitiativePayload {
  actorId: CAMLRef;
  roll: number;
  modifier?: number;
  total: number;
}

export interface EverdiceMovementPayload {
  actorId: CAMLRef;
  from: { x: number; y: number };
  to: { x: number; y: number };
  locationId?: CAMLRef;
  movementType?: "walk" | "teleport" | "forced";
}

export interface EverdiceMapGeneratedPayload {
  mapId: CAMLId;
  mapType: string;
  dimensions: { width: number; height: number };
  seed?: string;
  locationId?: CAMLRef;
  roomCount?: number;
}

export interface EverdiceNarrativeAdvancedPayload {
  content: string;
  choiceMade?: string;
  chapterId?: string;
  locationId?: CAMLRef;
}

export interface EverdiceQuestPayload {
  questId: CAMLId;
  questName: string;
  givenBy?: CAMLRef;
  outcome?: "success" | "failure" | "abandoned";
  rewards?: {
    xp?: number;
    gold?: number;
    items?: string[];
  };
}

export interface EverdiceChapterAdvancedPayload {
  fromChapter: number;
  toChapter: number;
  chapterTitle?: string;
  totalChapters?: number;
}

export interface EverdiceEncounterPayload {
  encounterId: CAMLId;
  encounterType?: string;
  occursAt?: CAMLRef;
  participants?: CAMLRef[];
  resolution?: "success" | "failure" | "partial" | "abandoned";
}

export type TraceEventPayload =
  | SessionPayload
  | ProcessPayload
  | TransitionPayload
  | EntityPayload
  | StatePayload
  | RolePayload
  | DnD5eRollPayload
  | DnD5eDamagePayload
  | DnD5eHealPayload
  | DnD5eRestPayload
  | DnD5eLevelUpPayload
  | DnD5eDeathPayload
  | DnD5eStabilizedPayload
  | DnD5eInitiativePayload
  | EverdiceMovementPayload
  | EverdiceMapGeneratedPayload
  | EverdiceNarrativeAdvancedPayload
  | EverdiceQuestPayload
  | EverdiceChapterAdvancedPayload
  | EverdiceEncounterPayload;

// ============================================================================
// Trace Event Structure
// ============================================================================

export interface TraceEvent {
  eid: CAMLId;
  kind: TraceEventKind;
  payload: TraceEventPayload;
  ts: string; // ISO timestamp
  sessionId?: string;
  who?: CAMLRef; // Actor reference
  where?: CAMLRef; // Location reference
  note?: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Trace Session and Actor
// ============================================================================

export interface TraceSession {
  id: CAMLId;
  title?: string;
  startedAt: string;
  endedAt?: string;
  chapterNumber?: number;
}

export interface TraceActor {
  id: CAMLId;
  type: "PC" | "NPC" | "Party" | "System" | "DM";
  name: string;
  characterId?: CAMLRef;
}

export interface TraceCampaign {
  id: CAMLId;
  name: string;
  gm?: string;
  ruleset: string;
  setting?: string;
}

// ============================================================================
// Root Trace Document (CAML 2.0 aligned)
// ============================================================================

export interface CAMLTrace {
  type: "CAMLTrace";
  id: CAMLId;
  moduleId: CAMLId;
  camlVersion: string;
  traceVersion: string;
  campaign: TraceCampaign;
  sessions: TraceSession[];
  actors: TraceActor[];
  events: TraceEvent[];
  created_utc: string;
  updated_utc?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createTraceEvent(
  kind: TraceEventKind,
  payload: TraceEventPayload,
  options?: {
    sessionId?: string;
    who?: CAMLRef;
    where?: CAMLRef;
    note?: string;
    meta?: Record<string, unknown>;
  }
): Omit<TraceEvent, "eid"> {
  return {
    kind,
    payload,
    ts: new Date().toISOString(),
    ...options
  };
}

export function generateEventId(eventIndex: number): CAMLId {
  return `EVT_${String(eventIndex).padStart(6, "0")}`;
}

export function generateTraceId(campaignId: number | string): CAMLId {
  return `TRACE_everdice_${campaignId}`;
}

export function generateModuleId(campaignId: number | string, campaignName: string): CAMLId {
  const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  return `ADV_everdice_${slug}_${campaignId}`;
}

export function createEmptyTrace(
  campaignId: number | string,
  campaignName: string,
  gmName?: string
): CAMLTrace {
  const now = new Date().toISOString();
  return {
    type: "CAMLTrace",
    id: generateTraceId(campaignId),
    moduleId: generateModuleId(campaignId, campaignName),
    camlVersion: "2.0",
    traceVersion: CAML_TRACE_VERSION,
    campaign: {
      id: `CAMP_${campaignId}`,
      name: campaignName,
      gm: gmName,
      ruleset: "dnd5e"
    },
    sessions: [],
    actors: [],
    events: [],
    created_utc: now
  };
}

export function addTraceEvent(
  trace: CAMLTrace,
  kind: TraceEventKind,
  payload: TraceEventPayload,
  options?: {
    sessionId?: string;
    who?: CAMLRef;
    where?: CAMLRef;
    note?: string;
    meta?: Record<string, unknown>;
  }
): TraceEvent {
  const eventId = generateEventId(trace.events.length);
  const event: TraceEvent = {
    eid: eventId,
    kind,
    payload,
    ts: new Date().toISOString(),
    ...options
  };
  trace.events.push(event);
  trace.updated_utc = event.ts;
  return event;
}

export function startTraceSession(
  trace: CAMLTrace,
  sessionId: string,
  title?: string,
  chapterNumber?: number
): TraceSession {
  const session: TraceSession = {
    id: sessionId,
    title,
    startedAt: new Date().toISOString(),
    chapterNumber
  };
  trace.sessions.push(session);
  
  addTraceEvent(trace, "session.started", {
    sessionId,
    title,
    startedAt: session.startedAt
  } as SessionPayload, { sessionId });
  
  return session;
}

export function endTraceSession(trace: CAMLTrace, sessionId: string): void {
  const session = trace.sessions.find(s => s.id === sessionId);
  if (session) {
    session.endedAt = new Date().toISOString();
    addTraceEvent(trace, "session.ended", {
      sessionId,
      endedAt: session.endedAt
    } as SessionPayload, { sessionId });
  }
}

export function registerTraceActor(
  trace: CAMLTrace,
  id: string,
  type: TraceActor["type"],
  name: string,
  characterId?: string
): TraceActor {
  let actor = trace.actors.find(a => a.id === id);
  if (!actor) {
    actor = { id, type, name, characterId };
    trace.actors.push(actor);
  }
  return actor;
}
