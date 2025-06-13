
// server/storage.ts
import { Location, NPC, Encounter, Item, Reward } from "@shared/schema";

let locations: Location[] = [];
let npcs: NPC[] = [];
let encounters: Encounter[] = [];
let items: Item[] = [];
let rewards: Reward[] = [];

export const storage = {
  // LOCATIONS
  getLocations: async () => locations,
  addLocation: async (loc: Location) => {
    locations.push(loc);
    return loc;
  },

  // NPCS
  getNPCs: async () => npcs,
  addNPC: async (npc: NPC) => {
    npcs.push(npc);
    return npc;
  },

  // ENCOUNTERS
  getEncounters: async () => encounters,
  addEncounter: async (enc: Encounter) => {
    encounters.push(enc);
    return enc;
  },

  // ITEMS
  getItems: async () => items,
  addItem: async (item: Item) => {
    items.push(item);
    return item;
  },

  // REWARDS
  getRewards: async () => rewards,
  addReward: async (reward: Reward) => {
    rewards.push(reward);
    return reward;
  }
};
