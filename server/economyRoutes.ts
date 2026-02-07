import type { Express } from "express";
import { getAllPrices, getItemPrice, recordPurchase, recordSale, getSellPrice, getInflationMultiplier } from "./economyEngine";
import { db } from "./db";
import { sql, eq, and, desc } from "drizzle-orm";
import { playerListings, marketItemStats } from "@shared/schema";
import { isAuthenticated } from "./auth";

interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  requiredLevel: number;
  requiredSkills: string[];
  requiredTools: string[];
  goldCost: number;
  craftingDC: number;
  result: {
    name: string;
    type: string;
    rarity: string;
    description: string;
    damage?: string;
    armor?: number;
    properties?: string;
    weight: number;
  };
}

const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: "craft-arrows", name: "Craft Arrows (20)", description: "Whittle and fletch a bundle of arrows.", type: "Ammunition", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: [], goldCost: 0, craftingDC: 8, result: { name: "Arrows (20)", type: "Ammunition", rarity: "common", description: "A quiver of 20 hand-crafted arrows.", weight: 1 } },
  { id: "craft-bolts", name: "Craft Bolts (20)", description: "Forge a case of crossbow bolts.", type: "Ammunition", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 0, craftingDC: 8, result: { name: "Bolts (20)", type: "Ammunition", rarity: "common", description: "A case of 20 hand-crafted bolts.", weight: 1.5 } },
  { id: "craft-torch-bundle", name: "Craft Torches (10)", description: "Wrap cloth and pitch around sticks.", type: "Adventuring Gear", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: [], goldCost: 0, craftingDC: 5, result: { name: "Torches (10)", type: "Adventuring Gear", rarity: "common", description: "A bundle of 10 handmade torches.", properties: "Bright light 20 ft, dim 20 ft", weight: 10 } },
  { id: "craft-dagger", name: "Forge Dagger", description: "Forge a simple dagger from metal.", type: "Simple Weapon", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 1, craftingDC: 10, result: { name: "Dagger", type: "Simple Melee Weapon", rarity: "common", description: "A hand-forged blade, sharp and balanced.", damage: "1d4 piercing", properties: "Finesse, light, thrown (20/60)", weight: 1 } },
  { id: "craft-club", name: "Carve Club", description: "Shape a heavy piece of wood into a club.", type: "Simple Weapon", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: [], goldCost: 0, craftingDC: 5, result: { name: "Club", type: "Simple Melee Weapon", rarity: "common", description: "A stout, handmade club.", damage: "1d4 bludgeoning", properties: "Light", weight: 2 } },
  { id: "craft-quarterstaff", name: "Carve Quarterstaff", description: "Shape and balance a hardwood staff.", type: "Simple Weapon", rarity: "common", requiredLevel: 1, requiredSkills: [], requiredTools: ["Woodcarver's Tools"], goldCost: 0, craftingDC: 8, result: { name: "Quarterstaff", type: "Simple Melee Weapon", rarity: "common", description: "A hand-carved versatile staff.", damage: "1d6 bludgeoning (versatile 1d8)", weight: 4 } },
  { id: "craft-handaxe", name: "Forge Handaxe", description: "Smith a light throwing axe.", type: "Simple Weapon", rarity: "common", requiredLevel: 2, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 2, craftingDC: 12, result: { name: "Handaxe", type: "Simple Melee Weapon", rarity: "common", description: "A hand-forged throwing axe.", damage: "1d6 slashing", properties: "Light, thrown (20/60)", weight: 2 } },
  { id: "craft-shortsword", name: "Forge Shortsword", description: "A nimble blade requiring skill to forge.", type: "Martial Weapon", rarity: "common", requiredLevel: 3, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 5, craftingDC: 13, result: { name: "Shortsword", type: "Martial Melee Weapon", rarity: "common", description: "A hand-forged quick blade.", damage: "1d6 piercing", properties: "Finesse, light", weight: 2 } },
  { id: "craft-longsword", name: "Forge Longsword", description: "Forge a versatile martial blade.", type: "Martial Weapon", rarity: "common", requiredLevel: 4, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 8, craftingDC: 14, result: { name: "Longsword", type: "Martial Melee Weapon", rarity: "common", description: "A carefully forged versatile blade.", damage: "1d8 slashing (versatile 1d10)", weight: 3 } },
  { id: "craft-battleaxe", name: "Forge Battleaxe", description: "A heavy axe requiring expert smithing.", type: "Martial Weapon", rarity: "common", requiredLevel: 4, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 5, craftingDC: 14, result: { name: "Battleaxe", type: "Martial Melee Weapon", rarity: "common", description: "A masterfully forged battle axe.", damage: "1d8 slashing (versatile 1d10)", weight: 4 } },
  { id: "craft-greatsword", name: "Forge Greatsword", description: "A massive blade only master smiths can create.", type: "Martial Weapon", rarity: "common", requiredLevel: 6, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 25, craftingDC: 16, result: { name: "Greatsword", type: "Martial Melee Weapon", rarity: "common", description: "A masterwork two-handed blade.", damage: "2d6 slashing", properties: "Heavy, two-handed", weight: 6 } },
  { id: "craft-shortbow", name: "Craft Shortbow", description: "Shape and string a compact bow.", type: "Simple Weapon", rarity: "common", requiredLevel: 2, requiredSkills: [], requiredTools: ["Woodcarver's Tools"], goldCost: 10, craftingDC: 12, result: { name: "Shortbow", type: "Simple Ranged Weapon", rarity: "common", description: "A hand-crafted compact bow.", damage: "1d6 piercing", properties: "Ammunition (80/320), two-handed", weight: 2 } },
  { id: "craft-longbow", name: "Craft Longbow", description: "A tall bow requiring expert woodworking.", type: "Martial Weapon", rarity: "common", requiredLevel: 5, requiredSkills: [], requiredTools: ["Woodcarver's Tools"], goldCost: 25, craftingDC: 15, result: { name: "Longbow", type: "Martial Ranged Weapon", rarity: "common", description: "An expertly crafted tall bow.", damage: "1d8 piercing", properties: "Ammunition (150/600), heavy, two-handed", weight: 2 } },
  { id: "craft-leather-armor", name: "Craft Leather Armor", description: "Tan and shape leather into protective armor.", type: "Light Armor", rarity: "common", requiredLevel: 2, requiredSkills: [], requiredTools: ["Leatherworker's Tools"], goldCost: 5, craftingDC: 12, result: { name: "Leather Armor", type: "Light Armor", rarity: "common", description: "Hand-crafted supple leather armor.", armor: 11, properties: "+Dex modifier to AC", weight: 10 } },
  { id: "craft-studded-leather", name: "Craft Studded Leather", description: "Reinforce leather with metal studs.", type: "Light Armor", rarity: "common", requiredLevel: 4, requiredSkills: [], requiredTools: ["Leatherworker's Tools", "Smith's Tools"], goldCost: 22, craftingDC: 14, result: { name: "Studded Leather", type: "Light Armor", rarity: "common", description: "Reinforced leather with close-set rivets.", armor: 12, properties: "+Dex modifier to AC", weight: 13 } },
  { id: "craft-scale-mail", name: "Forge Scale Mail", description: "Forge and assemble overlapping metal scales.", type: "Medium Armor", rarity: "common", requiredLevel: 5, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 25, craftingDC: 15, result: { name: "Scale Mail", type: "Medium Armor", rarity: "common", description: "Forged overlapping metal scales.", armor: 14, properties: "+Dex modifier (max 2), disadvantage on Stealth", weight: 45 } },
  { id: "craft-chain-mail", name: "Forge Chain Mail", description: "Weave interlocking metal rings into heavy armor.", type: "Heavy Armor", rarity: "common", requiredLevel: 6, requiredSkills: [], requiredTools: ["Smith's Tools"], goldCost: 38, craftingDC: 16, result: { name: "Chain Mail", type: "Heavy Armor", rarity: "common", description: "Masterfully woven interlocking rings.", armor: 16, properties: "Disadvantage on Stealth, Str 13 required", weight: 55 } },
  { id: "craft-shield", name: "Craft Wooden Shield", description: "Shape and reinforce a sturdy wooden shield.", type: "Shield", rarity: "common", requiredLevel: 2, requiredSkills: [], requiredTools: ["Woodcarver's Tools"], goldCost: 5, craftingDC: 11, result: { name: "Wooden Shield", type: "Shield", rarity: "common", description: "A hand-crafted sturdy shield.", armor: 2, properties: "+2 AC bonus", weight: 6 } },
  { id: "craft-healing-potion", name: "Brew Healing Potion", description: "Brew a red potion that heals wounds.", type: "Potion", rarity: "common", requiredLevel: 3, requiredSkills: ["Medicine", "Nature", "Arcana"], requiredTools: ["Herbalism Kit", "Alchemist's Supplies"], goldCost: 25, craftingDC: 13, result: { name: "Potion of Healing", type: "Potion", rarity: "common", description: "A hand-brewed healing potion. Heals 2d4+2 HP.", properties: "Heals 2d4+2 hit points", weight: 0.5 } },
  { id: "craft-greater-healing-potion", name: "Brew Greater Healing Potion", description: "A potent healing elixir requiring advanced alchemy.", type: "Potion", rarity: "uncommon", requiredLevel: 6, requiredSkills: ["Medicine", "Arcana"], requiredTools: ["Alchemist's Supplies"], goldCost: 75, craftingDC: 16, result: { name: "Potion of Greater Healing", type: "Potion", rarity: "uncommon", description: "A potent healing draught. Heals 4d4+4 HP.", properties: "Heals 4d4+4 hit points", weight: 0.5 } },
  { id: "craft-antitoxin", name: "Brew Antitoxin", description: "Prepare a mixture that neutralizes poisons.", type: "Consumable", rarity: "common", requiredLevel: 2, requiredSkills: ["Medicine", "Nature"], requiredTools: ["Herbalism Kit", "Alchemist's Supplies"], goldCost: 25, craftingDC: 12, result: { name: "Antitoxin", type: "Consumable", rarity: "common", description: "A hand-brewed poison remedy.", properties: "Advantage on poison saves for 1 hour", weight: 0.5 } },
  { id: "craft-alchemists-fire", name: "Brew Alchemist's Fire", description: "Mix volatile chemicals into a sticky, flammable adhesive.", type: "Consumable", rarity: "common", requiredLevel: 3, requiredSkills: ["Arcana"], requiredTools: ["Alchemist's Supplies"], goldCost: 25, craftingDC: 14, result: { name: "Alchemist's Fire", type: "Consumable", rarity: "common", description: "A flask of crafted sticky fire.", properties: "1d4 fire per turn until extinguished (DC 10 Dex)", weight: 1 } },
  { id: "craft-acid-vial", name: "Brew Acid Vial", description: "Distill caustic acids into a throwable vial.", type: "Consumable", rarity: "common", requiredLevel: 3, requiredSkills: ["Arcana"], requiredTools: ["Alchemist's Supplies"], goldCost: 12, craftingDC: 13, result: { name: "Acid Vial", type: "Consumable", rarity: "common", description: "A vial of hand-distilled acid.", properties: "2d6 acid damage (thrown, 20 ft)", weight: 1 } },
  { id: "craft-holy-water", name: "Bless Holy Water", description: "Consecrate water with divine prayer.", type: "Consumable", rarity: "common", requiredLevel: 1, requiredSkills: ["Religion"], requiredTools: [], goldCost: 25, craftingDC: 12, result: { name: "Holy Water", type: "Consumable", rarity: "common", description: "Blessed water that burns the unholy.", properties: "2d6 radiant vs undead/fiends (thrown)", weight: 1 } },
];

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
        if (parsed.name === itemName) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        return res.status(400).json({ message: "Item not found in inventory" });
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

  app.get("/api/crafting/recipes", (_req, res) => {
    res.json(CRAFTING_RECIPES);
  });

  app.post("/api/crafting/craft", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { characterId, recipeId } = req.body;

      if (!characterId || !recipeId) {
        return res.status(400).json({ message: "Character and recipe required" });
      }

      const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      const charResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${characterId}`);
      const character = charResult.rows[0] as any;

      if (!character || character.user_id !== user.id) {
        return res.status(403).json({ message: "Invalid character" });
      }

      if ((character.level || 1) < recipe.requiredLevel) {
        return res.status(400).json({ message: `Requires level ${recipe.requiredLevel}. Your character is level ${character.level || 1}.` });
      }

      const charSkills: string[] = character.skills || [];
      if (recipe.requiredSkills.length > 0) {
        const hasSkill = recipe.requiredSkills.some(skill => 
          charSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
        );
        if (!hasSkill) {
          return res.status(400).json({ message: `Requires proficiency in one of: ${recipe.requiredSkills.join(", ")}` });
        }
      }

      const equipment: any[] = character.equipment || [];
      if (recipe.requiredTools.length > 0) {
        for (const tool of recipe.requiredTools) {
          const hasTool = equipment.some((item: any) => {
            let parsed = item;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch { parsed = { name: parsed }; }
            }
            return parsed.name && parsed.name.toLowerCase().includes(tool.toLowerCase());
          });
          if (!hasTool) {
            return res.status(400).json({ message: `Requires ${tool} in inventory` });
          }
        }
      }

      const gold = character.gold || 0;
      if (gold < recipe.goldCost) {
        return res.status(400).json({ message: `Not enough gold. Need ${recipe.goldCost} gp, have ${gold} gp.` });
      }

      const roll = Math.floor(Math.random() * 20) + 1;
      let bonus = 0;
      if (recipe.requiredSkills.length > 0) {
        const hasSkill = recipe.requiredSkills.some(skill =>
          charSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
        );
        if (hasSkill) bonus += Math.floor(((character.level || 1) + 7) / 4);
      }
      const total = roll + bonus;
      const success = total >= recipe.craftingDC;

      await db.execute(sql`UPDATE characters SET gold = gold - ${recipe.goldCost} WHERE id = ${characterId}`);

      if (success) {
        const craftedItem = JSON.stringify(recipe.result);
        equipment.push(craftedItem);
        await db.execute(sql`UPDATE characters SET equipment = ${JSON.stringify(equipment)}::jsonb WHERE id = ${characterId}`);
      }

      res.json({
        success,
        roll,
        bonus,
        total,
        dc: recipe.craftingDC,
        goldSpent: recipe.goldCost,
        item: success ? recipe.result : null,
        message: success
          ? `Rolled ${roll}${bonus > 0 ? `+${bonus}` : ''} = ${total} vs DC ${recipe.craftingDC}. Crafted ${recipe.result.name}!`
          : `Rolled ${roll}${bonus > 0 ? `+${bonus}` : ''} = ${total} vs DC ${recipe.craftingDC}. Crafting failed! Materials consumed.`
      });
    } catch (error: any) {
      console.error("[Economy] Crafting failed:", error);
      res.status(500).json({ message: "Crafting failed" });
    }
  });
}
