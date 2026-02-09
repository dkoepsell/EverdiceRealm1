import { db } from "./db";
import { sql } from "drizzle-orm";
import { marketItemStats } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEMAND_INCREASE_PER_PURCHASE = 0.05;
const DEMAND_DECAY_RATE = 0.02;
const DEMAND_DECAY_INTERVAL_MS = 60 * 60 * 1000;
const MIN_DEMAND_MULTIPLIER = 0.7;
const MAX_DEMAND_MULTIPLIER = 2.5;
const MIN_INFLATION_MULTIPLIER = 0.8;
const MAX_INFLATION_MULTIPLIER = 2.0;
const BASELINE_GOLD_PER_CHARACTER = 100;

let cachedInflation: { value: number; computedAt: number } | null = null;
const INFLATION_CACHE_TTL = 5 * 60 * 1000;

export interface DynamicPrice {
  itemSlug: string;
  basePrice: number;
  currentPrice: number;
  demandMultiplier: number;
  inflationMultiplier: number;
  finalPrice: number;
  finalPriceGold: number;
  finalPriceSilver: number;
  trend: "rising" | "falling" | "stable";
  totalPurchases: number;
}

export async function getInflationMultiplier(): Promise<number> {
  if (cachedInflation && Date.now() - cachedInflation.computedAt < INFLATION_CACHE_TTL) {
    return cachedInflation.value;
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(AVG(COALESCE(gold, 0) + COALESCE(silver, 0) / 10.0 + COALESCE(copper, 0) / 100.0), 0) as avg_gold,
        COUNT(*) as total_characters
      FROM characters
    `);

    const avgGold = parseFloat(String(result.rows[0]?.avg_gold || '0'));
    const totalCharacters = parseInt(String(result.rows[0]?.total_characters || '0'));

    if (totalCharacters === 0) {
      cachedInflation = { value: 1.0, computedAt: Date.now() };
      return 1.0;
    }

    const ratio = avgGold / BASELINE_GOLD_PER_CHARACTER;
    let inflation = 0.7 + (ratio * 0.3);
    inflation = Math.max(MIN_INFLATION_MULTIPLIER, Math.min(MAX_INFLATION_MULTIPLIER, inflation));

    cachedInflation = { value: inflation, computedAt: Date.now() };
    return inflation;
  } catch (error) {
    console.error("[Economy] Failed to compute inflation:", error);
    return 1.0;
  }
}

export async function getPlayerAdjustedInflation(playerGold: number): Promise<number> {
  const globalInflation = await getInflationMultiplier();
  
  if (globalInflation <= 1.0) return globalInflation;
  
  const ratio = playerGold / BASELINE_GOLD_PER_CHARACTER;
  
  if (ratio >= 1.0) return globalInflation;
  
  const relief = 1.0 - ratio;
  const adjustedInflation = globalInflation - (globalInflation - 1.0) * relief;
  return Math.max(1.0, adjustedInflation);
}

export async function getItemPrice(itemSlug: string): Promise<DynamicPrice | null> {
  try {
    await decayDemandIfNeeded(itemSlug);

    const [stats] = await db
      .select()
      .from(marketItemStats)
      .where(eq(marketItemStats.itemSlug, itemSlug));

    if (!stats) return null;

    const inflationMultiplier = await getInflationMultiplier();
    const finalPrice = stats.basePrice * stats.demandMultiplier * inflationMultiplier;

    const finalPriceGold = Math.floor(finalPrice);
    const finalPriceSilver = Math.round((finalPrice - finalPriceGold) * 10);

    let trend: "rising" | "falling" | "stable" = "stable";
    if (stats.demandMultiplier > 1.1) trend = "rising";
    else if (stats.demandMultiplier < 0.9) trend = "falling";

    return {
      itemSlug: stats.itemSlug,
      basePrice: stats.basePrice,
      currentPrice: stats.currentPrice,
      demandMultiplier: stats.demandMultiplier,
      inflationMultiplier,
      finalPrice,
      finalPriceGold,
      finalPriceSilver,
      trend,
      totalPurchases: stats.totalPurchases,
    };
  } catch (error) {
    console.error(`[Economy] Failed to get price for ${itemSlug}:`, error);
    return null;
  }
}

export async function getAllPrices(playerGold?: number): Promise<DynamicPrice[]> {
  try {
    const allStats = await db.select().from(marketItemStats);
    const inflationMultiplier = playerGold !== undefined
      ? await getPlayerAdjustedInflation(playerGold)
      : await getInflationMultiplier();

    return allStats.map((stats) => {
      const finalPrice = stats.basePrice * stats.demandMultiplier * inflationMultiplier;
      const finalPriceGold = Math.floor(finalPrice);
      const finalPriceSilver = Math.round((finalPrice - finalPriceGold) * 10);

      let trend: "rising" | "falling" | "stable" = "stable";
      if (stats.demandMultiplier > 1.1) trend = "rising";
      else if (stats.demandMultiplier < 0.9) trend = "falling";

      return {
        itemSlug: stats.itemSlug,
        basePrice: stats.basePrice,
        currentPrice: stats.currentPrice,
        demandMultiplier: stats.demandMultiplier,
        inflationMultiplier,
        finalPrice,
        finalPriceGold,
        finalPriceSilver,
        trend,
        totalPurchases: stats.totalPurchases,
      };
    });
  } catch (error) {
    console.error("[Economy] Failed to get all prices:", error);
    return [];
  }
}

export async function recordPurchase(itemSlug: string, quantity: number = 1): Promise<void> {
  try {
    const [stats] = await db
      .select()
      .from(marketItemStats)
      .where(eq(marketItemStats.itemSlug, itemSlug));

    if (!stats) return;

    const newDemand = Math.min(
      MAX_DEMAND_MULTIPLIER,
      stats.demandMultiplier + DEMAND_INCREASE_PER_PURCHASE * quantity
    );
    const newPrice = stats.basePrice * newDemand;

    await db
      .update(marketItemStats)
      .set({
        demandMultiplier: newDemand,
        currentPrice: newPrice,
        totalPurchases: stats.totalPurchases + quantity,
        recentPurchases: stats.recentPurchases + quantity,
        lastPurchaseAt: new Date().toISOString(),
      })
      .where(eq(marketItemStats.itemSlug, itemSlug));

    cachedInflation = null;
  } catch (error) {
    console.error(`[Economy] Failed to record purchase for ${itemSlug}:`, error);
  }
}

export async function recordSale(itemSlug: string): Promise<void> {
  try {
    const [stats] = await db
      .select()
      .from(marketItemStats)
      .where(eq(marketItemStats.itemSlug, itemSlug));

    if (!stats) return;

    const newDemand = Math.max(
      MIN_DEMAND_MULTIPLIER,
      stats.demandMultiplier - DEMAND_INCREASE_PER_PURCHASE * 0.5
    );
    const newPrice = stats.basePrice * newDemand;

    await db
      .update(marketItemStats)
      .set({
        demandMultiplier: newDemand,
        currentPrice: newPrice,
      })
      .where(eq(marketItemStats.itemSlug, itemSlug));
  } catch (error) {
    console.error(`[Economy] Failed to record sale for ${itemSlug}:`, error);
  }
}

async function decayDemandIfNeeded(itemSlug: string): Promise<void> {
  try {
    const [stats] = await db
      .select()
      .from(marketItemStats)
      .where(eq(marketItemStats.itemSlug, itemSlug));

    if (!stats) return;

    const lastDecay = stats.lastDecayAt ? new Date(stats.lastDecayAt).getTime() : 0;
    const timeSinceDecay = Date.now() - lastDecay;

    if (timeSinceDecay < DEMAND_DECAY_INTERVAL_MS) return;

    const decayCycles = Math.floor(timeSinceDecay / DEMAND_DECAY_INTERVAL_MS);
    if (decayCycles <= 0) return;

    let newDemand = stats.demandMultiplier;
    for (let i = 0; i < decayCycles; i++) {
      if (newDemand > 1.0) {
        newDemand = Math.max(1.0, newDemand - DEMAND_DECAY_RATE);
      } else if (newDemand < 1.0) {
        newDemand = Math.min(1.0, newDemand + DEMAND_DECAY_RATE);
      }
    }

    await db
      .update(marketItemStats)
      .set({
        demandMultiplier: newDemand,
        currentPrice: stats.basePrice * newDemand,
        recentPurchases: Math.max(0, stats.recentPurchases - decayCycles),
        lastDecayAt: new Date().toISOString(),
      })
      .where(eq(marketItemStats.itemSlug, itemSlug));
  } catch (error) {
    console.error(`[Economy] Demand decay failed for ${itemSlug}:`, error);
  }
}

export function getSellPrice(basePrice: number, demandMultiplier: number): number {
  const sellRatio = 0.4 + (demandMultiplier - 1.0) * 0.1;
  const clampedRatio = Math.max(0.25, Math.min(0.6, sellRatio));
  return Math.max(1, Math.floor(basePrice * clampedRatio));
}

const SHOP_ITEM_PRICES: Record<string, number> = {
  "club": 0.1, "dagger": 2, "greatclub": 0.2, "handaxe": 5, "javelin": 0.5,
  "light-hammer": 2, "mace": 5, "quarterstaff": 0.2, "sickle": 1, "spear": 1,
  "battleaxe": 10, "flail": 10, "glaive": 20, "greataxe": 30, "longsword": 15,
  "morningstar": 15, "pike": 5, "rapier": 25, "scimitar": 25, "shortsword": 10,
  "trident": 5, "war-pick": 5, "warhammer": 15, "whip": 2, "greatsword": 50,
  "lance": 10, "maul": 10, "shortbow": 25, "light-crossbow": 25, "hand-crossbow": 75,
  "heavy-crossbow": 50, "longbow": 50, "pistol": 250, "musket": 500,
  "ammunition-arrows": 1, "ammunition-bolts": 1, "ammunition-bullets": 3,
  "padded-armor": 5, "leather-armor": 10, "studded-leather": 45, "hide-armor": 10,
  "chain-shirt": 50, "scale-mail": 50, "breastplate": 400, "half-plate": 750,
  "ring-mail": 30, "chain-mail": 75, "splint-armor": 200, "plate-armor": 1500,
  "wooden-shield": 10, "steel-shield": 15,
  "healing-potion": 50, "greater-healing-potion": 150, "superior-healing-potion": 500,
  "antitoxin": 50, "holy-water": 25, "oil-flask": 0.1, "alchemists-fire": 50, "acid-vial": 25,
  "thieves-tools": 25, "smiths-tools": 20, "alchemists-supplies": 50, "brewers-supplies": 20,
  "herbalism-kit": 5, "poisoners-kit": 50, "tinkers-tools": 50, "leatherworkers-tools": 5,
  "woodcarvers-tools": 1, "component-pouch": 25, "arcane-focus": 10, "holy-symbol": 5,
  "explorers-pack": 10, "dungeoneers-pack": 12,
  "rope-hemp": 1, "rope-silk": 10, "torch-bundle": 0.1, "rations": 2.5,
  "caltrops": 1, "grappling-hook": 2, "lantern-hooded": 5, "lantern-bullseye": 10,
  "bedroll": 1, "spyglass": 1000, "manacles": 2, "tent": 2, "crowbar": 2,
};

export async function syncMarketItemStats(): Promise<void> {
  try {
    for (const [slug, basePrice] of Object.entries(SHOP_ITEM_PRICES)) {
      const [existing] = await db
        .select()
        .from(marketItemStats)
        .where(eq(marketItemStats.itemSlug, slug));
      
      if (!existing) {
        await db.insert(marketItemStats).values({
          itemSlug: slug,
          basePrice,
          currentPrice: basePrice,
          demandMultiplier: 1.0,
          totalPurchases: 0,
          recentPurchases: 0,
        });
      } else if (existing.basePrice !== basePrice) {
        await db
          .update(marketItemStats)
          .set({ basePrice, currentPrice: basePrice * existing.demandMultiplier })
          .where(eq(marketItemStats.itemSlug, slug));
      }
    }
    console.log("[Economy] Market item stats synced successfully");
  } catch (error) {
    console.error("[Economy] Failed to sync market item stats:", error);
  }
}
