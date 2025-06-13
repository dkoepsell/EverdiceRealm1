
// server/routes/dmToolkit.ts
import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Locations
router.get('/locations', async (req, res) => {
  res.json(await storage.getLocations());
});

router.post('/locations', async (req, res) => {
  const loc = await storage.addLocation(req.body);
  res.status(201).json(loc);
});

// NPCs
router.get('/npcs', async (req, res) => {
  res.json(await storage.getNPCs());
});

router.post('/npcs', async (req, res) => {
  const npc = await storage.addNPC(req.body);
  res.status(201).json(npc);
});

// Encounters
router.get('/encounters', async (req, res) => {
  res.json(await storage.getEncounters());
});

router.post('/encounters', async (req, res) => {
  const enc = await storage.addEncounter(req.body);
  res.status(201).json(enc);
});

// Items
router.get('/items', async (req, res) => {
  res.json(await storage.getItems());
});

router.post('/items', async (req, res) => {
  const item = await storage.addItem(req.body);
  res.status(201).json(item);
});

// Rewards
router.get('/rewards', async (req, res) => {
  res.json(await storage.getRewards());
});

router.post('/rewards', async (req, res) => {
  const reward = await storage.addReward(req.body);
  res.status(201).json(reward);
});

export default router;
