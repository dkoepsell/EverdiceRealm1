
import { db } from "../db";
import {
  monsters,
  quests,
  inventory
} from "@shared/schema";
import {
  InsertMonster,
  InsertQuest,
  InsertInventory
} from "@shared/schema/types";

export const dmStorage = {
  // Create and fetch Monsters
  createMonster: async (data: InsertMonster) => {
    const [monster] = await db.insert(monsters).values(data).returning();
    return monster;
  },
  getAllMonsters: async () => {
    return await db.select().from(monsters);
  },

  // Create and fetch Quests
  createQuest: async (data: InsertQuest) => {
    const [quest] = await db.insert(quests).values(data).returning();
    return quest;
  },
  getAllQuests: async () => {
    return await db.select().from(quests);
  },

  // Create and fetch Inventory Items
  createItem: async (data: InsertInventory) => {
    const [item] = await db.insert(inventory).values(data).returning();
    return item;
  },
  getAllItems: async () => {
    return await db.select().from(inventory);
  }
};
