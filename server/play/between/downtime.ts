/**
 * Downtime that seeds the next adventure (engagement spec 6.2; SRD-compatible
 * wording, after the "downtime activities" idea): research turns up a rumor,
 * carousing makes a contact (or a complication), training works toward a tool
 * or language proficiency. Each is a real ability check and leaves a hook.
 */
import { checkModifier, type CheckCharacter } from "@shared/rules/checks";
import type { DowntimeHook, LegendNpc } from "./legend";

export type HookActivity = "research" | "carousing" | "training";

export const HOOK_ACTIVITIES: Record<HookActivity, { skill: string; label: string; dc: number; blurb: string }> = {
  research: { skill: "investigation", label: "Research", dc: 12, blurb: "Days in archives and taverns, chasing a rumor worth following." },
  carousing: { skill: "persuasion", label: "Carousing", dc: 12, blurb: "Make friends, or enemies, among the locals." },
  training: { skill: "intelligence", label: "Training", dc: 10, blurb: "Practice toward a tool or language proficiency (5 sessions)." },
};

const RUMORS = [
  "Someone is buying up every lantern oil cask in the river towns, and no one knows why.",
  "A caravan left the pass three weeks ago and never arrived; its guards were seen drinking in the next town.",
  "The old chapel bell rang at midnight, and the priest swears no one was in the tower.",
  "A map to a drowned vault is being auctioned in secret, and two guilds want it badly.",
  "Wolves have been seen walking in a line, like soldiers, along the forest road.",
  "A noble's heir vanished on the eve of their wedding; the family says they're 'travelling'.",
];
const CONTACTS: LegendNpc[] = [
  { name: "Petra Quill", role: "dockside fence", want: "a partner she can trust", attitude: 1 },
  { name: "Oswin Hale", role: "retired city guard", want: "one last case solved", attitude: 1 },
  { name: "Lark", role: "travelling minstrel", want: "a song worth singing", attitude: 2 },
  { name: "Brother Tamsin", role: "monastery archivist", want: "a stolen book returned", attitude: 1 },
];
const COMPLICATIONS = [
  "You wake up owing a dangerous woman a favor.",
  "A brawl ends with a city guard who now knows your face.",
  "You lost a wager you can't remember making.",
];
const TOOLS = ["Thieves' Tools", "Herbalism Kit", "Navigator's Tools", "Elvish", "Dwarvish", "Draconic"];

export function runHookActivity(
  activity: HookActivity,
  character: CheckCharacter & { downtimeState?: unknown },
  rng: () => number = Math.random,
): { success: boolean; total: number; breakdown: string; hook: DowntimeHook | null; message: string; trainingProgress?: { name: string; sessions: number } } {
  const cfg = HOOK_ACTIVITIES[activity];
  const m = checkModifier(character, cfg.skill);
  const d20 = 1 + Math.floor(rng() * 20);
  const total = d20 + m.total;
  const success = total >= cfg.dc;
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const breakdown = `${m.label}: d20 (${d20}) ${m.total >= 0 ? "+" : "−"} ${Math.abs(m.total)} = ${total} vs DC ${cfg.dc}`;
  const now = new Date().toISOString();
  if (activity === "research") {
    if (!success) return { success, total, breakdown, hook: null, message: "The trail goes cold this time." };
    const text = pick(RUMORS);
    return { success, total, breakdown, hook: { kind: "rumor", text, createdAt: now }, message: `You learn a rumor: ${text}` };
  }
  if (activity === "carousing") {
    if (!success) {
      const c = pick(COMPLICATIONS);
      return { success, total, breakdown, hook: { kind: "rumor", text: c, createdAt: now }, message: `A complication: ${c}` };
    }
    const npc = pick(CONTACTS);
    return { success, total, breakdown, hook: { kind: "contact", text: `${npc.name}, ${npc.role}, owes you a drink`, npc, createdAt: now }, message: `You make a contact: ${npc.name}, ${npc.role}.` };
  }
  const d = (character.downtimeState && typeof character.downtimeState === "object" ? character.downtimeState : {}) as any;
  const current = d.training && typeof d.training.name === "string" ? d.training : { name: pick(TOOLS), sessions: 0 };
  const sessions = current.sessions + (success ? 1 : 0);
  if (sessions >= 5) {
    return { success, total, breakdown, hook: { kind: "training", text: `You are now proficient with ${current.name}.`, createdAt: now }, message: `Training complete: you gain proficiency with ${current.name}.`, trainingProgress: { name: current.name, sessions } };
  }
  return { success, total, breakdown, hook: null, message: success ? `Training in ${current.name}: ${sessions} of 5 sessions.` : `A frustrating session of ${current.name}. No progress.`, trainingProgress: { name: current.name, sessions } };
}
