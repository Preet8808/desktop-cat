import { Personality } from "../core/types";

export type Activity =
  | "idle"
  | "walk"
  | "run"
  | "sit"
  | "sleep"
  | "jump"
  | "lookAround"
  | "stretch";

/** Relative weight of each activity for a given personality. Higher = more likely. */
export const PERSONALITY_WEIGHTS: Record<Personality, Record<Activity, number>> = {
  lazy: {
    idle: 3,
    walk: 1,
    run: 0.2,
    sit: 3,
    sleep: 4,
    jump: 0.3,
    lookAround: 1,
    stretch: 1.5,
  },
  playful: {
    idle: 1.5,
    walk: 2,
    run: 1.5,
    sit: 1,
    sleep: 0.8,
    jump: 1.5,
    lookAround: 1.5,
    stretch: 1,
  },
  energetic: {
    idle: 1,
    walk: 2,
    run: 3,
    sit: 0.5,
    sleep: 0.5,
    jump: 3,
    lookAround: 1,
    stretch: 1,
  },
  mischievous: {
    idle: 1,
    walk: 1.8,
    run: 2,
    sit: 1,
    sleep: 0.8,
    jump: 2.2,
    lookAround: 2,
    stretch: 1,
  },
};

/** How likely (0-1) this personality is to retreat after being clicked too many times. */
export const RETREAT_TENDENCY: Record<Personality, number> = {
  lazy: 0.1,
  playful: 0.15,
  energetic: 0.1,
  mischievous: 0.2,
};

/** Occasional out-of-nowhere action chance per decision tick, flavor for "mischievous". */
export const RANDOM_QUIRK_CHANCE: Record<Personality, number> = {
  lazy: 0.02,
  playful: 0.05,
  energetic: 0.05,
  mischievous: 0.12,
};

export function weightedPick<T extends string>(weights: Record<T, number>, exclude?: T[]): T {
  const entries = Object.entries(weights) as [T, number][];
  const filtered = exclude ? entries.filter(([k]) => !exclude.includes(k)) : entries;
  const total = filtered.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of filtered) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return filtered[filtered.length - 1][0];
}
