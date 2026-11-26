/**
 * Companions who feel present (companions spec). Pure functions; the
 * storage-backed loader is in ./load.ts.
 *
 *  - partyPromptBlock: who travels with the player, in every story prompt.
 *    The shorter prompt (promptDiet) had dropped them entirely, so outside a
 *    fight the narrator didn't know they existed.
 *  - values and approval: each companion likes and dislikes some kinds of
 *    deed (the ledger's deed tags). The player's deeds move their approval
 *    in code; approval maps to the 5e attitudes (hostile / indifferent /
 *    friendly, with nuance) shown in the Journal. High approval opens their
 *    personal thread; low approval brings warnings, and at the bottom they leave.
 *  - pickMoment: each scene the GAME decides whether a companion gets a
 *    moment, who, and what kind (react, warn, notice, aside, camp talk,
 *    banter), so it doesn't depend on the model remembering them.
 *  - companions roll their own skills: a choice can name a companion as its
 *    actor, and the roll uses that companion's real modifier.
 */
import type { DeedTag, Ledger } from "@shared/ledger";
import type { CheckCharacter } from "@shared/rules/checks";
import { passives as passiveScores } from "@shared/rules/checks";
import { attitudeFromPoints } from "@shared/companionMood";

export interface CompanionView {
  campaignNpcId: number;
  name: string;
  race: string;
  className: string;
  level: number;
  personality: string;
  motivation: string;
  /** Free-text behaviour notes (npcs.ai_personality). */
  voice: string;
  hp: number;
  maxHp: number;
  status: string;
  abilities: { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number };
  skills: string[];
  likes: DeedTag[];
  dislikes: DeedTag[];
  /** A friend playing this companion (campaign_npcs.controlled_by), and their name. */
  controlledBy?: number | null;
  controllerName?: string | null;
}

/** What a friend playing a companion has told the game, kept on storyState.companionIntents. */
export interface CompanionIntent {
  text?: string;
  order?: { action: "attack" | "dodge"; target?: string };
  by: string;
  at: string;
}

export function parseIntents(raw: unknown): Record<string, CompanionIntent> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, CompanionIntent> = {};
  for (const [name, v] of Object.entries(raw as Record<string, any>)) {
    if (!v || typeof v !== "object") continue;
    const text = typeof v.text === "string" ? v.text.trim().slice(0, 400) : undefined;
    const order = v.order && (v.order.action === "attack" || v.order.action === "dodge")
      ? { action: v.order.action as "attack" | "dodge", target: typeof v.order.target === "string" ? v.order.target.slice(0, 60) : undefined }
      : undefined;
    if (!text && !order) continue;
    out[name] = { text, order, by: String(v.by ?? "a friend").slice(0, 40), at: String(v.at ?? "") };
  }
  return out;
}

/** The narrator line for companions played by friends: say what they said, and don't put other words in their mouths. */
export function intentsPromptLine(companions: CompanionView[], intents: Record<string, CompanionIntent>): string {
  const played = companions.filter((c) => c.controlledBy);
  if (!played.length) return "";
  const lines = played.map((c) => {
    const i = intents[c.name];
    const who = c.controllerName ?? "a friend";
    return i?.text
      ? `- ${c.name} is played by ${who}, who says ${c.name} does or says: "${i.text}". Make exactly that happen in this scene, in ${c.name}'s voice, and show how others react.`
      : `- ${c.name} is played by ${who}. Don't write new dialogue or decisions for ${c.name}; describe them briefly and leave room for their player.`;
  });
  return `COMPANIONS PLAYED BY FRIENDS:\n${lines.join("\n")}`;
}

const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];

/** NPC rows have an occupation, not a class: read a class out of it, else by flavour, else Fighter. */
export function classFromNpc(npc: { occupation?: string | null; companionType?: string | null } | null | undefined): string {
  const text = `${npc?.occupation ?? ""} ${npc?.companionType ?? ""}`;
  const direct = CLASSES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  if (direct) return direct;
  if (/\b(priest\w*|healer|acolyte|monk of|temple|cleric)\b/i.test(text)) return "Cleric";
  if (/\b(thief|scout|spy|burglar|smuggler)\b/i.test(text)) return "Rogue";
  if (/\b(mage|scholar|sage|arcanist|apprentice)\b/i.test(text)) return "Wizard";
  if (/\b(hunter|tracker|woodsman|guide)\b/i.test(text)) return "Ranger";
  if (/\b(minstrel|musician|performer|poet)\b/i.test(text)) return "Bard";
  if (/\b(knight|templar|crusader)\b/i.test(text)) return "Paladin";
  if (/\bsupport|healing\b/i.test(text)) return "Cleric";
  return "Fighter";
}

/** Standard-array scores per class, for companions created without ability scores. */
const CLASS_ABILITIES: Record<string, CompanionView["abilities"]> = {
  Barbarian: { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
  Bard: { strength: 8, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 13, charisma: 15 },
  Cleric: { strength: 13, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 15, charisma: 12 },
  Druid: { strength: 8, dexterity: 13, constitution: 14, intelligence: 12, wisdom: 15, charisma: 10 },
  Fighter: { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
  Monk: { strength: 10, dexterity: 15, constitution: 13, intelligence: 8, wisdom: 14, charisma: 12 },
  Paladin: { strength: 15, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 12, charisma: 14 },
  Ranger: { strength: 12, dexterity: 15, constitution: 13, intelligence: 10, wisdom: 14, charisma: 8 },
  Rogue: { strength: 8, dexterity: 15, constitution: 13, intelligence: 14, wisdom: 12, charisma: 10 },
  Sorcerer: { strength: 8, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 15 },
  Warlock: { strength: 8, dexterity: 13, constitution: 14, intelligence: 12, wisdom: 10, charisma: 15 },
  Wizard: { strength: 8, dexterity: 13, constitution: 14, intelligence: 15, wisdom: 12, charisma: 10 },
};

/** Two skills from each class's SRD list, for companions created without skills. */
const CLASS_SKILLS: Record<string, string[]> = {
  Barbarian: ["athletics", "perception"], Bard: ["persuasion", "performance"], Cleric: ["insight", "medicine"],
  Druid: ["nature", "survival"], Fighter: ["athletics", "intimidation"], Monk: ["acrobatics", "insight"],
  Paladin: ["athletics", "persuasion"], Ranger: ["survival", "perception", "stealth"], Rogue: ["stealth", "sleight_of_hand", "perception", "investigation"],
  Sorcerer: ["arcana", "persuasion"], Warlock: ["arcana", "deception"], Wizard: ["arcana", "history"],
};

export function abilitiesFor(npc: any, className: string): CompanionView["abilities"] {
  const base = CLASS_ABILITIES[className] ?? CLASS_ABILITIES.Fighter;
  const pick = (k: keyof CompanionView["abilities"]) => {
    const n = Number(npc?.[k]);
    return Number.isFinite(n) && n >= 3 && n <= 30 ? n : base[k];
  };
  return {
    strength: pick("strength"), dexterity: pick("dexterity"), constitution: pick("constitution"),
    intelligence: pick("intelligence"), wisdom: pick("wisdom"), charisma: pick("charisma"),
  };
}

export function skillsFor(npc: any, className: string): string[] {
  const own = Array.isArray(npc?.skills) ? (npc.skills as unknown[]).map((s) => String(s).toLowerCase().replace(/[\s-]+/g, "_")).filter(Boolean) : [];
  return own.length ? own : CLASS_SKILLS[className] ?? CLASS_SKILLS.Fighter;
}

// ── Values ───────────────────────────────────────────────────────────────────

const VALUE_WORDS: [DeedTag, RegExp][] = [
  ["mercy", /\b(kind|gentle|compassion\w*|merciful|healer|caring|protect\w*|innocent|peace\w*|soft-hearted|warm)\b/i],
  ["honesty", /\b(honest|truth\w*|noble|honou?r\w*|lawful|just|principled|upright)\b/i],
  ["loyalty", /\b(loyal\w*|devoted|faithful|friend\w*|family|oath\w*|steadfast)\b/i],
  ["greed", /\b(greed\w*|coin|gold|profit\w*|mercenary|treasure|rich|wealth\w*|money)\b/i],
  ["cunning", /\b(clever|cunning|sly|scheming|trick\w*|wily|shrewd|sharp-witted)\b/i],
  ["bravery", /\b(brave|bold|reckless|glory|fearless|courage\w*|daring|valiant|hot-headed)\b/i],
  ["piety", /\b(pious|faith\w*|devout|priest\w*|god|gods|goddess|temple|holy|divine)\b/i],
  ["curiosity", /\b(curious|scholar\w*|knowledge|lore|study|studious|explor\w*|inquisitive|bookish)\b/i],
  ["generosity", /\b(generous|charit\w*|giving|selfless|share\w*)\b/i],
  ["cruelty", /\b(cruel|ruthless|vengeful|bloodthirsty|cold-hearted|merciless|vicious)\b/i],
];

/** What each value is offended by. */
const OPPOSITES: Partial<Record<DeedTag, DeedTag[]>> = {
  mercy: ["cruelty"],
  honesty: ["deceit", "betrayal"],
  loyalty: ["betrayal"],
  greed: ["generosity"],
  cunning: [],
  bravery: [],
  piety: ["cruelty"],
  curiosity: [],
  generosity: ["greed"],
  cruelty: ["mercy"],
};

const CLASS_VALUES: Record<string, DeedTag[]> = {
  Barbarian: ["bravery", "loyalty"], Bard: ["curiosity", "generosity"], Cleric: ["piety", "mercy"],
  Druid: ["mercy", "curiosity"], Fighter: ["bravery", "loyalty"], Monk: ["honesty", "mercy"],
  Paladin: ["honesty", "bravery"], Ranger: ["loyalty", "mercy"], Rogue: ["cunning", "greed"],
  Sorcerer: ["bravery", "curiosity"], Warlock: ["cunning", "curiosity"], Wizard: ["curiosity", "honesty"],
};

/** Two values read from the companion's own text (falling back to class), and what offends them. */
export function inferValues(text: string, className: string): { likes: DeedTag[]; dislikes: DeedTag[] } {
  const found: DeedTag[] = [];
  for (const [tag, re] of VALUE_WORDS) if (re.test(text) && !found.includes(tag)) found.push(tag);
  for (const t of CLASS_VALUES[className] ?? CLASS_VALUES.Fighter) if (found.length < 2 && !found.includes(t)) found.push(t);
  const likes = found.slice(0, 2);
  const dislikes = Array.from(new Set(likes.flatMap((l) => OPPOSITES[l] ?? []))).filter((d) => !likes.includes(d));
  // Everyone minds being betrayed or lied to a little; give a value-less companion one dislike.
  if (!dislikes.length) dislikes.push(likes.includes("cunning") ? "betrayal" : "cruelty");
  return { likes, dislikes };
}

// ── Approval ─────────────────────────────────────────────────────────────────

/** Approval points per companion, kept on storyState.companionBonds. */
export interface Bond {
  points: number;
  /** Scene index of their last moment (spreads the spotlight). */
  lastMoment?: number;
  /** A reaction waiting to be voiced next scene. */
  pending?: { kind: "approve" | "disapprove"; why: string } | null;
  /** Thresholds already crossed. */
  threadOpened?: boolean;
  warned?: number;
  left?: boolean;
}

export const START_POINTS = 3;
export const POINTS_MIN = -10;
export const POINTS_MAX = 10;

/** Points to the ledger's -3..+3 attitude (5e hostile / indifferent / friendly with nuance). */
export { attitudeFromPoints } from "@shared/companionMood";

export function parseBonds(raw: unknown): Record<string, Bond> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Bond> = {};
  for (const [name, b] of Object.entries(raw as Record<string, any>)) {
    if (!b || typeof b !== "object") continue;
    const points = Number(b.points);
    out[name] = {
      points: Number.isFinite(points) ? Math.max(POINTS_MIN, Math.min(POINTS_MAX, points)) : START_POINTS,
      lastMoment: typeof b.lastMoment === "number" ? b.lastMoment : undefined,
      pending: b.pending && (b.pending.kind === "approve" || b.pending.kind === "disapprove") ? { kind: b.pending.kind, why: String(b.pending.why ?? "") } : null,
      threadOpened: !!b.threadOpened,
      warned: typeof b.warned === "number" ? b.warned : 0,
      left: !!b.left,
    };
  }
  return out;
}

export interface BondEvent {
  name: string;
  delta: number;
  note: string;
  /** "thread" when approval opens their personal thread, "warning" near the bottom, "leaves" at it. */
  milestone?: "thread" | "warning" | "leaves";
}

const DEED_WORDS: Record<DeedTag, string> = {
  mercy: "showed mercy", cruelty: "were cruel", cunning: "outwitted them", bravery: "were brave", greed: "chose the money",
  loyalty: "stood by someone", betrayal: "broke faith with someone", generosity: "were generous", honesty: "told the truth",
  deceit: "lied", piety: "honoured the gods", curiosity: "went looking for answers",
};

/** Apply this turn's deed to every companion's approval. Returns the new bonds and what changed. */
export function applyDeed(
  bondsIn: Record<string, Bond>,
  companions: CompanionView[],
  deed: { tag: DeedTag; summary: string } | null,
): { bonds: Record<string, Bond>; events: BondEvent[] } {
  const bonds: Record<string, Bond> = {};
  for (const c of companions) bonds[c.name] = { ...(bondsIn[c.name] ?? { points: START_POINTS }) };
  for (const [k, v] of Object.entries(bondsIn)) if (!bonds[k]) bonds[k] = v;
  const events: BondEvent[] = [];
  if (!deed) return { bonds, events };
  for (const c of companions) {
    const b = bonds[c.name];
    if (b.left) continue;
    const delta = c.likes.includes(deed.tag) ? 2 : c.dislikes.includes(deed.tag) ? -2 : 0;
    if (!delta) continue;
    const before = b.points;
    b.points = Math.max(POINTS_MIN, Math.min(POINTS_MAX, b.points + delta));
    const why = `you ${DEED_WORDS[deed.tag]}`;
    b.pending = { kind: delta > 0 ? "approve" : "disapprove", why };
    const ev: BondEvent = { name: c.name, delta, note: `${c.name} ${delta > 0 ? "approves" : "disapproves"}: ${why}.` };
    if (delta > 0 && before < 5 && b.points >= 5 && !b.threadOpened) {
      b.threadOpened = true;
      ev.milestone = "thread";
      ev.note += ` ${c.name} trusts you enough to ask for help with something personal.`;
    } else if (delta < 0 && b.points <= -10 && (b.warned ?? 0) >= 2) {
      b.left = true;
      ev.milestone = "leaves";
      ev.note += ` ${c.name} has had enough and leaves the party.`;
    } else if (delta < 0 && ((before > -5 && b.points <= -5) || (before > -8 && b.points <= -8))) {
      b.warned = (b.warned ?? 0) + 1;
      ev.milestone = "warning";
      ev.note += ` ${c.name} is losing faith in you${b.warned >= 2 ? " and says so plainly: one more and they're gone" : ""}.`;
    }
    events.push(ev);
  }
  return { bonds, events };
}

// ── The companion moment ─────────────────────────────────────────────────────

export type MomentKind = "react" | "warn" | "notice" | "aside" | "camp" | "banter" | "spotlight";

export interface Moment {
  name: string;
  kind: MomentKind;
  line: string;
}

export function companionCheckCharacter(c: CompanionView): CheckCharacter {
  return { level: c.level, class: c.className, skills: c.skills, features: [], ...c.abilities };
}

/**
 * Decide this scene's companion moment, in code. `beat` is the director's
 * beat for the scene. Reactions waiting from last scene always surface;
 * otherwise about two scenes in three get a moment, going to whoever has
 * been quiet longest.
 */
export function pickMoment(
  companions: CompanionView[],
  bonds: Record<string, Bond>,
  opts: { beat: string; sceneIndex: number; inCombat: boolean; rng: () => number },
): Moment | null {
  // A companion played by a friend speaks for themselves: the game doesn't give them moments.
  const present = companions.filter((c) => !bonds[c.name]?.left && c.status !== "dead" && c.hp > 0 && !c.controlledBy);
  if (!present.length) return null;
  if (opts.inCombat || opts.beat === "combat" || opts.beat === "skirmish") return null;

  const reacting = present.find((c) => bonds[c.name]?.pending);
  if (reacting) {
    const p = bonds[reacting.name].pending!;
    return {
      name: reacting.name,
      kind: "react",
      line: p.kind === "approve"
        ? `${reacting.name} approves because ${p.why}. Show it in a line of their own voice: warmth, respect, a joke, a hand on the shoulder.`
        : `${reacting.name} disapproves because ${p.why}. Show it in a line of their own voice: not a lecture, a real reaction (a cold look, a sharp remark, a quiet question). Don't resolve it for them.`,
    };
  }

  if (opts.beat === "companion") {
    const who = [...present].sort((a, b) => (bonds[a.name]?.lastMoment ?? -99) - (bonds[b.name]?.lastMoment ?? -99))[0];
    return {
      name: who.name,
      kind: "spotlight",
      line: `This scene is about ${who.name}. Something from their past or their goal (${who.motivation || "what they want"}) comes up here, and the player's choice matters to them. Offer at least one choice that helps them and one that costs them.`,
    };
  }

  if (opts.rng() > 0.67) return null;
  const quietest = [...present].sort((a, b) => (bonds[a.name]?.lastMoment ?? -99) - (bonds[b.name]?.lastMoment ?? -99) || (opts.rng() - 0.5));
  const c = quietest[0];
  const p = passiveScores(companionCheckCharacter(c));
  let kind: MomentKind;
  let line: string;
  switch (opts.beat) {
    case "hazard":
    case "pressure":
    case "momentum":
      kind = "warn";
      line = `${c.name} spots the danger or the cost first and warns the player, in their own voice, with what they'd do about it.`;
      break;
    case "discovery":
    case "open_question":
      kind = "notice";
      line = `${c.name} has a passive Perception of ${p.perception} and Investigation of ${p.investigation}: if something here has a DC at or below that and the player character missed it, ${c.name} notices it and points it out (one line, in their voice). Otherwise they share what their skills (${c.skills.slice(0, 2).join(", ").replace(/_/g, " ")}) tell them.`;
      break;
    case "conversation":
      kind = "aside";
      line = `${c.name} (passive Insight ${p.insight}) gives the player a quiet aside about the person they're talking to: what they think that person wants, or whether they're lying.`;
      break;
    case "quiet":
      kind = "camp";
      line = `${c.name} talks with the player during the quiet moment: about ${c.motivation ? `what they want (${c.motivation})` : "their past"}, or asks the player something personal. Give the player a way to answer in the choices.`;
      break;
    default:
      kind = "banter";
      line = `${c.name} reacts to what's happening with a line that shows their personality (${c.personality.slice(0, 80) || c.className}).`;
  }
  return { name: c.name, kind, line };
}

const moodWord = (points: number) => {
  const a = attitudeFromPoints(points);
  return a >= 3 ? "devoted" : a === 2 ? "trusting" : a === 1 ? "friendly" : a === 0 ? "indifferent" : a === -1 ? "wary" : a === -2 ? "unfriendly" : "hostile";
};

/** Everyone in the party, for every story prompt. */
export function partyPromptBlock(companions: CompanionView[], bonds: Record<string, Bond>, moment: Moment | null): string {
  const present = companions.filter((c) => !bonds[c.name]?.left);
  if (!present.length) return "";
  const lines = present.map((c) => {
    const b = bonds[c.name] ?? { points: START_POINTS };
    const hurt = c.maxHp > 0 && c.hp < c.maxHp ? `, ${c.hp}/${c.maxHp} HP` : "";
    const down = c.hp <= 0 || c.status === "unconscious" ? ", UNCONSCIOUS" : "";
    const playedBy = c.controlledBy ? ` (played by ${c.controllerName ?? "a friend"})` : "";
    return `- ${c.name}${playedBy}: ${c.race} ${c.className} ${c.level}${hurt}${down}. ${c.personality ? `Personality: ${c.personality.slice(0, 140)}.` : ""} ${c.motivation ? `Wants: ${c.motivation.slice(0, 100)}.` : ""} ${c.voice ? `Voice: ${c.voice.slice(0, 100)}.` : ""} Values ${c.likes.join(" and ")}; dislikes ${c.dislikes.join(" and ")}. Feels ${moodWord(b.points)} toward the player. Skills: ${c.skills.join(", ").replace(/_/g, " ")}.`.replace(/\s+/g, " ").trim();
  });
  const parts = [
    `TRAVELLING WITH THE PLAYER (companions are people in the scene, not scenery; they stay present every scene even when quiet):\n${lines.join("\n")}`,
    moment ? `COMPANION MOMENT (the game chose this; write it into the scene): ${moment.line} Give ${moment.name} one or two lines of real dialogue in their own voice.` : "",
    `COMPANION CHOICES: when a companion's skill fits, you may offer ONE choice where they do it, e.g. "Ask ${present[0].name} to ...": give it "actor": "<companion name>" and the skill in "skillType"; the game rolls it with the companion's own modifier.`,
  ];
  return parts.filter(Boolean).join("\n");
}

/** The same information, short, for the streamed narrator (prose only). */
export function partyStreamLine(companions: CompanionView[], bonds: Record<string, Bond>, moment: Moment | null): string {
  const present = companions.filter((c) => !bonds[c.name]?.left);
  if (!present.length) return "";
  const who = present.map((c) => `${c.name} (${c.race} ${c.className}; ${c.personality.slice(0, 60) || "companion"}; feels ${moodWord((bonds[c.name] ?? { points: START_POINTS }).points)})`).join("; ");
  return `COMPANIONS PRESENT: ${who}. They are in the scene; mention them naturally.${moment ? ` COMPANION MOMENT: ${moment.line} Give ${moment.name} one or two lines of dialogue.` : ""}`;
}

/** A short in-character line for a fast combat round (no model call). */
export function combatBark(companions: CompanionView[], bonds: Record<string, Bond>, rollResult: any, seed: number): string {
  const up = companions.filter((c) => !bonds[c.name]?.left && c.hp > 0 && c.status !== "unconscious" && c.status !== "dead");
  if (!up.length) return "";
  const c = up[Math.abs(seed) % up.length];
  const brave = c.likes.includes("bravery");
  const kind = c.likes.includes("mercy") || c.likes.includes("piety");
  const sly = c.likes.includes("cunning") || c.likes.includes("greed");
  const hit = !!rollResult?.hit;
  const lines = hit
    ? brave ? ["Ha! Again!", "That's how it's done!", "Keep pushing!"]
      : sly ? ["Nice. Now finish it.", "Told you they'd drop their guard.", "Clean work."]
      : kind ? ["Well struck. Stay close!", "Good! Watch your left!", "That's it, careful now."]
      : ["Good hit!", "That got them!", "Keep at it!"]
    : brave ? ["Shake it off and go again!", "They're not so tough!", "I'm with you!"]
      : sly ? ["Don't stand there, move!", "They saw that coming. Try the flank.", "Patience."]
      : kind ? ["Careful! I've got you.", "Steady. Breathe.", "Don't let them corner you!"]
      : ["Close! Again!", "Watch out!", "I'm right behind you!"];
  return `${c.name}: "${lines[Math.abs(seed >> 3) % lines.length]}"`;
}

/**
 * Companions in the ledger cast, with attitude from their approval, so the
 * Journal's People list shows how each one feels. A personal thread opens
 * when approval first reaches Trusting.
 */
export function syncCompanionsToLedger(ledger: Ledger, companions: CompanionView[], bonds: Record<string, Bond>, events: BondEvent[]): Ledger {
  const next: Ledger = { ...ledger, cast: [...ledger.cast], threads: [...ledger.threads] };
  for (const c of companions) {
    const b = bonds[c.name];
    if (!b) continue;
    const attitude = attitudeFromPoints(b.points);
    const i = next.cast.findIndex((m) => m.name.toLowerCase() === c.name.toLowerCase());
    if (i >= 0) {
      next.cast[i] = { ...next.cast[i], role: next.cast[i].role || "companion", attitude, status: b.left ? "missing" : next.cast[i].status, lastSeenTurn: next.turn };
    } else {
      next.cast.push({
        id: `companion-${c.campaignNpcId}`, name: c.name, role: "companion", want: c.motivation.slice(0, 120), attitude,
        firstSeenTurn: next.turn, lastSeenTurn: next.turn, location: null, status: b.left ? "missing" : "alive",
        secrets: [], promisesMade: [], timesMet: 1,
      });
    }
  }
  for (const e of events) {
    if (e.milestone !== "thread") continue;
    const c = companions.find((x) => x.name === e.name);
    const summary = `Help ${e.name}${c?.motivation ? `: ${c.motivation.slice(0, 90)}` : " with something personal"}`;
    if (!next.threads.some((t) => t.summary === summary)) {
      next.threads.push({ id: `companion-thread-${c?.campaignNpcId ?? e.name}`, summary, openedTurn: next.turn, status: "open", heat: 2 });
    }
  }
  return next;
}

