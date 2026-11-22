/**
 * People who come back (wander-threads-spec.md, Feature E).
 *
 * A small cast of road regulars. Each meeting is written to the Campaign
 * Ledger, so the next meeting knows whether you helped them, and the campaign
 * DM can bring them in too. Pure: the route loads and saves the ledger.
 */
import type { Ledger } from "@shared/ledger";
import { sameName } from "../ledger/merge";

export interface RecurringRole {
  id: string;
  name: string;
  role: string;
  want: string;
  /** First meeting. */
  meet: { title: string; reveal: string };
  /** Later meetings; {mood} is filled from their attitude. */
  again: { title: string; reveal: string };
  help: { label: string; skill: string; dc: number; success: string; failure: string };
  /** What they give when they like you. */
  gift: { food?: number; water?: number; reward?: { kind: "knowledge" | "consumable" | "trinket"; name: string; quantity: number }; text: string };
  /** Sergeant Dace hands out a road rumor when friendly. */
  givesRumor?: boolean;
}

export const RECURRING: RecurringRole[] = [
  {
    id: "tamsin",
    name: "Tamsin",
    role: "travelling peddler",
    want: "to get her cart to the next market in one piece",
    meet: { title: "A Peddler's Cart, Stuck", reveal: "A painted cart sits axle-deep in a rut. A sharp-eyed woman in a feathered hat is shoving at the back wheel and swearing creatively. 'Don't just stand there,' she says." },
    again: { title: "Tamsin's Cart", reveal: "A familiar painted cart creaks toward you. Tamsin tips her feathered hat. {mood}" },
    help: { label: "Put your shoulder to the wheel", skill: "athletics", dc: 12, success: "With a heave the cart rolls free. Tamsin grins and digs into her stock for you.", failure: "You push, you slip, you end up in the mud. Tamsin sighs and waits for a passing ox." },
    gift: { food: 3, text: "Tamsin presses three days of hard bread and cheese on you. 'Pay me back by buying something next time.'" },
  },
  {
    id: "orrin",
    name: "Orrin Vale",
    role: "rival adventurer",
    want: "to be the first to find anything worth finding",
    meet: { title: "Another Adventurer", reveal: "A lanky man with a long bow and a longer grin is crouched over some tracks. 'Bet you a silver you can't tell me what made these,' says Orrin Vale." },
    again: { title: "Orrin Vale Again", reveal: "Orrin Vale strolls out of the brush, bow on his shoulder. {mood}" },
    help: { label: "Read the tracks and take his bet", skill: "nature", dc: 13, success: "'Owlbear, a young one, limping.' Orrin's grin slips, then returns. 'Fine. You've earned a tip,' and he tells you what he's seen out here.", failure: "You guess badly. Orrin pockets your pride, if not your silver, and strolls off whistling." },
    gift: { reward: { kind: "knowledge", name: "Orrin's Trail Notes", quantity: 1 }, text: "Orrin shares his trail notes: where the water is, where the trouble is." },
  },
  {
    id: "brannoc",
    name: "Old Brannoc",
    role: "hermit of the high slopes",
    want: "to be left alone, mostly",
    meet: { title: "A Hermit and His Goat", reveal: "An old man in a patched robe is coaxing a goat along the path. The goat is limping. 'Don't look at me like that,' he tells it. 'Or you,' he tells you." },
    again: { title: "Old Brannoc", reveal: "Old Brannoc and his goat are coming down the path. {mood}" },
    help: { label: "Look at the goat's hoof", skill: "medicine", dc: 12, success: "A stone wedged in the hoof. You work it free. Brannoc grunts, which seems to be his way of saying thank you, and fills your waterskin from his flask-spring.", failure: "The goat headbutts you. Brannoc cackles and leads it away." },
    gift: { water: 2, text: "Brannoc fills your waterskins from a spring only he knows." },
  },
  {
    id: "dace",
    name: "Sergeant Dace",
    role: "road warden sergeant",
    want: "a quiet patrol and no paperwork",
    meet: { title: "A Road Warden Patrol", reveal: "Three riders in faded green. Their sergeant, a broad woman with a notched ear, raises a hand. 'Sergeant Dace, road wardens. State your business.'" },
    again: { title: "Sergeant Dace's Patrol", reveal: "The road warden patrol again, and Sergeant Dace at its head. {mood}" },
    help: { label: "Explain yourself honestly and ask what's happening on the roads", skill: "persuasion", dc: 10, success: "Dace relaxes. 'Since you ask,' she says, and tells you what the wardens have heard.", failure: "Dace doesn't like your answers. 'Move along,' she says, and watches until you do." },
    gift: { text: "Dace passes on a report the wardens haven't had time to check." },
    givesRumor: true,
  },
];

export const RECURRING_CHANCE = 0.06;

export function pickRecurring(rng: () => number = Math.random): RecurringRole {
  return RECURRING[Math.floor(rng() * RECURRING.length)];
}

export function getRecurring(id: string): RecurringRole | undefined {
  return RECURRING.find((r) => r.id === id);
}

export function castEntry(ledger: Ledger, role: RecurringRole) {
  return ledger.cast.find((c) => sameName(c.name, role.name)) ?? null;
}

function moodLine(attitude: number, timesMet: number): string {
  if (attitude >= 2) return "Their face lights up when they see you.";
  if (attitude >= 1) return "They seem glad to see you.";
  if (attitude <= -2) return "Their expression hardens. They haven't forgotten.";
  if (attitude <= -1) return "They give you a cool nod.";
  return timesMet > 1 ? "They recognise you." : "They look you over.";
}

/** The outcome card for a meeting. */
export function recurringOutcome(role: RecurringRole, ledger: Ledger) {
  const member = castEntry(ledger, role);
  const met = !!member;
  const attitude = member?.attitude ?? 0;
  const friendly = attitude >= 1;
  const text = met ? role.again : role.meet;
  const choices: Array<{ id: string; label: string; intentTag: "investigate" | "avoid" | "engage" | "retreat"; check?: { skill: string; dc: number } }> = [];
  if (friendly) {
    choices.push({ id: "visit", label: `Stop and talk with ${role.name}`, intentTag: "engage" });
  } else {
    choices.push({ id: "help", label: role.help.label, intentTag: "investigate", check: { skill: role.help.skill, dc: role.help.dc } });
  }
  choices.push({ id: "pass", label: "Nod and keep walking", intentTag: "avoid" });
  return {
    type: "discovery" as const,
    title: text.title,
    reveal: text.reveal.replace("{mood}", moodLine(attitude, member?.timesMet ?? 0)),
    markerType: "npc_echo",
    recurring: { roleId: role.id, name: role.name, metBefore: met, attitude },
    contentId: `recurring:${role.id}`,
    choices,
  };
}
