/**
 * Level Up dialog API (engagement spec Phase 1.3).
 *   GET  /api/characters/:id/level-up  → what the next level-up offers (or { pending: null })
 *   POST /api/characters/:id/level-up  → apply the player's choices
 *        body: { hpMode: "average" | "roll", asi?: AsiChoice, subclass?: string }
 */
import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { getClassDef } from "@shared/rules/classProgression";
import type { LevelUpChoices } from "@shared/rules/leveling";
import { completeLevelUp, levelUpPlanFor } from "./levelUps";

async function ownedCharacter(req: Request, res: Response) {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid character id" });
    return null;
  }
  const character = await storage.getCharacter(id);
  if (!character || character.userId !== (req.user as any).id) {
    res.status(404).json({ message: "Character not found" });
    return null;
  }
  return character;
}

function parseChoices(body: any): LevelUpChoices {
  const out: LevelUpChoices = { hpMode: body?.hpMode === "roll" ? "roll" : "average" };
  if (body?.asi && typeof body.asi === "object") out.asi = body.asi;
  if (typeof body?.subclass === "string") out.subclass = body.subclass;
  return out;
}

export function registerLevelUpRoutes(app: Express) {
  app.get("/api/characters/:id/level-up", async (req, res) => {
    try {
      const character = await ownedCharacter(req, res);
      if (!character) return;
      const plan = levelUpPlanFor(character);
      const def = getClassDef(character.class);
      res.json({
        pending: plan,
        character: {
          id: character.id,
          name: character.name,
          class: character.class,
          level: character.level,
          subclass: character.subclass,
          maxHitPoints: character.maxHitPoints,
          abilityScores: {
            strength: character.strength,
            dexterity: character.dexterity,
            constitution: character.constitution,
            intelligence: character.intelligence,
            wisdom: character.wisdom,
            charisma: character.charisma,
          },
        },
        reason: (character.pendingLevelUp as any)?.reason ?? null,
        subclassLabel: def?.subclassLabel ?? null,
      });
    } catch (err) {
      console.error("[level-up] plan failed:", err);
      res.status(500).json({ message: "Failed to load level-up" });
    }
  });

  app.post("/api/characters/:id/level-up", async (req, res) => {
    try {
      const character = await ownedCharacter(req, res);
      if (!character) return;
      const result = await completeLevelUp(character, parseChoices(req.body), (req.user as any).id);
      if (!result.ok) return res.status(result.status).json({ message: result.errors[0], errors: result.errors });
      res.json({
        character: result.character,
        hp: result.hp,
        newFeatureIds: result.newFeatureIds,
        toLevel: result.plan.toLevel,
        morePending: result.morePending,
      });
    } catch (err) {
      console.error("[level-up] apply failed:", err);
      res.status(500).json({ message: "Failed to apply level-up" });
    }
  });
}
