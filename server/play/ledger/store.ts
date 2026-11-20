/**
 * Load/save the Campaign Ledger. A campaign with no row yet is seeded from its
 * generated decision-makers (campaigns.npc_attitudes). Failures degrade to an
 * empty ledger: memory is a bonus, never a reason a turn fails.
 */
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { campaignLedger } from "@shared/schema";
import { type Ledger, parseLedger } from "@shared/ledger";
import { seedLedgerFromCampaign } from "./merge";

export async function loadLedger(campaignId: number, campaign?: { npcAttitudes?: unknown } | null): Promise<Ledger> {
  try {
    const [row] = await db.select().from(campaignLedger).where(eq(campaignLedger.campaignId, campaignId));
    if (row) return parseLedger(row);
  } catch (err) {
    console.warn("[ledger] load failed:", (err as Error)?.message);
  }
  return seedLedgerFromCampaign(campaign?.npcAttitudes);
}

export async function saveLedger(campaignId: number, ledger: Ledger): Promise<void> {
  const values = {
    turn: ledger.turn,
    cast: ledger.cast,
    threads: ledger.threads,
    deeds: ledger.deeds,
    places: ledger.places,
    itemsOfNote: ledger.itemsOfNote,
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.insert(campaignLedger).values({ campaignId, ...values })
      .onConflictDoUpdate({ target: campaignLedger.campaignId, set: values });
  } catch (err) {
    console.warn("[ledger] save failed:", (err as Error)?.message);
  }
}
