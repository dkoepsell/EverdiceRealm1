import type { Express } from "express";
import { getAllPrices, getItemPrice, recordPurchase, recordSale, getSellPrice, getInflationMultiplier } from "./economyEngine";
import { db } from "./db";
import { sql, eq, and, desc } from "drizzle-orm";
import { playerListings, marketItemStats } from "@shared/schema";
import { isAuthenticated } from "./auth";

export function registerEconomyRoutes(app: Express) {
  app.get("/api/economy/prices", async (_req, res) => {
    try {
      const prices = await getAllPrices();
      const inflation = await getInflationMultiplier();
      res.json({ prices, inflationMultiplier: inflation });
    } catch (error: any) {
      console.error("[Economy] Failed to get prices:", error);
      res.status(500).json({ message: "Failed to get prices" });
    }
  });

  app.get("/api/economy/prices/:itemSlug", async (req, res) => {
    try {
      const price = await getItemPrice(req.params.itemSlug);
      if (!price) {
        return res.status(404).json({ message: "Item not found in market" });
      }
      res.json(price);
    } catch (error: any) {
      console.error("[Economy] Failed to get item price:", error);
      res.status(500).json({ message: "Failed to get item price" });
    }
  });

  app.get("/api/economy/market-summary", async (_req, res) => {
    try {
      const prices = await getAllPrices();
      const inflation = await getInflationMultiplier();

      const trending = prices
        .filter(p => p.trend === "rising")
        .sort((a, b) => b.demandMultiplier - a.demandMultiplier)
        .slice(0, 5);

      const bargains = prices
        .filter(p => p.trend === "falling")
        .sort((a, b) => a.demandMultiplier - b.demandMultiplier)
        .slice(0, 5);

      const mostPopular = [...prices]
        .sort((a, b) => b.totalPurchases - a.totalPurchases)
        .slice(0, 5);

      res.json({
        inflationMultiplier: inflation,
        trending,
        bargains,
        mostPopular,
        totalItems: prices.length,
      });
    } catch (error: any) {
      console.error("[Economy] Failed to get market summary:", error);
      res.status(500).json({ message: "Failed to get market summary" });
    }
  });

  app.get("/api/trading-post/player-listings", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const status = (req.query.status as string) || "active";

      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT pl.*, u.username as seller_username, c.name as character_name
          FROM player_listings pl
          LEFT JOIN users u ON pl.seller_id = u.id
          LEFT JOIN characters c ON pl.character_id = c.id
          WHERE pl.status = ${status} AND pl.item_name ILIKE ${searchPattern}
          ORDER BY pl.created_at DESC LIMIT 50
        `);
      } else {
        result = await db.execute(sql`
          SELECT pl.*, u.username as seller_username, c.name as character_name
          FROM player_listings pl
          LEFT JOIN users u ON pl.seller_id = u.id
          LEFT JOIN characters c ON pl.character_id = c.id
          WHERE pl.status = ${status}
          ORDER BY pl.created_at DESC LIMIT 50
        `);
      }
      res.json(result.rows);
    } catch (error: any) {
      console.error("[Economy] Failed to get player listings:", error);
      res.status(500).json({ message: "Failed to get player listings" });
    }
  });

  app.post("/api/trading-post/player-listings", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { characterId, itemName, itemData, askingPrice } = req.body;

      if (!characterId || !itemName || !itemData || !askingPrice) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (askingPrice < 1) {
        return res.status(400).json({ message: "Price must be at least 1 gold" });
      }

      const charResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${characterId}`);
      const character = charResult.rows[0] as any;

      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      if (character.user_id !== user.id) {
        return res.status(403).json({ message: "You don't own this character" });
      }

      const equipment: any[] = character.equipment || [];
      let foundIndex = -1;
      for (let i = 0; i < equipment.length; i++) {
        let parsed = equipment[i];
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { parsed = { name: parsed }; }
        }
        if (parsed.name === itemName && !parsed.equipped) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        return res.status(400).json({ message: "Item not found in inventory or is currently equipped" });
      }

      equipment.splice(foundIndex, 1);
      await db.execute(sql`UPDATE characters SET equipment = ${JSON.stringify(equipment)}::jsonb WHERE id = ${characterId}`);

      const [listing] = await db
        .insert(playerListings)
        .values({
          sellerId: user.id,
          characterId,
          itemName,
          itemData,
          askingPrice,
          status: "active",
          createdAt: new Date().toISOString(),
        })
        .returning();

      res.status(201).json(listing);
    } catch (error: any) {
      console.error("[Economy] Failed to create listing:", error);
      res.status(500).json({ message: "Failed to create listing" });
    }
  });

  app.post("/api/trading-post/player-listings/:id/buy", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const listingId = parseInt(req.params.id);
      const { characterId } = req.body;

      if (!characterId) {
        return res.status(400).json({ message: "Character ID required" });
      }

      const [listing] = await db
        .select()
        .from(playerListings)
        .where(eq(playerListings.id, listingId));

      if (!listing || listing.status !== "active") {
        return res.status(404).json({ message: "Listing not available" });
      }

      if (listing.sellerId === user.id) {
        return res.status(400).json({ message: "You can't buy your own listing" });
      }

      const buyerResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${characterId}`);
      const buyer = buyerResult.rows[0] as any;

      if (!buyer || buyer.user_id !== user.id) {
        return res.status(403).json({ message: "Invalid character" });
      }

      if ((buyer.gold || 0) < listing.askingPrice) {
        return res.status(400).json({ message: "Not enough gold" });
      }

      await db.execute(sql`UPDATE characters SET gold = gold - ${listing.askingPrice} WHERE id = ${characterId}`);

      const sellerCharResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${listing.characterId}`);
      const sellerChar = sellerCharResult.rows[0] as any;
      if (sellerChar) {
        await db.execute(sql`UPDATE characters SET gold = gold + ${listing.askingPrice} WHERE id = ${listing.characterId}`);
      }

      const buyerEquipment: any[] = buyer.equipment || [];
      buyerEquipment.push(JSON.stringify(listing.itemData));
      await db.execute(sql`UPDATE characters SET equipment = ${JSON.stringify(buyerEquipment)}::jsonb WHERE id = ${characterId}`);

      await db
        .update(playerListings)
        .set({
          status: "sold",
          buyerId: user.id,
          buyerCharacterId: characterId,
          soldAt: new Date().toISOString(),
        })
        .where(eq(playerListings.id, listingId));

      res.json({ message: "Purchase successful" });
    } catch (error: any) {
      console.error("[Economy] Failed to buy listing:", error);
      res.status(500).json({ message: "Failed to buy listing" });
    }
  });

  app.delete("/api/trading-post/player-listings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const listingId = parseInt(req.params.id);

      const [listing] = await db
        .select()
        .from(playerListings)
        .where(eq(playerListings.id, listingId));

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      if (listing.sellerId !== user.id) {
        return res.status(403).json({ message: "You can only cancel your own listings" });
      }

      if (listing.status !== "active") {
        return res.status(400).json({ message: "This listing is no longer active" });
      }

      const charResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${listing.characterId}`);
      const character = charResult.rows[0] as any;

      if (character) {
        const equipment: any[] = character.equipment || [];
        equipment.push(JSON.stringify(listing.itemData));
        await db.execute(sql`UPDATE characters SET equipment = ${JSON.stringify(equipment)}::jsonb WHERE id = ${listing.characterId}`);
      }

      await db
        .update(playerListings)
        .set({ status: "cancelled" })
        .where(eq(playerListings.id, listingId));

      res.json({ message: "Listing cancelled, item returned to inventory" });
    } catch (error: any) {
      console.error("[Economy] Failed to cancel listing:", error);
      res.status(500).json({ message: "Failed to cancel listing" });
    }
  });
}
