export const CAML_TRACE_VERSION = "0.1";

export type TraceEventKind =
  | "session.started"
  | "session.ended"
  | "encounter.available"
  | "encounter.triggered"
  | "encounter.resolved"
  | "state.set"
  | "state.unset"
  | "state.addTag"
  | "state.removeTag"
  | "item.gained"
  | "item.lost"
  | "item.transferred"
  | "actor.declared"
  | "dnd5e.roll"
  | "dnd5e.damage"
  | "dnd5e.heal"
  | "dnd5e.rest"
  | "dnd5e.levelUp"
  | "dnd5e.death"
  | "dnd5e.stabilized"
  | "everdice.movement"
  | "everdice.mapGenerated"
  | "everdice.narrativeAdvanced"
  | "everdice.questAccepted"
  | "everdice.questCompleted"
  | "everdice.chapterAdvanced";

export interface SessionStartedPayload {
  sessionId: string;
  title?: string;
}

export interface SessionEndedPayload {
  sessionId: string;
}

export interface EncounterAvailablePayload {
  encounterId: string;
  because?: string[];
}

export interface EncounterTriggeredPayload {
  encounterId: string;
  occursAt?: string;
  participants?: string[];
}

export interface EncounterResolvedPayload {
  encounterId: string;
  resolution: "success" | "failure" | "partial" | "abandoned";
  outcomeRefs?: string[];
}

export interface StateSetPayload {
  path: string;
  value: unknown;
}

export interface StateUnsetPayload {
  path: string;
}

export interface StateAddTagPayload {
  tag: string;
  scope?: string;
}

export interface StateRemoveTagPayload {
  tag: string;
  scope?: string;
}

export interface ItemGainedPayload {
  itemId: string;
  by?: string;
  quantity?: number;
}

export interface ItemLostPayload {
  itemId: string;
  by?: string;
  quantity?: number;
}

export interface ItemTransferredPayload {
  itemId: string;
  from: string;
  to: string;
  quantity?: number;
}

export interface ActorDeclaredPayload {
  actorId: string;
  intent: string;
  targetId?: string;
}

export interface DnD5eRollPayload {
  actorId: string;
  rollType: string;
  dice: string;
  result: number;
  modifier?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  critical?: boolean;
  criticalFail?: boolean;
}

export interface DnD5eDamagePayload {
  targetId: string;
  amount: number;
  damageType?: string;
  source?: string;
}

export interface DnD5eHealPayload {
  targetId: string;
  amount: number;
  source?: string;
}

export interface DnD5eRestPayload {
  actorId: string;
  restType: "short" | "long";
  hpRestored?: number;
  hitDiceUsed?: number;
}

export interface DnD5eLevelUpPayload {
  actorId: string;
  newLevel: number;
  class?: string;
  hpGained?: number;
}

export interface DnD5eDeathPayload {
  actorId: string;
  cause?: string;
}

export interface DnD5eStabilizedPayload {
  actorId: string;
  method?: string;
}

export interface EverdiceMovementPayload {
  actorId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  locationId?: string;
}

export interface EverdiceMapGeneratedPayload {
  mapType: string;
  dimensions: { width: number; height: number };
  seed?: string;
  locationId?: string;
}

export interface EverdiceNarrativeAdvancedPayload {
  content: string;
  choiceMade?: string;
  chapterId?: string;
}

export interface EverdiceQuestAcceptedPayload {
  questId: string;
  questName: string;
  givenBy?: string;
}

export interface EverdiceQuestCompletedPayload {
  questId: string;
  questName: string;
  outcome: "success" | "failure" | "abandoned";
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
}

export type TraceEventPayload =
  | SessionStartedPayload
  | SessionEndedPayload
  | EncounterAvailablePayload
  | EncounterTriggeredPayload
  | EncounterResolvedPayload
  | StateSetPayload
  | StateUnsetPayload
  | StateAddTagPayload
  | StateRemoveTagPayload
  | ItemGainedPayload
  | ItemLostPayload
  | ItemTransferredPayload
  | ActorDeclaredPayload
  | DnD5eRollPayload
  | DnD5eDamagePayload
  | DnD5eHealPayload
  | DnD5eRestPayload
  | DnD5eLevelUpPayload
  | DnD5eDeathPayload
  | DnD5eStabilizedPayload
  | EverdiceMovementPayload
  | EverdiceMapGeneratedPayload
  | EverdiceNarrativeAdvancedPayload
  | EverdiceQuestAcceptedPayload
  | EverdiceQuestCompletedPayload
  | EverdiceChapterAdvancedPayload;

export interface TraceEvent {
  eid: string;
  kind: TraceEventKind;
  payload: TraceEventPayload;
  ts?: string;
  sessionId?: string;
  who?: string;
  where?: string;
  note?: string;
  meta?: Record<string, unknown>;
}

export interface TraceSession {
  id: string;
  title?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface TraceActor {
  id: string;
  type: "PC" | "NPC" | "Party" | "System";
  name?: string;
}

export interface TraceCampaign {
  id: string;
  name: string;
  gm?: string;
  ruleset?: string;
}

export interface CAMLTrace {
  type: "CAMLTrace";
  id: string;
  moduleId: string;
  camlVersion?: string;
  traceVersion: string;
  campaign?: TraceCampaign;
  sessions?: TraceSession[];
  actors?: TraceActor[];
  events: TraceEvent[];
}

export function createTraceEvent(
  kind: TraceEventKind,
  payload: TraceEventPayload,
  options?: {
    sessionId?: string;
    who?: string;
    where?: string;
    note?: string;
    meta?: Record<string, unknown>;
  }
): Omit<TraceEvent, "eid"> {
  return {
    kind,
    payload,
    ts: new Date().toISOString(),
    ...options,
  };
}

export function generateEventId(eventIndex: number): string {
  return `evt.${String(eventIndex).padStart(6, "0")}`;
}

export function generateTraceId(campaignId: number | string): string {
  return `trace.everdice.campaign_${campaignId}`;
}

export function generateModuleId(campaignId: number | string, campaignName: string): string {
  const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  return `adventure.everdice.${slug}_${campaignId}`;
}
