/**
 * Server-resolved ability checks (engagement spec Phase 2).
 *
 *   GET  /api/campaigns/:campaignId/roll-check/preview?skill=persuasion&action=...
 *        → the math the Roll dialog shows before rolling (modifier breakdown,
 *          Inspiration available, a companion who can Help, any advantage or
 *          disadvantage that already applies). The DC stays hidden, as at a real table.
 *   POST /api/campaigns/:campaignId/roll-check
 *        body: { skill, action, useInspiration?, useHelp? }
 *        → rolls on the server and returns the result + a signed token the
 *          turn routes accept in place of a client-side roll.
 *
 * The DC comes from the menu choice the DM offered (looked up server-side by
 * the action text), never from the client; typed actions use the DC that
 * /assess-action proposed, clamped to the 5–30 bands.
 */
import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import type { Character } from "@shared/schema";
import {
  type CheckModifier, checkModifier, combineRollMode, describeCheck, dcLabel, normalizeSkill, resolveCheck, validateDc,
} from "@shared/rules/checks";
import { signRollToken } from "./rollToken";
import { itemAdvantages } from "@shared/rules/magicItems";
import { recordRulesFired } from "../rules/rulesSeen";
import { resolveFlags } from "@shared/engagementFlags";

function parseStoryState(raw: unknown): any {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

const normText = (v: unknown) => (typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "");

interface CheckContext {
  campaignId: number;
  userId: number;
  character: Character;
  session: Awaited<ReturnType<typeof storage.getCurrentSession>>;
  storyState: any;
  choice: any | null;
  modifier: CheckModifier;
  dc: number;
  helper: string | null;
  flags: ReturnType<typeof resolveFlags>;
}

async function loadContext(req: Request, res: Response, skillRaw: unknown, action: unknown, dcHint: unknown): Promise<CheckContext | null> {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  const userId = (req.user as any).id as number;
  const campaignId = Number(req.params.campaignId);
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return null;
  }
  const participants = await storage.getCampaignParticipants(campaignId);
  const mine = participants.filter((p: any) => p.userId === userId && p.characterId);
  const wanted = Number((req.body as any)?.characterId ?? req.query.characterId);
  const seat = mine.find((p: any) => p.characterId === wanted) ?? mine[0];
  if (!seat) {
    res.status(403).json({ message: "You don't have a character in this campaign." });
    return null;
  }
  const character = await storage.getCharacter(seat.characterId!);
  if (!character) {
    res.status(404).json({ message: "Character not found" });
    return null;
  }
  const session = await storage.getCurrentSession(campaignId);
  const storyState = parseStoryState(session?.storyState);
  const choices: any[] = Array.isArray(session?.choices) ? (session!.choices as any[]) : [];
  const want = normText(action);
  const choice = want ? choices.find((c) => [c?.text, c?.action].some((t) => normText(t) === want)) ?? null : null;
  const skill = normalizeSkill(choice?.skillType ?? skillRaw) ?? normalizeSkill(choice?.rollPurpose) ?? "strength";
  const modifier = checkModifier(character, skill);
  const dc = validateDc(choice?.rollDC ?? dcHint);

  let helper: string | null = null;
  if (!storyState?.director?.helpUsed) {
    const npcs = await storage.getCampaignNpcs(campaignId);
    for (const cn of npcs) {
      if ((cn.role === "companion" || cn.role === "ally") && (cn.status ?? "conscious") === "conscious") {
        const npc = await storage.getNpc(cn.npcId);
        if (npc?.name) {
          helper = npc.name;
          break;
        }
      }
    }
  }
  return { campaignId, userId, character, session, storyState, choice, modifier, dc, helper, flags: resolveFlags(campaign) };
}

/** Advantage/disadvantage sources that already apply, with reasons (5e: they never stack). */
function standingModifiers(ctx: CheckContext) {
  const adv: string[] = [];
  const dis: string[] = [];
  if (typeof ctx.choice?.advantage === "string" && ctx.choice.advantage) adv.push(ctx.choice.advantage);
  if (typeof ctx.choice?.disadvantage === "string" && ctx.choice.disadvantage) dis.push(ctx.choice.disadvantage);
  if (((ctx.character as any).exhaustionLevel ?? 0) >= 1) dis.push("Exhaustion gives disadvantage on ability checks");
  // Magic items that grant advantage (Cloak of Elvenkind on Stealth, Eyes of the Eagle on Perception...).
  const owned = Array.isArray(ctx.character.equipment) ? (ctx.character.equipment as string[]) : [];
  for (const item of itemAdvantages(owned, ctx.modifier.skill)) adv.push(item);
  return { adv, dis };
}

export function registerCheckRoutes(app: Express) {
  app.get("/api/campaigns/:campaignId/roll-check/preview", async (req, res) => {
    try {
      const ctx = await loadContext(req, res, req.query.skill, req.query.action, req.query.dc);
      if (!ctx) return;
      const { adv, dis } = standingModifiers(ctx);
      const personality = (ctx.character.personality ?? {}) as Record<string, string>;
      res.json({
        label: ctx.modifier.label,
        modifier: ctx.modifier,
        dcHidden: true,
        inspiration: ctx.flags.inspiration && !!ctx.character.inspiration,
        inspirationSource: personality.bond || personality.ideal || null,
        helper: ctx.flags.inspiration ? ctx.helper : null,
        advantageReasons: adv,
        disadvantageReasons: dis,
      });
    } catch (err) {
      console.error("[roll-check] preview failed:", err);
      res.status(500).json({ message: "Failed to prepare the roll" });
    }
  });

  app.post("/api/campaigns/:campaignId/roll-check", async (req, res) => {
    try {
      const body = req.body ?? {};
      const ctx = await loadContext(req, res, body.skill, body.action, body.dc);
      if (!ctx) return;
      const { adv, dis } = standingModifiers(ctx);
      const fired: { id: string; detail?: string }[] = [{ id: "ability_check" }];
      let spentInspiration = false;
      let helped = false;
      if (ctx.flags.inspiration && body.useInspiration && ctx.character.inspiration) {
        adv.push("Inspiration");
        spentInspiration = true;
        fired.push({ id: "inspiration" });
      }
      if (ctx.flags.inspiration && body.useHelp && ctx.helper) {
        adv.push(`${ctx.helper} takes the Help action`);
        helped = true;
        fired.push({ id: "help" });
      }
      const mode = combineRollMode(adv.length, dis.length);
      if (adv.length || dis.length) fired.push({ id: "advantage" });
      if (ctx.modifier.expertise) fired.push({ id: "expertise" });
      else if (ctx.modifier.proficient) fired.push({ id: "proficiency" });
      if (dis.some((d) => d.startsWith("Exhaustion"))) fired.push({ id: "exhaustion" });

      const result = resolveCheck(ctx.modifier, ctx.dc, mode);
      if (spentInspiration) await storage.updateCharacter(ctx.character.id, { inspiration: false } as Partial<Character>);
      if (helped && ctx.session) {
        const director = { ...(ctx.storyState?.director ?? {}), helpUsed: true };
        await storage.updateSessionStoryState(ctx.campaignId, ctx.session.sessionNumber, { ...ctx.storyState, director });
      }
      const action = typeof body.action === "string" ? body.action.slice(0, 500) : "";
      const token = signRollToken({
        campaignId: ctx.campaignId,
        userId: ctx.userId,
        characterId: ctx.character.id,
        skill: ctx.modifier.skill,
        label: ctx.modifier.label,
        dice: result.dice,
        kept: result.kept,
        mode: result.mode,
        modifier: ctx.modifier.total,
        total: result.total,
        dc: result.dc,
        success: result.success,
        action,
        issuedAt: Date.now(),
      });
      const rules = ctx.flags.rulesUnderneath ? await recordRulesFired(ctx.userId, fired) : [];
      res.json({
        ...result,
        dcLabel: dcLabel(result.dc),
        description: describeCheck(result),
        advantageReasons: adv,
        disadvantageReasons: dis,
        spentInspiration,
        helpedBy: helped ? ctx.helper : null,
        token,
        rulesFired: rules,
      });
    } catch (err) {
      console.error("[roll-check] failed:", err);
      res.status(500).json({ message: "Failed to roll" });
    }
  });
}
