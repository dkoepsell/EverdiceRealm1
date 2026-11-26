/**
 * Load the campaign's active companions and allies (campaign_npcs + npcs) as
 * CompanionView, and apply a turn's bond changes back to the ledger and, when
 * a companion leaves, to campaign_npcs.
 */
import { storage } from "../../storage";
import { type BondEvent, type CompanionView, abilitiesFor, classFromNpc, inferValues, skillsFor } from "./companions";

export { syncCompanionsToLedger } from "./companions";

const nameCache = new Map<number, string>();
async function controllerName(userId: number): Promise<string> {
  if (nameCache.has(userId)) return nameCache.get(userId)!;
  const u: any = await storage.getUser(userId);
  const name = String(u?.displayName || u?.username || "a friend").slice(0, 40);
  nameCache.set(userId, name);
  return name;
}

export async function loadCompanions(campaignId: number): Promise<CompanionView[]> {
  const rows = await storage.getCampaignNpcs(campaignId);
  const out: CompanionView[] = [];
  for (const cn of rows) {
    if (!cn.isActive || (cn.role !== "companion" && cn.role !== "ally")) continue;
    const npc: any = await storage.getNpc(cn.npcId);
    if (!npc?.name) continue;
    const className = classFromNpc(npc);
    const text = [npc.personality, npc.motivation, npc.aiPersonality, npc.occupation].filter(Boolean).join(" ");
    const { likes, dislikes } = inferValues(text, className);
    const maxHp = Number(cn.maxHp ?? npc.maxHitPoints ?? npc.hitPoints ?? 10) || 10;
    out.push({
      campaignNpcId: cn.id,
      name: String(npc.name),
      race: String(npc.race ?? ""),
      className,
      level: Math.max(1, Number(npc.level) || 1),
      personality: String(npc.personality ?? ""),
      motivation: String(npc.motivation ?? ""),
      voice: String(npc.aiPersonality ?? ""),
      hp: Number(cn.currentHp ?? npc.hitPoints ?? maxHp),
      maxHp,
      status: String(cn.status ?? npc.status ?? "conscious"),
      abilities: abilitiesFor(npc, className),
      skills: skillsFor(npc, className),
      likes,
      dislikes,
      controlledBy: cn.controlledBy ?? null,
      controllerName: cn.controlledBy ? await controllerName(cn.controlledBy) : null,
    });
  }
  return out;
}

/** A companion who has had enough leaves the party for good (campaign_npcs.is_active = false). */
export async function applyDepartures(companions: CompanionView[], events: BondEvent[]): Promise<void> {
  for (const e of events) {
    if (e.milestone !== "leaves") continue;
    const c = companions.find((x) => x.name === e.name);
    if (c) await storage.updateCampaignNpc(c.campaignNpcId, { isActive: false } as any);
  }
}
