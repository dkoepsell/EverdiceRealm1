import type { Express } from "express";
import { db } from "./db";
import { eq, sql, desc, and, ilike } from "drizzle-orm";
import {
  sharedAdventures,
  sharedItems,
  tradingPostReviews,
  users,
  insertSharedAdventureSchema,
  insertSharedItemSchema,
  insertTradingPostReviewSchema,
} from "@shared/schema";
import { isAuthenticated } from "./auth";
import { objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";
import { getAppOpenAI } from "./lib/aiProvider";
import { storage } from "./storage";

async function generateAdventureCoverArt(title: string, description: string, genre: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return "";
    }

    const openai = getAppOpenAI();

    const prompt = `Create a stunning fantasy adventure cover art for a tabletop RPG adventure called "${title}". Genre: ${genre}. ${description.substring(0, 200)}. Style: Epic fantasy book cover art with dramatic lighting, rich colors, and an atmosphere of mystery and adventure. The image should evoke the feeling of an exciting quest ahead, suitable for a fantasy RPG module cover.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageData = response.data?.[0];
    if (!imageData || !imageData.url) {
      return "";
    }

    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      return "";
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return "";
    }

    const bucket = objectStorageClient.bucket(bucketId);
    const uuid = randomUUID();
    const file = bucket.file(`public/adventures/${uuid}.png`);

    await file.save(imageBuffer, {
      contentType: "image/png",
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    return `/objects/adventures/${uuid}.png`;
  } catch (error: any) {
    console.error("Error generating adventure cover art:", error.message);
    return "";
  }
}

export function registerTradingPostRoutes(app: Express) {
  app.get("/api/trading-post/adventures/featured", async (_req, res) => {
    try {
      const featured = await db
        .select()
        .from(sharedAdventures)
        .where(eq(sharedAdventures.status, "published"))
        .orderBy(desc(sharedAdventures.downloadCount))
        .limit(10);

      const authorIds = Array.from(new Set(featured.map((a) => a.authorId)));
      const authorUsers =
        authorIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(authorIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const authorMap = new Map(authorUsers.map((u) => [u.id, u.username]));

      const result = featured.map((a) => ({
        ...a,
        authorUsername: authorMap.get(a.authorId) || "Unknown",
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching featured adventures:", error.message);
      res.status(500).json({ message: "Failed to fetch featured adventures" });
    }
  });

  app.get("/api/trading-post/adventures", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const difficulty = req.query.difficulty as string | undefined;
      const genre = req.query.genre as string | undefined;
      const sort = (req.query.sort as string) || "newest";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;

      const conditions = [eq(sharedAdventures.status, "published")];

      if (search) {
        conditions.push(ilike(sharedAdventures.title, `%${search}%`));
      }
      if (difficulty) {
        conditions.push(eq(sharedAdventures.difficulty, difficulty));
      }
      if (genre) {
        conditions.push(eq(sharedAdventures.genre, genre));
      }

      let orderBy;
      switch (sort) {
        case "popular":
          orderBy = desc(sharedAdventures.downloadCount);
          break;
        case "top_rated":
          orderBy = desc(sharedAdventures.avgRating);
          break;
        case "newest":
        default:
          orderBy = desc(sharedAdventures.createdAt);
          break;
      }

      const adventures = await db
        .select()
        .from(sharedAdventures)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const authorIds = Array.from(new Set(adventures.map((a) => a.authorId)));
      const authorUsers =
        authorIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(authorIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const authorMap = new Map(authorUsers.map((u) => [u.id, u.username]));

      const result = adventures.map((a) => ({
        ...a,
        authorUsername: authorMap.get(a.authorId) || "Unknown",
      }));

      res.json({ adventures: result, page, limit });
    } catch (error: any) {
      console.error("Error browsing adventures:", error.message);
      res.status(500).json({ message: "Failed to browse adventures" });
    }
  });

  app.get("/api/trading-post/adventures/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adventure ID" });
      }

      const [adventure] = await db
        .select()
        .from(sharedAdventures)
        .where(eq(sharedAdventures.id, id));

      if (!adventure) {
        return res.status(404).json({ message: "Adventure not found" });
      }

      const [author] = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, adventure.authorId));

      const reviews = await db
        .select()
        .from(tradingPostReviews)
        .where(
          and(
            eq(tradingPostReviews.targetType, "adventure"),
            eq(tradingPostReviews.targetId, id)
          )
        )
        .orderBy(desc(tradingPostReviews.createdAt));

      const reviewerIds = Array.from(new Set(reviews.map((r) => r.userId)));
      const reviewerUsers =
        reviewerIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(reviewerIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const reviewerMap = new Map(reviewerUsers.map((u) => [u.id, u.username]));

      const reviewsWithUsernames = reviews.map((r) => ({
        ...r,
        username: reviewerMap.get(r.userId) || "Unknown",
      }));

      res.json({
        ...adventure,
        author: author || { username: "Unknown" },
        reviews: reviewsWithUsernames,
      });
    } catch (error: any) {
      console.error("Error fetching adventure:", error.message);
      res.status(500).json({ message: "Failed to fetch adventure" });
    }
  });

  app.post("/api/trading-post/adventures", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const body = {
        ...req.body,
        authorId: user.id,
        status: "published",
        createdAt: new Date().toISOString(),
      };

      const validated = insertSharedAdventureSchema.parse(body);

      let coverImageUrl = validated.coverImageUrl || "";
      if (!coverImageUrl) {
        coverImageUrl = await generateAdventureCoverArt(
          validated.title,
          validated.description,
          validated.genre || "fantasy"
        );
      }

      const [adventure] = await db
        .insert(sharedAdventures)
        .values({
          ...validated,
          coverImageUrl,
        })
        .returning();

      res.status(201).json(adventure);
    } catch (error: any) {
      console.error("Error publishing adventure:", error.message);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid adventure data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to publish adventure" });
    }
  });

  app.post("/api/trading-post/adventures/:id/download", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adventure ID" });
      }

      const [adventure] = await db
        .update(sharedAdventures)
        .set({ downloadCount: sql`${sharedAdventures.downloadCount} + 1` })
        .where(eq(sharedAdventures.id, id))
        .returning();

      if (!adventure) {
        return res.status(404).json({ message: "Adventure not found" });
      }

      res.json({ camlData: adventure.camlData, downloadCount: adventure.downloadCount });
    } catch (error: any) {
      console.error("Error downloading adventure:", error.message);
      res.status(500).json({ message: "Failed to download adventure" });
    }
  });

  app.delete("/api/trading-post/adventures/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid adventure ID" });
      }

      const [adventure] = await db
        .select()
        .from(sharedAdventures)
        .where(eq(sharedAdventures.id, id));

      if (!adventure) {
        return res.status(404).json({ message: "Adventure not found" });
      }

      if (adventure.authorId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own adventures" });
      }

      await db.delete(sharedAdventures).where(eq(sharedAdventures.id, id));
      res.json({ message: "Adventure deleted" });
    } catch (error: any) {
      console.error("Error deleting adventure:", error.message);
      res.status(500).json({ message: "Failed to delete adventure" });
    }
  });

  app.get("/api/trading-post/items", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const itemType = req.query.itemType as string | undefined;
      const rarity = req.query.rarity as string | undefined;
      const sort = (req.query.sort as string) || "newest";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;

      const conditions = [eq(sharedItems.status, "published")];

      if (search) {
        conditions.push(ilike(sharedItems.name, `%${search}%`));
      }
      if (itemType) {
        conditions.push(eq(sharedItems.itemType, itemType));
      }
      if (rarity) {
        conditions.push(eq(sharedItems.rarity, rarity));
      }

      let orderBy;
      switch (sort) {
        case "popular":
          orderBy = desc(sharedItems.downloadCount);
          break;
        case "top_rated":
          orderBy = desc(sharedItems.avgRating);
          break;
        case "newest":
        default:
          orderBy = desc(sharedItems.createdAt);
          break;
      }

      const items = await db
        .select()
        .from(sharedItems)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const authorIds = Array.from(new Set(items.map((i) => i.authorId)));
      const authorUsers =
        authorIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(authorIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const authorMap = new Map(authorUsers.map((u) => [u.id, u.username]));

      const result = items.map((i) => ({
        ...i,
        authorUsername: authorMap.get(i.authorId) || "Unknown",
      }));

      res.json({ items: result, page, limit });
    } catch (error: any) {
      console.error("Error browsing items:", error.message);
      res.status(500).json({ message: "Failed to browse items" });
    }
  });

  app.get("/api/trading-post/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const [item] = await db
        .select()
        .from(sharedItems)
        .where(eq(sharedItems.id, id));

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const [author] = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, item.authorId));

      const reviews = await db
        .select()
        .from(tradingPostReviews)
        .where(
          and(
            eq(tradingPostReviews.targetType, "item"),
            eq(tradingPostReviews.targetId, id)
          )
        )
        .orderBy(desc(tradingPostReviews.createdAt));

      const reviewerIds = Array.from(new Set(reviews.map((r) => r.userId)));
      const reviewerUsers =
        reviewerIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(reviewerIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const reviewerMap = new Map(reviewerUsers.map((u) => [u.id, u.username]));

      const reviewsWithUsernames = reviews.map((r) => ({
        ...r,
        username: reviewerMap.get(r.userId) || "Unknown",
      }));

      res.json({
        ...item,
        author: author || { username: "Unknown" },
        reviews: reviewsWithUsernames,
      });
    } catch (error: any) {
      console.error("Error fetching item:", error.message);
      res.status(500).json({ message: "Failed to fetch item" });
    }
  });

  app.post("/api/trading-post/items", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { characterId, itemRaw, lore, tags } = req.body;

      if (!characterId || itemRaw === undefined || itemRaw === null) {
        return res.status(400).json({ message: "Character and item selection are required" });
      }

      const charResult = await db.execute(sql`SELECT * FROM characters WHERE id = ${characterId}`);
      const character = charResult.rows[0] as any;

      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      if (character.user_id !== user.id) {
        return res.status(403).json({ message: "You don't own this character" });
      }

      let parsedItem: any;
      if (typeof itemRaw === 'string') {
        try {
          parsedItem = JSON.parse(itemRaw);
        } catch {
          parsedItem = { name: itemRaw };
        }
      } else {
        parsedItem = itemRaw;
      }

      const itemName = parsedItem.name || "Unknown Item";
      const itemType = parsedItem.type || "weapon";
      const rarity = parsedItem.rarity || "common";
      const stats: Record<string, any> = {};
      if (parsedItem.damageDice || parsedItem.damage) stats.damage = parsedItem.damageDice || parsedItem.damage;
      if (parsedItem.damageType) stats.damageType = parsedItem.damageType;
      if (parsedItem.baseAC || parsedItem.armor) stats.baseAC = parsedItem.baseAC || parsedItem.armor;
      if (parsedItem.properties) stats.properties = parsedItem.properties;
      if (parsedItem.magicBonus) stats.magicBonus = parsedItem.magicBonus;
      if (parsedItem.specialEffect) stats.specialEffect = parsedItem.specialEffect;
      const description = parsedItem.description || parsedItem.specialEffect || `A ${rarity} ${itemType} item.`;

      const body = {
        authorId: user.id,
        name: itemName,
        description,
        itemType,
        rarity,
        stats,
        lore: lore || undefined,
        tags: Array.isArray(tags) ? tags : [],
        status: "published",
        createdAt: new Date().toISOString(),
      };

      const validated = insertSharedItemSchema.parse(body);

      const [item] = await db
        .insert(sharedItems)
        .values(validated)
        .returning();

      // Badge: first item published to Trading Post (fire-and-forget)
      storage.tryAwardBadge(user.id, 'Merchant of the Realm', { itemId: item.id }).catch(() => {});

      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error publishing item:", error.message);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to publish item" });
    }
  });

  app.delete("/api/trading-post/items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user!;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const [item] = await db
        .select()
        .from(sharedItems)
        .where(eq(sharedItems.id, id));

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.authorId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own items" });
      }

      await db.delete(sharedItems).where(eq(sharedItems.id, id));
      res.json({ message: "Item deleted" });
    } catch (error: any) {
      console.error("Error deleting item:", error.message);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  app.get("/api/trading-post/reviews/:targetType/:targetId", async (req, res) => {
    try {
      const { targetType, targetId } = req.params;
      const id = parseInt(targetId);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid target ID" });
      }

      if (targetType !== "adventure" && targetType !== "item") {
        return res.status(400).json({ message: "Target type must be 'adventure' or 'item'" });
      }

      const reviews = await db
        .select()
        .from(tradingPostReviews)
        .where(
          and(
            eq(tradingPostReviews.targetType, targetType),
            eq(tradingPostReviews.targetId, id)
          )
        )
        .orderBy(desc(tradingPostReviews.createdAt));

      const reviewerIds = Array.from(new Set(reviews.map((r) => r.userId)));
      const reviewerUsers =
        reviewerIds.length > 0
          ? await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(sql`${users.id} IN (${sql.join(reviewerIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
      const reviewerMap = new Map(reviewerUsers.map((u) => [u.id, u.username]));

      const result = reviews.map((r) => ({
        ...r,
        username: reviewerMap.get(r.userId) || "Unknown",
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching reviews:", error.message);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/trading-post/reviews", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const body = {
        ...req.body,
        userId: user.id,
        createdAt: new Date().toISOString(),
      };

      const validated = insertTradingPostReviewSchema.parse(body);

      if (validated.rating < 1 || validated.rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      if (validated.targetType !== "adventure" && validated.targetType !== "item") {
        return res.status(400).json({ message: "Target type must be 'adventure' or 'item'" });
      }

      const [existingReview] = await db
        .select()
        .from(tradingPostReviews)
        .where(
          and(
            eq(tradingPostReviews.userId, user.id),
            eq(tradingPostReviews.targetType, validated.targetType),
            eq(tradingPostReviews.targetId, validated.targetId)
          )
        );

      if (existingReview) {
        return res.status(409).json({ message: "You have already reviewed this content" });
      }

      const [review] = await db
        .insert(tradingPostReviews)
        .values(validated)
        .returning();

      const allReviews = await db
        .select({ rating: tradingPostReviews.rating })
        .from(tradingPostReviews)
        .where(
          and(
            eq(tradingPostReviews.targetType, validated.targetType),
            eq(tradingPostReviews.targetId, validated.targetId)
          )
        );

      const totalRatings = allReviews.length;
      const avgRating = Math.round(
        allReviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      );

      if (validated.targetType === "adventure") {
        await db
          .update(sharedAdventures)
          .set({ avgRating, totalRatings })
          .where(eq(sharedAdventures.id, validated.targetId));
      } else {
        await db
          .update(sharedItems)
          .set({ avgRating, totalRatings })
          .where(eq(sharedItems.id, validated.targetId));
      }

      res.status(201).json(review);
    } catch (error: any) {
      console.error("Error submitting review:", error.message);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid review data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit review" });
    }
  });
}
