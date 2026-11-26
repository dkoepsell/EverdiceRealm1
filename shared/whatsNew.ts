/**
 * "What's new in Everdice": one release's worth of cards, shown once to
 * returning players (as a modal) and always at /whats-new. Bump RELEASE_ID
 * when the cards change so returning players see it again; seen releases are
 * remembered in users.onboardingState.seenTips as `whatsnew:<id>`.
 */
export const RELEASE_ID = "2026-12-table-night";
export const RELEASE_TITLE = "Have you played Everdice lately?";
export const seenTipId = (id = RELEASE_ID) => `whatsnew:${id}`;

export interface WhatsNewCard {
  id: string;
  title: string;
  /** What changed, in a sentence or two. */
  body: string;
  /** A fun way to try it. */
  tryIt: string;
  href: string;
  cta: string;
  icon: "swords" | "skull" | "zap" | "users" | "compass" | "scroll" | "dice" | "handshake";
}

export const WHATS_NEW: WhatsNewCard[] = [
  {
    id: "danger",
    title: "More danger, and you set the dial",
    body: "Stories now push back. Ambushes, traps, rivals and hard choices arrive on a rhythm, so a quiet stretch of talking ends in trouble. Pick Story, Balanced or Action for each campaign.",
    tryIt: "Set a campaign to Action and see how long you last.",
    href: "/campaigns", cta: "Open a campaign", icon: "swords",
  },
  {
    id: "monsters",
    title: "Smarter monsters, real battlefields",
    body: "Monsters fight the way the rules say they should: wolves flank, goblins hide and shoot, brutes go for whoever hit them. Fights happen somewhere, with cover, high ground and hazards you can use.",
    tryIt: "Look for the barrel, the ledge or the chandelier before you swing.",
    href: "/campaigns", cta: "Find a fight", icon: "skull",
  },
  {
    id: "fast-rounds",
    title: "Instant combat rounds",
    body: "When a fight is a formality, resolve the whole round in one tap with real rolls for everyone. When it matters, play it blow by blow.",
    tryIt: "Use it to clear the rats, then slow down for the boss.",
    href: "/campaigns", cta: "Play", icon: "zap",
  },
  {
    id: "companions",
    title: "Companions with something to say",
    body: "Your companions have moods and values. They approve, object, warn you, joke at camp, roll their own skills, and get scenes of their own. Push one too far and they may walk.",
    tryIt: "Tap Talk on a companion and ask what they really think of you.",
    href: "/campaigns", cta: "Meet your party", icon: "users",
  },
  {
    id: "alignment",
    title: "Alignment as a compass",
    body: "The world notices who you are. Temples, guilds and orders react to your alignment, but it never stops you doing anything. Your Journal shows what your deeds say, and you decide whether to change.",
    tryIt: "Play against type for a few scenes, then check the People tab in your Journal.",
    href: "/campaigns", cta: "Check your compass", icon: "compass",
  },
  {
    id: "backgrounds",
    title: "Your background opens doors",
    body: "Backgrounds now come with their D&D features. An acolyte finds shelter at temples, a criminal has a contact, a sage knows where to look. When the scene fits, you get a choice that just works, no roll.",
    tryIt: "Walk an Acolyte into a temple, or a Criminal into a city's back streets.",
    href: "/characters", cta: "See your characters", icon: "scroll",
  },
  {
    id: "one-shots",
    title: "One-shot nights with friends",
    body: "Send an invite link and friends can join in a minute with a ready-made level 3 hero. No account needed to start; they can save their character afterward.",
    tryIt: "Pick a night, hit Invite friends on your campaign, and drop the link in your group chat.",
    href: "/campaigns", cta: "Invite friends", icon: "dice",
  },
  {
    id: "friend-companions",
    title: "Friends can play your companions",
    body: "Hand a companion to a friend at the table. They say what the companion does, choose targets in a fight, or Dodge, and the story follows their lead.",
    tryIt: "Give your cleric to the friend who always wants to help, and see what happens.",
    href: "/campaigns", cta: "Set up your table", icon: "handshake",
  },
];

/** Who should see the modal: signed-in, not a guest, not brand new (they get the welcome flow), and not seen this release. */
export function shouldShowWhatsNew(
  user: { createdAt?: string | null; onboardingState?: unknown } | null | undefined,
  now = Date.now(),
): boolean {
  if (!user) return false;
  const state = (user.onboardingState && typeof user.onboardingState === "object" ? user.onboardingState : {}) as Record<string, any>;
  if (state.guest) return false;
  if (Array.isArray(state.seenTips) && state.seenTips.includes(seenTipId())) return false;
  const created = user.createdAt ? Date.parse(user.createdAt) : NaN;
  if (Number.isFinite(created) && now - created < 2 * 24 * 3600_000) return false;
  return true;
}
