/**
 * Background features: the non-combat perk each 5e background gives (Player's
 * Handbook, 2014; the Acolyte's is in the SRD 5.1). The descriptions here are
 * our own short summaries of what each perk lets a character do at the table.
 * A feature simply works when it applies: no roll, that's the point of it.
 *
 * The narrator is reminded of the feature every scene, and when the place
 * fits (a temple for an Acolyte, the docks for a Sailor) it offers one choice
 * that uses it.
 */

export interface BackgroundFeature {
  background: string;
  feature: string;
  /** What it lets the character do, in a sentence. */
  summary: string;
  /** Places and situations where it comes up. */
  fits: RegExp;
  /** What the narrator should offer when it fits. */
  offer: string;
}

const B = (background: string, feature: string, summary: string, fits: RegExp, offer: string): BackgroundFeature => ({ background, feature, summary, fits, offer });

export const BACKGROUND_FEATURES: BackgroundFeature[] = [
  B("Acolyte", "Shelter of the Faithful",
    "Temples of your faith give you and your companions free healing and care, and the priests there will help you, within reason.",
    /\b(temple|shrine|chapel|church|monastery|abbey|cathedral|priest|clergy)\b/i,
    "the temple's priests take the party in: rest, healing, or a quiet word about what they know"),
  B("Charlatan", "False Identity",
    "You have a second, well-established identity, with papers, acquaintances and a disguise to match.",
    /\b(town|city|court|guard|checkpoint|noble|merchant|inn|guild|official)\b/i,
    "slip into the false identity to get past someone or get a meeting"),
  B("Criminal", "Criminal Contact",
    "You have a reliable contact in the criminal underworld who passes messages and knows who to ask.",
    /\b(city|town|alley|docks?|harbou?r|market|tavern|slum|underworld|smuggl\w*|thieves)\b/i,
    "get word to their underworld contact for information, a fence, or a way in"),
  B("Entertainer", "By Popular Demand",
    "You can always find a place to perform, which gets you free lodging and food and makes you a local name.",
    /\b(tavern|inn|festival|fair|market|square|court|hall|feast)\b/i,
    "perform for the room: free lodging, a crowd on their side, and loose tongues afterwards"),
  B("Folk Hero", "Rustic Hospitality",
    "Common folk see you as one of their own: they'll hide you, feed you and shelter you, as long as it doesn't put them in danger.",
    /\b(village|farm|hamlet|peasant|cottage|mill|field|commoners?|folk)\b/i,
    "ask the common folk for shelter, a hiding place, or what they've seen"),
  B("Guild Artisan", "Guild Membership",
    "Your guild gives you lodging if you need it, introductions, and access to its members and their trade.",
    /\b(guild|market|workshop|forge|merchant|city|town|trade|craft\w*)\b/i,
    "call on their guild for lodging, an introduction, or a craftsman who knows something"),
  B("Hermit", "Discovery",
    "Your years of seclusion gave you a unique insight into some great truth that bears on the world.",
    /\b(ruin\w*|ancient|ritual|temple|shrine|mystery|prophecy|cosmic|secret|forbidden)\b/i,
    "recall the truth they learned in seclusion and how it bears on this"),
  B("Noble", "Position of Privilege",
    "People assume you belong: high society welcomes you, and common folk try to accommodate you.",
    /\b(court|castle|manor|palace|noble\w*|lord|lady|duke|baron|estate|gala|banquet)\b/i,
    "use their name and bearing to be received, believed or obeyed"),
  B("Outlander", "Wanderer",
    "You never get lost in the wild, and you can find food and fresh water for yourself and a few companions each day.",
    /\b(forest|wood|woods|hill|mountain|wild\w*|plain|desert|tundra|river|trail|camp|marsh|swamp)\b/i,
    "lead the way through the wild: no getting lost, and food and water found"),
  B("Sage", "Researcher",
    "When you don't know something, you usually know where and from whom to find it out.",
    /\b(library|archive|academy|college|tower|scholar|book|tome|scroll|ruin\w*|inscription|lore)\b/i,
    "know exactly where, or from whom, the answer can be found"),
  B("Sailor", "Ship's Passage",
    "You can get free passage on a sailing ship for yourself and your companions, in exchange for help with the crew's work.",
    /\b(coast|sea|harbou?r|port|docks?|pier|ship|boat|river|lake|shore)\b/i,
    "secure the party passage on a ship in exchange for work"),
  B("Soldier", "Military Rank",
    "Soldiers loyal to your old army still recognise your rank: you can get into encampments and fortresses and requisition simple gear.",
    /\b(garrison|fort|fortress|barracks|army|soldier|guard\w*|watch|patrol|camp|captain|militia)\b/i,
    "pull rank with the soldiers here: access, simple equipment, or a straight answer"),
  B("Urchin", "City Secrets",
    "You know the hidden ways through a city, and can move through it at twice the normal pace.",
    /\b(city|town|alley\w*|street|rooftop|sewer|slum|market|district)\b/i,
    "take the city's hidden ways: get somewhere fast, or unseen"),
];

export function backgroundFeatureFor(background: unknown): BackgroundFeature | null {
  if (typeof background !== "string" || !background.trim()) return null;
  const b = background.trim().toLowerCase();
  return BACKGROUND_FEATURES.find((f) => b.includes(f.background.toLowerCase())) ?? null;
}

/** The prompt line for this scene: always a reminder; an offer when the place fits. */
export function backgroundPromptLine(background: unknown, sceneText: string | null | undefined): string {
  const f = backgroundFeatureFor(background);
  if (!f) return "";
  const fits = f.fits.test(String(sceneText ?? ""));
  return `BACKGROUND FEATURE (${f.background}: ${f.feature}): ${f.summary}${
    fits
      ? ` It fits this scene: offer ONE choice that uses it (${f.offer}). It simply works, NO roll: give that choice "backgroundFeature": "${f.feature}" and "requiresDiceRoll": false.`
      : " Offer a choice that uses it only when the scene really calls for it; it simply works, no roll."
  }`;
}
