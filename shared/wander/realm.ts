/**
 * The shared realm (engagement 2): every player wanders the same Wander map,
 * so signs left by one adventurer can be read by the next, the way West
 * Marches tables share a world. Players can only leave signs from this fixed
 * list (no free text to moderate), and only a character's name is shown.
 */
export const REALM_PHRASES = [
  "Danger ahead",
  "Water here",
  "Good place to camp",
  "Turn back",
  "Try stealth",
  "Beware of ambush",
  "Something worth finding nearby",
  "The trail goes on",
  "Rest before you go on",
  "Bring a light",
  "Watch the weather",
  "Well met, traveller",
] as const;

export type RealmMarkKind = "sign" | "fallen" | "cleared";

export interface RealmMark {
  id: number;
  q: number;
  r: number;
  kind: RealmMarkKind;
  text: string;
  characterName: string;
  createdAt: string;
  nods: number;
  /** The viewer already nodded. */
  nodded?: boolean;
  /** The viewer left it. */
  mine?: boolean;
}

export const REALM_GLYPH: Record<RealmMarkKind, string> = { sign: "🪧", fallen: "🪦", cleared: "🏁" };

/** Marks shown per hex, newest and most-nodded first. */
export const MARKS_PER_HEX = 3;
