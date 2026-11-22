/**
 * Overland travel rules for Wander (wander-threads-spec.md, Feature B).
 *
 * Numbers follow the SRD 5.1 (2014) travel and survival rules, which is what
 * the rest of the engine (shared/rules) is built on:
 *   - travel pace: fast 4 mph / normal 3 / slow 2; fast pace is -5 to passive
 *     Perception, slow pace lets you travel stealthily
 *   - navigation (becoming lost): Survival DC 5 / 10 / 15 by terrain; fast pace
 *     -5, slow pace +5; you can't get lost following a coastline
 *   - foraging: Survival DC 10 / 15 / 20; 1d6 + Wisdom modifier pounds of food
 *     and gallons of water; not possible at a fast pace
 *   - forced march: past 8 hours a day, a Constitution save each extra hour,
 *     DC 10 + 1 per hour past 8; failure is a level of exhaustion
 *   - food and water: 1 lb food and 1 gallon water a day (2 in hot weather);
 *     3 + Con mod days without food, then exhaustion; half water means a DC 15
 *     Con save, less means automatic exhaustion (two levels if already tired)
 *   - lightly obscured (rain, fog) is disadvantage on sight-based Perception,
 *     which is -5 to a passive score
 *
 * One Wander hex is a 6-mile hex. Everything here is pure, so it can be tested
 * without a database (tests/wanderTravel.test.ts).
 */
import type { WanderBiome } from "./terrain";

export type Pace = "fast" | "normal" | "slow";
export type TravelActivity = "navigate" | "forage" | "scout";
export type Weather = "clear" | "overcast" | "rain" | "fog" | "storm";

export const HEX_MILES = 6;
export const PACE_MPH: Record<Pace, number> = { fast: 4, normal: 3, slow: 2 };
export const TRAVEL_DAY_HOURS = 8;
export const DAY_START_HOUR = 8;
export const EXHAUSTION_RUN_ENDS = 4;

export interface TravelState {
  v: 1;
  day: number;
  /** Clock hour, may exceed 24 during a forced march into the night. */
  hour: number;
  hoursToday: number;
  /** Pounds of food. */
  food: number;
  /** Gallons of water. */
  water: number;
  weather: Weather;
  hot: boolean;
  exhaustion: number;
  daysWithoutFood: number;
  pace: Pace;
  activity: TravelActivity;
  /** Last successful navigation: the terrain and the absolute hour. Cleared when you get lost. */
  oriented?: { dc: number; at: number } | null;
}

export const STARTING_FOOD = 5;
export const STARTING_WATER = 2;

export function initialTravelState(opts: { exhaustion?: number | null; biome: WanderBiome; rng?: () => number }): TravelState {
  const weather = rollWeather(opts.biome, opts.rng ?? Math.random);
  return {
    v: 1,
    day: 1,
    hour: DAY_START_HOUR,
    hoursToday: 0,
    food: STARTING_FOOD,
    water: STARTING_WATER,
    weather,
    hot: isHot(opts.biome, weather),
    exhaustion: Math.max(0, Math.min(6, opts.exhaustion ?? 0)),
    daysWithoutFood: 0,
    pace: "normal",
    activity: "navigate",
    oriented: null,
  };
}

/** Read a stored state defensively; anything malformed returns null. */
export function parseTravelState(raw: unknown): TravelState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<TravelState>;
  if (s.v !== 1 || typeof s.day !== "number" || typeof s.hour !== "number") return null;
  const pace: Pace = s.pace === "fast" || s.pace === "slow" ? s.pace : "normal";
  const activity: TravelActivity = s.activity === "forage" || s.activity === "scout" ? s.activity : "navigate";
  const weather: Weather = (["clear", "overcast", "rain", "fog", "storm"] as Weather[]).includes(s.weather as Weather) ? (s.weather as Weather) : "clear";
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    v: 1,
    day: num(s.day, 1),
    hour: num(s.hour, DAY_START_HOUR),
    hoursToday: num(s.hoursToday, 0),
    food: Math.max(0, num(s.food, 0)),
    water: Math.max(0, num(s.water, 0)),
    weather,
    hot: !!s.hot,
    exhaustion: Math.max(0, Math.min(6, num(s.exhaustion, 0))),
    daysWithoutFood: Math.max(0, num(s.daysWithoutFood, 0)),
    pace,
    activity,
    oriented: s.oriented && typeof s.oriented === "object" && typeof (s.oriented as any).dc === "number" && typeof (s.oriented as any).at === "number"
      ? { dc: (s.oriented as any).dc, at: (s.oriented as any).at }
      : null,
  };
}

// ── time ──────────────────────────────────────────────────────────────────────

/** Exhaustion 2+ halves speed (SRD), which we apply as double travel time. */
export function hoursPerHex(pace: Pace, exhaustion: number): number {
  const h = HEX_MILES / PACE_MPH[pace];
  return exhaustion >= 2 ? h * 2 : h;
}

export function isNight(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= 20 || h < 6;
}

export function timeOfDayLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 20) return "evening";
  return "night";
}

export function clockLabel(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m === 60 ? 0 : m).padStart(2, "0")}`;
}

/**
 * Forced-march saves owed for travelling from `before` to `after` hours today.
 * The SRD calls for a Constitution save at the end of each hour of travel
 * beyond 8, DC 10 + 1 for each hour past 8: so one save for every whole hour
 * mark past 8 that this leg crosses.
 */
export function forcedMarchSaves(before: number, after: number): number[] {
  const dcs: number[] = [];
  for (let h = Math.floor(before + 1e-9) + 1; h <= Math.floor(after + 1e-9); h++) {
    if (h > TRAVEL_DAY_HOURS) dcs.push(10 + (h - TRAVEL_DAY_HOURS));
  }
  return dcs;
}

/** Hours since the start of the trip (day 1, 00:00), for "how long since" questions. */
export function absoluteHour(s: Pick<TravelState, "day" | "hour">): number {
  return (s.day - 1) * 24 + s.hour;
}

export const NAV_RECHECK_HOURS = 4;

/**
 * Does the navigator need to roll before this leg? The DMG has the navigator
 * check when the situation calls for it, not every hour. Wander terrain
 * changes almost every hex, so "new terrain" would mean every move; instead
 * the navigator rolls on setting out, after getting lost, on heading into
 * country harder to navigate than where they last got their bearings, and
 * otherwise every 4 hours of travel.
 */
export function navigationCheckDue(s: TravelState, dc: number): boolean {
  const o = s.oriented;
  if (!o) return true;
  if (dc > o.dc) return true;
  return absoluteHour(s) - o.at >= NAV_RECHECK_HOURS;
}

// ── navigation and foraging ───────────────────────────────────────────────────

/**
 * Base Survival DC to avoid getting lost when leaving a hex. `null` means no
 * check: you can follow a coastline without getting lost.
 */
export function navigationBaseDC(biome: WanderBiome): number | null {
  switch (biome) {
    case "grass": return 5;
    case "desert": return 10;
    case "forest":
    case "swamp":
    case "mountain": return 15;
    case "coast": return null;
  }
}

export interface Situational { value: number; label: string }

/** Situational modifiers on the navigation roll itself (the DC stays the SRD number). */
export function navigationModifiers(pace: Pace, weather: Weather): Situational[] {
  const mods: Situational[] = [];
  if (pace === "fast") mods.push({ value: -5, label: "fast pace" });
  if (pace === "slow") mods.push({ value: 5, label: "slow pace" });
  if (isObscured(weather)) mods.push({ value: -5, label: weather });
  return mods;
}

export type ForageAbundance = "abundant" | "limited" | "very little";

export function forageAbundance(biome: WanderBiome): ForageAbundance {
  if (biome === "desert") return "very little";
  if (biome === "mountain") return "limited";
  return "abundant";
}

export function forageDC(biome: WanderBiome, weather: Weather): number {
  const base = { abundant: 10, limited: 15, "very little": 20 }[forageAbundance(biome)];
  return weather === "storm" ? base + 5 : base;
}

/** 1d6 + Wisdom modifier, minimum 0. */
export function forageYield(wisMod: number, d6: number): number {
  return Math.max(0, d6 + wisMod);
}

// ── weather and perception ────────────────────────────────────────────────────

const WEATHER_TABLE: Record<WanderBiome, Array<[Weather, number]>> = {
  grass:    [["clear", 50], ["overcast", 25], ["rain", 15], ["fog", 5], ["storm", 5]],
  forest:   [["clear", 40], ["overcast", 25], ["rain", 20], ["fog", 10], ["storm", 5]],
  swamp:    [["clear", 20], ["overcast", 25], ["rain", 25], ["fog", 25], ["storm", 5]],
  mountain: [["clear", 40], ["overcast", 20], ["rain", 10], ["fog", 15], ["storm", 15]],
  desert:   [["clear", 70], ["overcast", 10], ["rain", 3], ["fog", 2], ["storm", 15]],
  coast:    [["clear", 40], ["overcast", 25], ["rain", 15], ["fog", 15], ["storm", 5]],
};

export function rollWeather(biome: WanderBiome, rng: () => number = Math.random): Weather {
  const table = WEATHER_TABLE[biome] ?? WEATHER_TABLE.grass;
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [w, weight] of table) {
    roll -= weight;
    if (roll < 0) return w;
  }
  return "clear";
}

export function isHot(biome: WanderBiome, weather: Weather): boolean {
  return biome === "desert" && weather !== "storm" && weather !== "rain";
}

/** Rain, fog and storms make the area lightly obscured. */
export function isObscured(weather: Weather): boolean {
  return weather === "rain" || weather === "fog" || weather === "storm";
}

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: "Clear", overcast: "Overcast", rain: "Rain", fog: "Fog", storm: "Storm",
};

/**
 * Passive Perception for noticing threats while travelling. A scout keeps
 * full Perception at any pace; disadvantage (obscured, or night without
 * darkvision) is -5 to a passive score, and does not stack.
 */
export function travelPassivePerception(opts: {
  base: number;
  pace: Pace;
  activity: TravelActivity;
  weather: Weather;
  night: boolean;
  darkvision: boolean;
}): { score: number; notes: string[] } {
  let score = opts.base;
  const notes: string[] = [];
  if (opts.pace === "fast" && opts.activity !== "scout") {
    score -= 5;
    notes.push("fast pace -5");
  }
  const dim = isObscured(opts.weather) || (opts.night && !opts.darkvision);
  if (dim) {
    score -= 5;
    notes.push(isObscured(opts.weather) ? `${opts.weather} -5` : "darkness -5");
  }
  return { score, notes };
}

/** How many hexes away you can make out landmarks. */
export function sightRadius(opts: { terrain: string; activity: TravelActivity; weather: Weather; night: boolean }): number {
  let r = opts.terrain === "mountain" ? 3 : opts.terrain === "forest" || opts.terrain === "swamp" ? 1 : 2;
  if (opts.activity === "scout") r += 1;
  if (isObscured(opts.weather)) r -= 1;
  if (opts.night) r -= 1;
  return Math.max(0, r);
}

// ── end of day ────────────────────────────────────────────────────────────────

export interface EndOfDayResult {
  state: TravelState;
  notes: string[];
  exhaustionBefore: number;
}

/**
 * Make camp: eat, drink, sleep, and wake at 08:00 to new weather.
 * `conSave(dc)` rolls a Constitution save for the character.
 */
export function endOfDay(
  s: TravelState,
  opts: { conMod: number; biome: WanderBiome; conSave: (dc: number) => { success: boolean; text: string }; rng?: () => number },
): EndOfDayResult {
  const notes: string[] = [];
  const before = s.exhaustion;
  let exhaustion = s.exhaustion;
  let food = s.food;
  let water = s.water;
  let daysWithoutFood = s.daysWithoutFood;

  // Food
  let ate = false;
  if (food >= 1) {
    food -= 1;
    daysWithoutFood = 0;
    ate = true;
  } else {
    daysWithoutFood += 1;
    const limit = Math.max(1, 3 + opts.conMod);
    if (daysWithoutFood > limit) {
      exhaustion += 1;
      notes.push(`No food for ${daysWithoutFood} days (you can last ${limit}): one level of exhaustion.`);
    } else {
      notes.push(`No food today. You can go ${limit} days without food before it costs you (day ${daysWithoutFood}).`);
    }
  }

  // Water
  const need = s.hot ? 2 : 1;
  let drank = false;
  if (water >= need) {
    water -= need;
    drank = true;
  } else if (water >= need / 2) {
    water = 0;
    drank = true;
    const save = opts.conSave(15);
    if (!save.success) {
      const gain = exhaustion > 0 ? 2 : 1;
      exhaustion += gain;
      notes.push(`Only half the water you needed. Constitution save: ${save.text}. Failed: ${gain} level${gain > 1 ? "s" : ""} of exhaustion.`);
    } else {
      notes.push(`Only half the water you needed. Constitution save: ${save.text}. You hold up.`);
    }
  } else {
    water = 0;
    const gain = exhaustion > 0 ? 2 : 1;
    exhaustion += gain;
    notes.push(`Not enough water (you needed ${need} gallon${need > 1 ? "s" : ""}): ${gain} level${gain > 1 ? "s" : ""} of exhaustion.`);
  }

  // Long rest removes one level, if you had some food and drink.
  if ((ate || drank) && exhaustion > 0) {
    exhaustion -= 1;
    notes.push("A long rest with food and water removes one level of exhaustion.");
  }

  const weather = rollWeather(opts.biome, opts.rng ?? Math.random);
  notes.push(`Day ${s.day + 1} dawns: ${WEATHER_LABEL[weather].toLowerCase()}${isHot(opts.biome, weather) ? " and hot (you will need 2 gallons of water today)" : ""}.`);

  return {
    exhaustionBefore: before,
    notes,
    state: {
      ...s,
      day: s.day + 1,
      hour: DAY_START_HOUR,
      hoursToday: 0,
      food,
      water,
      daysWithoutFood,
      exhaustion: Math.max(0, Math.min(6, exhaustion)),
      weather,
      hot: isHot(opts.biome, weather),
    },
  };
}

export const EXHAUSTION_EFFECTS = [
  "none",
  "disadvantage on ability checks",
  "speed halved",
  "disadvantage on attacks and saving throws",
  "hit point maximum halved",
  "speed reduced to 0",
  "death",
];
