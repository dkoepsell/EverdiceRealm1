
import express from "express";
import { dmStorage } from "../storage/index";

const router = express.Router();

router.post("/monsters", async (req, res) => {
  try {
    const created = await dmStorage.createMonster(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to create monster", error: err.message });
  }
});

router.post("/items", async (req, res) => {
  try {
    const created = await dmStorage.createItem(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to create item", error: err.message });
  }
});

router.post("/quests", async (req, res) => {
  try {
    const created = await dmStorage.createQuest(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to create quest", error: err.message });
  }
});

export default router;
