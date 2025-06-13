
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
  createMonster: async (data: InsertMonster) => {
    const [monster] = await db.insert(monsters).values(data).returning();
    return monster;
  },
  getAllMonsters: async () => db.select().from(monsters),

  createQuest: async (data: InsertQuest) => {
    const [quest] = await db.insert(quests).values(data).returning();
    return quest;
  },
  getAllQuests: async () => db.select().from(quests),

  createItem: async (data: InsertInventory) => {
    const [item] = await db.insert(inventory).values(data).returning();
    return item;
  },
  getAllItems: async () => db.select().from(inventory)
};
