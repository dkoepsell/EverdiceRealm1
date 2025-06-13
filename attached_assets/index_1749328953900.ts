
import { db } from "../db";
import {
  locations,
  npcs,
  inventory,
  encounters,
  rewards,
  monsters,
  quests
} from "@shared/schema";
import {
  InsertLocation,
  InsertNPC,
  InsertInventory,
  InsertEncounter,
  InsertReward,
  InsertMonster,
  InsertQuest
} from "@shared/schema/types";

export const dmStorage = {
  // Locations
  createLocation: async (data: InsertLocation) => {
    return (await db.insert(locations).values(data).returning())[0];
  },
  getAllLocations: async () => {
    return await db.select().from(locations);
  },

  // NPCs
  createNPC: async (data: InsertNPC) => {
    return (await db.insert(npcs).values(data).returning())[0];
  },
  getAllNPCs: async () => {
    return await db.select().from(npcs);
  },

  // Inventory
  createItem: async (data: InsertInventory) => {
    return (await db.insert(inventory).values(data).returning())[0];
  },
  getAllItems: async () => {
    return await db.select().from(inventory);
  },

  // Encounters
  createEncounter: async (data: InsertEncounter) => {
    return (await db.insert(encounters).values(data).returning())[0];
  },
  getAllEncounters: async () => {
    return await db.select().from(encounters);
  },

  // Rewards
  createReward: async (data: InsertReward) => {
    return (await db.insert(rewards).values(data).returning())[0];
  },
  getAllRewards: async () => {
    return await db.select().from(rewards);
  },

  // Monsters
  createMonster: async (data: InsertMonster) => {
    return (await db.insert(monsters).values(data).returning())[0];
  },
  getAllMonsters: async () => {
    return await db.select().from(monsters);
  },

  // Quests
  createQuest: async (data: InsertQuest) => {
    return (await db.insert(quests).values(data).returning())[0];
  },
  getAllQuests: async () => {
    return await db.select().from(quests);
  }
};
