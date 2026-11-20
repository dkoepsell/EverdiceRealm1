/**
 * Combinatorial Wander rooms (engagement spec 6.4): feature × occupant ×
 * twist tables per biome (12 × 12 × 10 = 1,440 combinations), so regular
 * players stop seeing the same handful of outcomes. The hand-written curated
 * outcomes stay as rarer "landmark" results.
 */
import type { CuratedOutcome } from "../../wanderEngine";

type Rng = () => number;
const pick = <T>(rng: Rng, a: T[]) => a[Math.floor(rng() * a.length)];

const FEATURES: Record<string, string[]> = {
  forest: ["a lightning-split oak", "a ring of pale mushrooms", "a hunter's abandoned blind", "a moss-choked shrine", "a stream crossing on fallen logs", "a hollow full of old arrows", "a woodcutter's half-built cabin", "a tree carved with warnings", "a deer trail worn deep", "a sinkhole ringed with roots", "a cairn of river stones", "a clearing of burned stumps"],
  default: ["a collapsed watchtower", "a dry well with a rope still tied", "a wayside shrine", "a broken cart on its side", "an old boundary stone", "a ring of standing stones", "a cave mouth breathing cold air", "an overgrown battlefield", "a lone shepherd's hut", "a bridge missing planks", "a camp still warm", "a statue with its face chiselled off"],
};
const OCCUPANTS = ["a wounded scout who won't give their name", "a family of goblins arguing over a map", "a lost child clutching a carved token", "two travelling merchants who don't trust each other", "a hermit who claims to know you", "a pack of wolves watching from cover", "a bandit lookout half asleep", "a priest burying someone alone", "a talking raven with a debt to collect", "nobody, but fresh footprints lead away", "a knight whose horse has gone lame", "a mapmaker measuring the wrong hill"];
const TWISTS = ["it's a trap someone set for someone else", "they're being followed", "the place is sacred to someone nearby", "there's a reward posted for what's here", "it's not what it was a week ago", "a storm is about to hit", "someone you met before left a sign here", "the ground here is unstable", "an old promise is tied to this place", "what's valuable here is also dangerous"];

export const ROOM_COMBINATIONS = 12 * 12 * 10;

export function generateRoom(biome: string, rng: Rng = Math.random): CuratedOutcome & { contentId: string } {
  const feats = FEATURES[biome] ?? FEATURES.default;
  const fi = Math.floor(rng() * feats.length);
  const oi = Math.floor(rng() * OCCUPANTS.length);
  const ti = Math.floor(rng() * TWISTS.length);
  const feature = feats[fi];
  const occupant = OCCUPANTS[oi];
  const twist = TWISTS[ti];
  const risky = /wolves|bandit|trap|unstable|dangerous|storm|followed/.test(`${occupant} ${twist}`);
  return {
    contentId: `room:${biome}:${fi}:${oi}:${ti}`,
    type: risky ? "risk" : "discovery",
    title: feature.charAt(0).toUpperCase() + feature.slice(1),
    reveal: `You come upon ${feature}. Here: ${occupant}. Look closer and it's clear ${twist}.`,
    choices: [
      { id: "look", label: "Investigate carefully", intentTag: "investigate" },
      { id: "talk", label: occupant.startsWith("nobody") ? "Follow the footprints" : "Approach and talk", intentTag: "engage" },
      { id: "leave", label: "Move on quietly", intentTag: "avoid" },
    ],
  } as CuratedOutcome & { contentId: string };
}
