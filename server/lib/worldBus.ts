import { EventEmitter } from "events";

/**
 * A process-local feed of things happening in the shared world.
 *
 * Exploration state is written from nine different places in routes.ts and none
 * of them notified anything, so no surface could react to a party moving. The
 * hook lives in the storage layer rather than at those call sites so every
 * path -- present and future -- is covered by construction.
 *
 * This is in-memory and per-process: it is a live feed, not a log. Nothing here
 * is durable, and a subscriber that connects late has missed whatever came
 * before. Consumers reconcile by refetching a snapshot on (re)connect.
 */
export type WorldBusEvent =
  | {
      type: "party_moved";
      campaignId: number;
      hexQ: number;
      hexR: number;
      prevQ?: number;
      prevR?: number;
      at: string;
    }
  | {
      type: "hex_explored";
      campaignId: number;
      hexQ: number;
      hexR: number;
      locationName?: string;
      terrainType?: string;
      at: string;
    }
  | {
      type: "campaign_status";
      campaignId: number;
      status: "active" | "completed" | "archived";
      at: string;
    };

export const worldBus = new EventEmitter();

// One listener per subscribed admin socket, plus headroom. Node warns at 10.
worldBus.setMaxListeners(50);

/**
 * Publish an event. Never throws: a broken subscriber must not be able to fail
 * the database write that produced the event.
 */
export function emitWorld(event: WorldBusEvent): void {
  try {
    worldBus.emit("event", event);
  } catch (err) {
    console.error("[worldBus] listener threw:", err);
  }
}

/** Subscribe. Returns an unsubscribe function. */
export function onWorldEvent(handler: (event: WorldBusEvent) => void): () => void {
  worldBus.on("event", handler);
  return () => {
    worldBus.off("event", handler);
  };
}

export const nowIso = (): string => new Date().toISOString();
